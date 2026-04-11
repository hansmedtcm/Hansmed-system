<?php

namespace App\Http\Controllers\Patient;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    // C-02: personal info  +  C-03: health record (height/weight)
    public function show(Request $request)
    {
        $user = $request->user()->load('patientProfile');
        return response()->json(['user' => $user]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'nickname'   => ['nullable', 'string', 'max:80'],
            'avatar_url' => ['nullable', 'url', 'max:500'],
            'gender'     => ['nullable', 'in:male,female,other'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'phone'      => ['nullable', 'string', 'max:40'],
            'height_cm'  => ['nullable', 'numeric', 'between:30,260'],
            'weight_kg'  => ['nullable', 'numeric', 'between:1,400'],
        ]);

        $profile = $request->user()->patientProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json(['profile' => $profile]);
    }
}
