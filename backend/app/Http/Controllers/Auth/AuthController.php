<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Shared password complexity rule — enforced everywhere that accepts
     * a new password (register, forgot-password reset, admin reset).
     *
     * Requires: ≥ 8 chars, ≥ 1 uppercase letter, ≥ 1 digit.
     */
    public static function passwordRules(): array
    {
        return [
            'required', 'string', 'min:8', 'max:128',
            'regex:/[A-Z]/',  // at least one uppercase letter
            'regex:/\d/',     // at least one number
        ];
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => self::passwordRules(),
            'role'     => ['required', Rule::in([
                User::ROLE_PATIENT, User::ROLE_DOCTOR, User::ROLE_PHARMACY,
            ])],
            // Phone is MANDATORY for patient self-registration so we can
            // contact them on WhatsApp / call. Optional for doctor/pharmacy
            // since those are typically admin-created.
            'phone'     => ['nullable', 'string', 'max:40'],
            'nickname'  => ['nullable', 'string', 'max:80'],     // patient
            'full_name' => ['nullable', 'string', 'max:120'],    // doctor
            'name'      => ['nullable', 'string', 'max:160'],    // pharmacy
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter and one number.',
        ]);

        if ($data['role'] === User::ROLE_PATIENT && empty($data['phone'])) {
            throw ValidationException::withMessages([
                'phone' => ['Phone number is required to register as a patient.'],
            ]);
        }

        // Block phone-number collisions so we can use phone as a login key.
        if (! empty($data['phone'])) {
            $normalized = $this->normalizePhone($data['phone']);
            $collision = DB::table('patient_profiles')->where('phone', $normalized)->exists();
            if ($collision) {
                throw ValidationException::withMessages([
                    'phone' => ['This phone number is already registered.'],
                ]);
            }
            $data['phone'] = $normalized;
        }

        // doctor & pharmacy require admin verification before becoming active
        $status = $data['role'] === User::ROLE_PATIENT ? 'active' : 'pending';

        $user = User::create([
            'email'         => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'role'          => $data['role'],
            'status'        => $status,
        ]);

        // create role-specific profile row
        match ($data['role']) {
            User::ROLE_PATIENT  => $user->patientProfile()->create([
                'nickname'  => $data['nickname'] ?? null,
                'full_name' => $data['nickname'] ?? null,
                'phone'     => $data['phone'] ?? null,
            ]),
            User::ROLE_DOCTOR   => $user->doctorProfile()->create([
                'full_name' => $data['full_name'] ?? $data['email'],
            ]),
            User::ROLE_PHARMACY => $user->pharmacyProfile()->create([
                'name' => $data['name'] ?? $data['email'],
            ]),
        };

        $token = $user->createToken('api', [$user->role])->plainTextToken;

        return response()->json([
            'user'  => $user->load($data['role'] . 'Profile'),
            'token' => $token,
        ], 201);
    }

    /**
     * Login — accepts either an email address OR a phone number in the
     * "identifier" field. The frontend submits a single field so the
     * user doesn't have to pick which method they used to sign up.
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            // Accept legacy "email" field for backwards compat as well
            'identifier' => ['nullable', 'string', 'max:190'],
            'email'      => ['nullable', 'string', 'max:190'],
            'password'   => ['required', 'string'],
        ]);

        $identifier = trim($data['identifier'] ?? $data['email'] ?? '');
        if ($identifier === '') {
            throw ValidationException::withMessages([
                'identifier' => ['Enter your email or phone number.'],
            ]);
        }

        // Detect whether the identifier looks like an email vs a phone number.
        // Phone numbers get normalised to digits-only before lookup.
        $user = null;
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            $user = User::where('email', $identifier)->first();
        } else {
            $phone = $this->normalizePhone($identifier);
            $profile = DB::table('patient_profiles')->where('phone', $phone)->first();
            if ($profile) {
                $user = User::find($profile->user_id);
            }
        }

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'identifier' => ['Invalid credentials.'],
            ]);
        }

        if ($user->status === 'suspended' || $user->status === 'deleted') {
            throw ValidationException::withMessages([
                'identifier' => ['Account is not available.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('api', [$user->role])->plainTextToken;

        // Admin has no profile table — only load relation if it exists
        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }
        return response()->json([
            'user'  => $user,
            'token' => $token,
            // BUG-015 — surface the flag explicitly at the top level so the
            // frontend can gate the session and route straight to a
            // mandatory password-change screen without digging into $user.
            'must_change_password' => (bool) $user->must_change_password,
        ]);
    }

    /**
     * Step 1 of forgot-password flow: user submits their email; we
     * generate a one-time token, stash it in password_resets (keyed
     * by email), and email them a link like:
     *     https://hansmedtcm.com/reset-password?email=…&token=…
     *
     * Always returns a generic 200 OK so the endpoint can't be used
     * to enumerate which emails have accounts.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        $this->ensurePasswordResetsTable();

        $user = User::where('email', $data['email'])->first();
        if ($user) {
            $token = Str::random(64);
            DB::table('password_resets')->where('email', $user->email)->delete();
            DB::table('password_resets')->insert([
                'email'      => $user->email,
                'token'      => Hash::make($token),
                'created_at' => now(),
            ]);

            $resetBase = rtrim(config('app.reset_url') ?: env('RESET_URL', 'https://hansmedtcm.com/reset-password'), '/');
            $resetUrl = $resetBase . '?email=' . urlencode($user->email) . '&token=' . urlencode($token);

            try {
                Mail::raw(
                    "Hello,\n\n" .
                    "We received a request to reset your HansMed password. If this was you, click the link below to set a new password. The link expires in 60 minutes.\n\n" .
                    $resetUrl . "\n\n" .
                    "If you did not request this, you can ignore this message — your password will remain unchanged.\n\n" .
                    "HansMed Modern TCM",
                    function ($m) use ($user) {
                        $m->to($user->email)->subject('Reset your HansMed password');
                    }
                );
            } catch (\Throwable $e) {
                // Mailer not configured? Still return success to avoid
                // leaking account existence, but log for admin inspection.
                \Log::warning('Password reset email failed: ' . $e->getMessage());
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $user->id,
                'action'      => 'auth.forgot_password.requested',
                'target_type' => 'user',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);
        }

        return response()->json([
            'message' => 'If that email is registered, we have sent a reset link. Check your inbox (and spam).',
        ]);
    }

    /**
     * Step 2 of forgot-password flow: user submits the token + new
     * password. Token is validated against the hashed copy, expires
     * after 60 minutes, and all tokens for that user are revoked on
     * success.
     */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:190'],
            'token'    => ['required', 'string'],
            'password' => self::passwordRules(),
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter and one number.',
        ]);

        $this->ensurePasswordResetsTable();

        $row = DB::table('password_resets')->where('email', $data['email'])->first();
        if (! $row) {
            throw ValidationException::withMessages(['token' => ['Reset link is invalid or has expired.']]);
        }
        if (now()->diffInMinutes($row->created_at) > 60) {
            DB::table('password_resets')->where('email', $data['email'])->delete();
            throw ValidationException::withMessages(['token' => ['Reset link has expired. Please request a new one.']]);
        }
        if (! Hash::check($data['token'], $row->token)) {
            throw ValidationException::withMessages(['token' => ['Reset link is invalid.']]);
        }

        $user = User::where('email', $data['email'])->first();
        if (! $user) {
            throw ValidationException::withMessages(['email' => ['No account for this email.']]);
        }

        $user->update(['password_hash' => Hash::make($data['password'])]);
        try { $user->tokens()->delete(); } catch (\Throwable $e) { /* fine */ }

        DB::table('password_resets')->where('email', $data['email'])->delete();
        DB::table('audit_logs')->insert([
            'user_id'     => $user->id,
            'action'      => 'auth.password_reset.completed',
            'target_type' => 'user',
            'target_id'   => $user->id,
            'created_at'  => now(),
        ]);

        return response()->json(['message' => 'Password reset. You can now sign in.']);
    }

    /** Strip formatting so "+60 12-345 6789" matches "+60123456789". */
    private function normalizePhone(string $phone): string
    {
        return preg_replace('/[^\d+]/', '', $phone) ?: '';
    }

    /** Create password_resets table on first use — idempotent. */
    private function ensurePasswordResetsTable(): void
    {
        if (Schema::hasTable('password_resets')) return;
        try {
            DB::statement("
                CREATE TABLE password_resets (
                    email      VARCHAR(190) NOT NULL PRIMARY KEY,
                    token      VARCHAR(255) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } catch (\Throwable $e) { /* another thread raced us — fine */ }
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }
        return response()->json(['user' => $user]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['ok' => true]);
    }
}
