<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user()->load('patientProfile');
        return response()->json(['user' => $user]);
    }

    /**
     * Update profile — only allowed if registration is NOT yet completed.
     */
    public function update(Request $request)
    {
        $profile = $request->user()->patientProfile;
        if ($profile && $profile->registration_completed) {
            return response()->json([
                'message' => 'Profile is locked. Contact admin to make changes. · 資料已鎖定，請聯絡管理員修改。',
                'profile_locked' => true,
            ], 403);
        }

        $data = $this->profileRules($request);
        $profile = $request->user()->patientProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );
        return response()->json(['profile' => $profile]);
    }

    /**
     * One-time registration completion. Validates ALL required fields,
     * then locks the profile permanently.
     */
    public function completeRegistration(Request $request)
    {
        $profile = $request->user()->patientProfile;
        if ($profile && $profile->registration_completed) {
            return response()->json([
                'message' => 'Registration already completed. · 註冊已完成。',
                'profile_locked' => true,
            ], 422);
        }

        $data = $request->validate([
            'full_name'       => ['required', 'string', 'max:120'],
            'phone'           => ['required', 'string', 'max:40'],
            'ic_number'       => ['required', 'string', 'max:40'],
            'gender'          => ['required', 'in:male,female,other'],
            'birth_date'      => ['required', 'date', 'before:today'],
            'occupation'      => ['nullable', 'string', 'max:120'],
            'address_line1'   => ['required', 'string', 'max:255'],
            'address_line2'   => ['nullable', 'string', 'max:255'],
            'city'            => ['required', 'string', 'max:80'],
            'state'           => ['required', 'string', 'max:80'],
            'postal_code'     => ['required', 'string', 'max:20'],
            'country'         => ['required', 'string', 'max:80'],
            'emergency_contact_name'     => ['required', 'string', 'max:120'],
            'emergency_contact_phone'    => ['required', 'string', 'max:40'],
            'emergency_contact_relation' => ['required', 'string', 'max:60'],
            'blood_type'          => ['required', 'in:A+,A-,B+,B-,AB+,AB-,O+,O-,unknown'],
            'allergies'           => ['required', 'string', 'max:1000'],
            'medical_history'     => ['nullable', 'string', 'max:2000'],
            'current_medications' => ['nullable', 'string', 'max:1000'],
            'family_history'      => ['nullable', 'string', 'max:1000'],
            'height_cm'           => ['nullable', 'numeric', 'between:30,260'],
            'weight_kg'           => ['nullable', 'numeric', 'between:1,400'],
        ]);

        $data['registration_completed'] = true;
        $data['nickname'] = $data['full_name'];

        $profile = $request->user()->patientProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json([
            'message' => 'Registration completed! · 註冊完成！',
            'profile' => $profile,
        ]);
    }

    private function profileRules(Request $request): array
    {
        return $request->validate([
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
    }
}
