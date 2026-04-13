<?php

namespace App\Http\Controllers\Doctor;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('doctorProfile'),
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'full_name'              => ['nullable', 'string', 'max:120'],
            'bio'                    => ['nullable', 'string', 'max:2000'],
            'specialties'            => ['nullable', 'string', 'max:500'],
            'license_no'             => ['nullable', 'string', 'max:120'],
            'consultation_fee'       => ['nullable', 'numeric', 'min:0'],
            'accepting_appointments' => ['nullable', 'boolean'],
        ]);

        $request->user()->doctorProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json([
            'user' => $request->user()->fresh('doctorProfile'),
        ]);
    }
}
