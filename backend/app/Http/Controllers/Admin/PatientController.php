<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PatientProfile;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $q = User::where('role', 'patient')->with('patientProfile');
        if ($s = $request->query('search')) {
            $q->where(function ($w) use ($s) {
                $w->where('email', 'like', "%{$s}%")
                  ->orWhereHas('patientProfile', fn($p) => $p->where('full_name', 'like', "%{$s}%")
                    ->orWhere('ic_number', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%"));
            });
        }
        return response()->json($q->orderByDesc('id')->paginate(30));
    }

    public function show(int $id)
    {
        $user = User::where('role', 'patient')->with('patientProfile')->findOrFail($id);
        return response()->json(['user' => $user]);
    }

    /** Admin can edit any patient's profile — no lock check */
    public function update(Request $request, int $id)
    {
        $user = User::where('role', 'patient')->findOrFail($id);

        $data = $request->validate([
            'full_name'       => ['nullable', 'string', 'max:120'],
            'nickname'        => ['nullable', 'string', 'max:80'],
            'gender'          => ['nullable', 'in:male,female,other'],
            'birth_date'      => ['nullable', 'date', 'before:today'],
            'phone'           => ['nullable', 'string', 'max:40'],
            'ic_number'       => ['nullable', 'string', 'max:40'],
            'occupation'      => ['nullable', 'string', 'max:120'],
            'address_line1'   => ['nullable', 'string', 'max:255'],
            'address_line2'   => ['nullable', 'string', 'max:255'],
            'city'            => ['nullable', 'string', 'max:80'],
            'state'           => ['nullable', 'string', 'max:80'],
            'postal_code'     => ['nullable', 'string', 'max:20'],
            'country'         => ['nullable', 'string', 'max:80'],
            'emergency_contact_name'     => ['nullable', 'string', 'max:120'],
            'emergency_contact_phone'    => ['nullable', 'string', 'max:40'],
            'emergency_contact_relation' => ['nullable', 'string', 'max:60'],
            'blood_type'          => ['nullable', 'in:A+,A-,B+,B-,AB+,AB-,O+,O-,unknown'],
            'allergies'           => ['nullable', 'string', 'max:1000'],
            'medical_history'     => ['nullable', 'string', 'max:2000'],
            'current_medications' => ['nullable', 'string', 'max:1000'],
            'family_history'      => ['nullable', 'string', 'max:1000'],
            'height_cm'           => ['nullable', 'numeric', 'between:30,260'],
            'weight_kg'           => ['nullable', 'numeric', 'between:1,400'],
        ]);

        $profile = $user->patientProfile()->updateOrCreate(
            ['user_id' => $user->id],
            $data
        );

        DB::table('audit_logs')->insert([
            'user_id'     => $request->user()->id,
            'action'      => 'patient.profile.update',
            'target_type' => 'patient',
            'target_id'   => $id,
            'payload'     => json_encode(array_keys($data)),
            'created_at'  => now(),
        ]);

        return response()->json(['profile' => $profile]);
    }
}
