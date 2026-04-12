<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'role'     => ['required', Rule::in([
                User::ROLE_PATIENT, User::ROLE_DOCTOR, User::ROLE_PHARMACY,
            ])],
            'nickname'  => ['nullable', 'string', 'max:80'],     // patient
            'full_name' => ['nullable', 'string', 'max:120'],    // doctor
            'name'      => ['nullable', 'string', 'max:160'],    // pharmacy
        ]);

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

    public function login(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if ($user->status === 'suspended' || $user->status === 'deleted') {
            throw ValidationException::withMessages([
                'email' => ['Account is not available.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('api', [$user->role])->plainTextToken;

        $relation = $user->role . 'Profile';
        return response()->json([
            'user'  => $user->load($relation),
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $relation = $user->role . 'Profile';
        return response()->json(['user' => $user->load($relation)]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['ok' => true]);
    }
}
