<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DoctorProfile;
use App\Models\PharmacyProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AccountController extends Controller
{
    /** List all non-patient accounts (doctor, pharmacy, admin) */
    public function index(Request $request)
    {
        $q = User::whereIn('role', ['doctor', 'pharmacy', 'admin'])
            ->with(['doctorProfile', 'pharmacyProfile']);

        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('email', 'like', "%{$s}%")
                  ->orWhereHas('doctorProfile', fn($p) => $p->where('full_name', 'like', "%{$s}%"))
                  ->orWhereHas('pharmacyProfile', fn($p) => $p->where('name', 'like', "%{$s}%"));
            });
        }

        if ($role = $request->query('role')) {
            $q->where('role', $role);
        }

        return response()->json($q->orderByDesc('id')->paginate(30));
    }

    /** Admin creates any account type: doctor, pharmacy, or admin */
    public function store(Request $request)
    {
        $data = $request->validate([
            'role'     => ['required', 'in:doctor,pharmacy,admin'],
            'email'    => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'name'     => ['required', 'string', 'max:160'],
            // Doctor-specific
            'specialties'      => ['nullable', 'string', 'max:500'],
            'license_no'       => ['nullable', 'string', 'max:120'],
            // T&CM Council Malaysia registration (T&CM Act 2016 §14).
            // Required before a doctor sees patients, but stored
            // nullable so admin can create the account and fill this
            // in after sighting the physical certificate.
            'tcm_council_no'   => ['nullable', 'string', 'max:80'],
            'bio'              => ['nullable', 'string', 'max:2000'],
            'consultation_fee' => ['nullable', 'numeric', 'min:0'],
            // Pharmacy-specific
            'address_line'     => ['nullable', 'string', 'max:255'],
            'city'             => ['nullable', 'string', 'max:80'],
            'state'            => ['nullable', 'string', 'max:80'],
            'country'          => ['nullable', 'string', 'max:80'],
            'phone'            => ['nullable', 'string', 'max:40'],
        ]);

        return DB::transaction(function () use ($data, $request) {
            $user = User::create([
                'email'         => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'role'          => $data['role'],
                'status'        => 'active',
                // BUG-015 — admin-created accounts ship with a temp password.
                // Force the user to change it on first login.
                'must_change_password' => 1,
            ]);

            if ($data['role'] === 'doctor') {
                $hasTcmNo = !empty($data['tcm_council_no']);
                $user->doctorProfile()->create([
                    'full_name'              => $data['name'],
                    'specialties'            => $data['specialties'] ?? null,
                    'license_no'             => $data['license_no'] ?? null,
                    'tcm_council_no'         => $data['tcm_council_no'] ?? null,
                    // If the admin provided the council number at
                    // creation time we treat this as the verification
                    // event — stamp who verified and when.
                    'tcm_council_verified_at' => $hasTcmNo ? now() : null,
                    'tcm_council_verified_by' => $hasTcmNo ? $request->user()->id : null,
                    'bio'                    => $data['bio'] ?? null,
                    'consultation_fee'       => $data['consultation_fee'] ?? 0,
                    'verification_status'    => 'approved',
                    'accepting_appointments' => true,
                ]);
            } elseif ($data['role'] === 'pharmacy') {
                $user->pharmacyProfile()->create([
                    'name'                => $data['name'],
                    'license_no'          => $data['license_no'] ?? null,
                    'verification_status' => 'approved',
                    'address_line'        => $data['address_line'] ?? null,
                    'city'                => $data['city'] ?? null,
                    'state'               => $data['state'] ?? null,
                    'country'             => $data['country'] ?? null,
                    'phone'               => $data['phone'] ?? null,
                ]);
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'account.create.' . $data['role'],
                'target_type' => 'user',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);

            return response()->json([
                'message' => ucfirst($data['role']) . ' account created!',
                'user'    => $user->load(['doctorProfile', 'pharmacyProfile']),
            ], 201);
        });
    }

    /** Toggle active/suspended — blocked on master accounts */
    public function toggleStatus(int $id)
    {
        $user = User::findOrFail($id);
        if ($user->isMaster()) {
            return response()->json([
                'message' => 'Master account cannot be suspended. This is a protected super-admin account.',
            ], 422);
        }
        $user->update(['status' => $user->status === 'active' ? 'suspended' : 'active']);
        return response()->json(['user' => $user->fresh()]);
    }

    /**
     * Delete an account permanently.
     *
     * Safety rules:
     *   • Cannot delete yourself (would lock you out mid-request).
     *   • Cannot delete the last active admin (would lock everyone out).
     *   • Requires explicit confirm=true in the request body (prevents
     *     accidental DELETE from a mis-typed URL).
     *   • Caller must have the 'manage_users' permission (enforced by
     *     the route middleware).
     *
     * What happens:
     *   • User row is deleted. FOREIGN KEY ... ON DELETE CASCADE on
     *     user_permission_overrides, personal_access_tokens (Sanctum),
     *     patient_profiles / doctor_profiles / pharmacy_profiles,
     *     consent_grants, addresses cleans up the profile side.
     *   • Historical records (prescriptions, appointments, orders,
     *     audit_logs) retain their user_id foreign keys — those are
     *     INT columns without ON DELETE CASCADE so they're preserved
     *     for compliance/audit purposes even after the account is gone.
     *     If that's unacceptable for any given table, add ON DELETE SET
     *     NULL at the schema level.
     *   • An audit_log row is written BEFORE the delete so the action
     *     is traceable even though the target user's id is gone.
     */
    public function destroy(Request $request, int $id)
    {
        $actor = $request->user();
        $target = User::findOrFail($id);

        /* Confirmation gate — client must pass confirm=true explicitly. */
        $data = $request->validate([
            'confirm' => ['required', 'accepted'],
        ]);

        /* Safety 0: master accounts are immutable */
        if ($target->isMaster()) {
            return response()->json([
                'message' => 'Master account cannot be deleted. This is a protected super-admin account.',
            ], 422);
        }

        /* Safety 1: can't delete yourself */
        if ($target->id === $actor->id) {
            return response()->json([
                'message' => 'You cannot delete your own account. Ask another admin to do it.',
            ], 422);
        }

        /* Safety 2: can't delete the last active admin */
        if ($target->role === 'admin') {
            $remainingAdmins = User::where('role', 'admin')
                ->where('status', 'active')
                ->where('id', '!=', $target->id)
                ->count();
            if ($remainingAdmins === 0) {
                return response()->json([
                    'message' => 'Cannot delete the last active admin. Create another admin first.',
                ], 422);
            }
        }

        /* Write audit log BEFORE delete so the trail survives. */
        DB::table('audit_logs')->insert([
            'user_id'     => $actor->id,
            'action'      => 'account.delete',
            'target_type' => 'user',
            'target_id'   => $target->id,
            'payload'     => json_encode([
                'deleted_email' => $target->email,
                'deleted_role'  => $target->role,
                'deleted_status'=> $target->status,
            ]),
            'created_at'  => now(),
        ]);

        /* Revoke any live Sanctum tokens so session dies instantly. */
        try { $target->tokens()->delete(); } catch (\Throwable $e) { /* ignore if table missing */ }

        /* Delete — ON DELETE CASCADE handles dependent profile rows. */
        $target->delete();

        return response()->json([
            'message'      => 'Account deleted',
            'deleted_id'   => $id,
            'deleted_role' => $target->role,
        ]);
    }

    /**
     * Reset the password for any user account (patient, doctor, pharmacy,
     * or fellow admin). Typically used when someone forgot their password
     * and there's no self-serve reset flow yet.
     *
     * The admin supplies a new password; the user is force-logged-out by
     * revoking all existing tokens so the old session can't keep working
     * with a stale password.
     */
    public function resetPassword(Request $request, int $id)
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ]);

        $user = User::findOrFail($id);
        $actor = $request->user();

        /* Master account rules:
           Only another MASTER can reset a master's password (even
           non-master admins can't). Masters can always reset their
           own password. */
        if ($user->isMaster() && $user->id !== $actor->id && ! $actor->isMaster()) {
            return response()->json([
                'message' => 'Master account password can only be reset by the master account itself or another master account.',
            ], 403);
        }

        // Only another admin can reset another admin's password
        if ($user->role === 'admin' && $user->id !== $actor->id && $actor->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // BUG-015 — admin-reset passwords are temporary; force change on
        // next login. Users resetting their own password go through a
        // separate self-serve flow that clears this flag.
        $user->update([
            'password_hash'        => Hash::make($data['password']),
            'must_change_password' => $user->id === $actor->id ? 0 : 1,
        ]);
        // Kick all of this user's API tokens so the old password stops working.
        try { $user->tokens()->delete(); } catch (\Throwable $e) { /* Sanctum not set up? ignore */ }

        DB::table('audit_logs')->insert([
            'user_id'     => $actor->id,
            'action'      => 'account.password_reset',
            'target_type' => 'user',
            'target_id'   => $user->id,
            'created_at'  => now(),
        ]);

        return response()->json([
            'message' => 'Password reset for ' . $user->email,
            'user'    => ['id' => $user->id, 'email' => $user->email, 'role' => $user->role],
        ]);
    }

    /**
     * Update account-level fields (email + status) and role-specific
     * profile fields (name, phone, license, etc). Works for any role.
     * The password is NOT changed here — use resetPassword for that.
     */
    public function updateAccount(Request $request, int $id)
    {
        $data = $request->validate([
            'email'  => ['nullable', 'email', 'max:190'],
            'status' => ['nullable', 'in:active,pending,suspended'],
            'name'   => ['nullable', 'string', 'max:160'],
            // Doctor-specific
            'specialties'      => ['nullable', 'string', 'max:500'],
            'license_no'       => ['nullable', 'string', 'max:120'],
            'tcm_council_no'   => ['nullable', 'string', 'max:80'],
            'bio'              => ['nullable', 'string', 'max:2000'],
            'consultation_fee' => ['nullable', 'numeric', 'min:0'],
            // Pharmacy-specific
            'address_line' => ['nullable', 'string', 'max:255'],
            'city'         => ['nullable', 'string', 'max:80'],
            'state'        => ['nullable', 'string', 'max:80'],
            'country'      => ['nullable', 'string', 'max:80'],
            'phone'        => ['nullable', 'string', 'max:40'],
            // Patient-specific (on patient_profiles)
            'nickname'   => ['nullable', 'string', 'max:60'],
            'gender'     => ['nullable', 'string', 'max:20'],
            'birth_date' => ['nullable', 'date'],
        ]);

        $user = User::findOrFail($id);

        /* Master-account guard rails:
           • email change would un-master the account, so block it
           • status change (suspension) blocked
           • role change is not exposed by this endpoint, but email
             rename is functionally equivalent — blocking protects. */
        if ($user->isMaster()) {
            if (!empty($data['email']) && strtolower($data['email']) !== strtolower($user->email)) {
                abort(response()->json([
                    'errors' => ['email' => ['Master account email cannot be changed.']],
                ], 422));
            }
            if (!empty($data['status']) && $data['status'] !== $user->status) {
                abort(response()->json([
                    'errors' => ['status' => ['Master account status cannot be changed.']],
                ], 422));
            }
        }

        return DB::transaction(function () use ($data, $user, $request) {
            // Reject email collisions
            if (!empty($data['email']) && $data['email'] !== $user->email) {
                if (User::where('email', $data['email'])->where('id', '!=', $user->id)->exists()) {
                    abort(response()->json(['errors' => ['email' => ['Email already in use']]], 422));
                }
                $user->email = $data['email'];
            }
            if (!empty($data['status'])) {
                $user->status = $data['status'];
            }
            $user->save();

            // Role-specific profile updates
            if ($user->role === 'doctor') {
                $profile = $user->doctorProfile()->firstOrCreate([], ['full_name' => '']);
                $updates = array_filter([
                    'full_name'        => $data['name'] ?? null,
                    'specialties'      => $data['specialties'] ?? null,
                    'license_no'       => $data['license_no'] ?? null,
                    'tcm_council_no'   => $data['tcm_council_no'] ?? null,
                    'bio'              => $data['bio'] ?? null,
                    'consultation_fee' => $data['consultation_fee'] ?? null,
                ], fn($v) => $v !== null);
                // If tcm_council_no just changed or was added, stamp
                // the admin who verified it and when. Audit trail.
                if (isset($updates['tcm_council_no']) && $updates['tcm_council_no'] !== $profile->tcm_council_no) {
                    $updates['tcm_council_verified_at'] = now();
                    $updates['tcm_council_verified_by'] = $request->user()->id;
                }
                $profile->fill($updates)->save();
            } elseif ($user->role === 'pharmacy') {
                $profile = $user->pharmacyProfile()->firstOrCreate([], ['name' => '']);
                $profile->fill(array_filter([
                    'name'         => $data['name']         ?? null,
                    'license_no'   => $data['license_no']   ?? null,
                    'address_line' => $data['address_line'] ?? null,
                    'city'         => $data['city']         ?? null,
                    'state'        => $data['state']        ?? null,
                    'country'      => $data['country']      ?? null,
                    'phone'        => $data['phone']        ?? null,
                ], fn($v) => $v !== null))->save();
            } elseif ($user->role === 'patient' && method_exists($user, 'patientProfile')) {
                $profile = $user->patientProfile()->firstOrCreate([]);
                $profile->fill(array_filter([
                    'nickname'   => $data['nickname']   ?? $data['name'] ?? null,
                    'gender'     => $data['gender']     ?? null,
                    'birth_date' => $data['birth_date'] ?? null,
                    'phone'      => $data['phone']      ?? null,
                ], fn($v) => $v !== null))->save();
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'account.update.' . $user->role,
                'target_type' => 'user',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);

            return response()->json([
                'message' => 'Account updated',
                'user'    => $user->fresh()->load(['doctorProfile', 'pharmacyProfile', 'patientProfile']),
            ]);
        });
    }
}
