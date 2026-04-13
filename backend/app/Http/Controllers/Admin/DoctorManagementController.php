<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DoctorProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DoctorManagementController extends Controller
{
    /** List all doctors (not just pending) */
    public function index(Request $request)
    {
        $q = User::where('role', 'doctor')->with('doctorProfile');
        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('email', 'like', "%{$s}%")
                  ->orWhereHas('doctorProfile', fn($p) => $p->where('full_name', 'like', "%{$s}%"));
            });
        }
        return response()->json($q->orderByDesc('id')->paginate(30));
    }

    /** Admin creates a doctor account — active + approved immediately */
    public function store(Request $request)
    {
        $data = $request->validate([
            'full_name'        => ['required', 'string', 'max:120'],
            'email'            => ['required', 'email', 'max:190', 'unique:users,email'],
            'password'         => ['required', 'string', 'min:8', 'max:128'],
            'specialties'      => ['nullable', 'string', 'max:500'],
            'license_no'       => ['nullable', 'string', 'max:120'],
            'bio'              => ['nullable', 'string', 'max:2000'],
            'consultation_fee' => ['required', 'numeric', 'min:0'],
            'status'           => ['nullable', 'in:active,pending,suspended'],
        ]);

        return DB::transaction(function () use ($data, $request) {
            $user = User::create([
                'email'         => $data['email'],
                'password_hash' => Hash::make($data['password']),
                'role'          => 'doctor',
                'status'        => $data['status'] ?? 'active',
            ]);

            $user->doctorProfile()->create([
                'full_name'              => $data['full_name'],
                'specialties'            => $data['specialties'] ?? null,
                'license_no'             => $data['license_no'] ?? null,
                'bio'                    => $data['bio'] ?? null,
                'consultation_fee'       => $data['consultation_fee'],
                'verification_status'    => 'approved',
                'accepting_appointments' => true,
            ]);

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'doctor.create',
                'target_type' => 'doctor',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);

            return response()->json([
                'message' => 'Doctor account created!',
                'user'    => $user->load('doctorProfile'),
            ], 201);
        });
    }

    /** Admin updates a doctor's profile */
    public function update(Request $request, int $id)
    {
        $user = User::where('role', 'doctor')->findOrFail($id);

        $data = $request->validate([
            'full_name'              => ['nullable', 'string', 'max:120'],
            'specialties'            => ['nullable', 'string', 'max:500'],
            'license_no'             => ['nullable', 'string', 'max:120'],
            'bio'                    => ['nullable', 'string', 'max:2000'],
            'consultation_fee'       => ['nullable', 'numeric', 'min:0'],
            'accepting_appointments' => ['nullable', 'boolean'],
            'status'                 => ['nullable', 'in:active,pending,suspended'],
            'verification_status'    => ['nullable', 'in:pending,approved,rejected'],
        ]);

        if (isset($data['status'])) {
            $user->update(['status' => $data['status']]);
            unset($data['status']);
        }

        $user->doctorProfile()->updateOrCreate(
            ['user_id' => $user->id],
            $data
        );

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'doctor.update',
            'target_type' => 'doctor',
            'target_id'   => $user->id,
            'payload'     => json_encode(array_keys($data)),
            'created_at'  => now(),
        ]);

        return response()->json(['user' => $user->fresh('doctorProfile')]);
    }

    /** Toggle doctor active/suspended */
    public function toggleStatus(Request $request, int $id)
    {
        $user = User::where('role', 'doctor')->findOrFail($id);
        $newStatus = $user->status === 'active' ? 'suspended' : 'active';
        $user->update(['status' => $newStatus]);

        return response()->json([
            'message' => "Doctor {$newStatus}",
            'user'    => $user->fresh('doctorProfile'),
        ]);
    }
}
