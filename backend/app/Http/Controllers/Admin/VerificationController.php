<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DoctorProfile;
use App\Models\PharmacyProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VerificationController extends Controller
{
    // M-03: list pending doctors
    public function pendingDoctors()
    {
        return response()->json(
            DoctorProfile::with('user')
                ->where('verification_status', 'pending')
                ->paginate(20)
        );
    }

    // M-03: approve / reject doctor
    public function reviewDoctor(Request $request, int $doctorId)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'reason'   => ['nullable', 'string', 'max:500'],
        ]);

        return DB::transaction(function () use ($doctorId, $data, $request) {
            $profile = DoctorProfile::where('user_id', $doctorId)->firstOrFail();
            $user    = User::findOrFail($doctorId);

            if ($data['decision'] === 'approve') {
                $profile->update(['verification_status' => 'approved']);
                $user->update(['status' => 'active']);
            } else {
                $profile->update(['verification_status' => 'rejected']);
                $user->update(['status' => 'suspended']);
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'doctor.review.' . $data['decision'],
                'target_type' => 'doctor',
                'target_id'   => $doctorId,
                'payload'     => json_encode(['reason' => $data['reason'] ?? null]),
                'created_at'  => now(),
            ]);

            return response()->json(['ok' => true, 'doctor' => $profile->fresh('user')]);
        });
    }

    // M-04: pharmacies
    public function pendingPharmacies()
    {
        return response()->json(
            PharmacyProfile::with('user')
                ->where('verification_status', 'pending')
                ->paginate(20)
        );
    }

    public function reviewPharmacy(Request $request, int $pharmacyId)
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'reason'   => ['nullable', 'string', 'max:500'],
        ]);

        return DB::transaction(function () use ($pharmacyId, $data, $request) {
            $profile = PharmacyProfile::where('user_id', $pharmacyId)->firstOrFail();
            $user    = User::findOrFail($pharmacyId);

            if ($data['decision'] === 'approve') {
                $profile->update(['verification_status' => 'approved']);
                $user->update(['status' => 'active']);
            } else {
                $profile->update(['verification_status' => 'rejected']);
                $user->update(['status' => 'suspended']);
            }

            DB::table('audit_logs')->insert([
                'user_id'     => $request->user()->id,
                'action'      => 'pharmacy.review.' . $data['decision'],
                'target_type' => 'pharmacy',
                'target_id'   => $pharmacyId,
                'payload'     => json_encode(['reason' => $data['reason'] ?? null]),
                'created_at'  => now(),
            ]);

            return response()->json(['ok' => true, 'pharmacy' => $profile->fresh('user')]);
        });
    }
}
