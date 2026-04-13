<?php

namespace App\Http\Controllers\Pharmacy;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('pharmacyProfile'),
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'name'               => ['nullable', 'string', 'max:160'],
            'license_no'         => ['nullable', 'string', 'max:120'],
            'address_line'       => ['nullable', 'string', 'max:255'],
            'city'               => ['nullable', 'string', 'max:80'],
            'state'              => ['nullable', 'string', 'max:80'],
            'country'            => ['nullable', 'string', 'max:80'],
            'postal_code'        => ['nullable', 'string', 'max:20'],
            'phone'              => ['nullable', 'string', 'max:40'],
            'business_hours'     => ['nullable', 'string', 'max:255'],
            'delivery_radius_km' => ['nullable', 'numeric', 'min:0'],
        ]);

        $request->user()->pharmacyProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json([
            'user' => $request->user()->fresh('pharmacyProfile'),
        ]);
    }
}
