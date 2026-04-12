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

    public function update(Request $request)
    {
        $data = $request->validate([
            'full_name'       => ['nullable', 'string', 'max:120'],
            'nickname'        => ['nullable', 'string', 'max:80'],
            'avatar_url'      => ['nullable', 'url', 'max:500'],
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

        $profile = $request->user()->patientProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json(['profile' => $profile]);
    }
}
