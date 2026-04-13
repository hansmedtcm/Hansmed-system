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
            ]);

            if ($data['role'] === 'doctor') {
                $user->doctorProfile()->create([
                    'full_name'              => $data['name'],
                    'specialties'            => $data['specialties'] ?? null,
                    'license_no'             => $data['license_no'] ?? null,
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

    /** Toggle active/suspended */
    public function toggleStatus(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => $user->status === 'active' ? 'suspended' : 'active']);
        return response()->json(['user' => $user->fresh()]);
    }
}
