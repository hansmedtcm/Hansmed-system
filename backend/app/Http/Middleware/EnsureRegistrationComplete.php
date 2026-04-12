<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRegistrationComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || $user->role !== 'patient') {
            return $next($request);
        }

        $profile = $user->patientProfile;
        if (! $profile || ! $profile->registration_completed) {
            return response()->json([
                'message' => 'Please complete your registration first. · 請先完成註冊。',
                'registration_incomplete' => true,
            ], 403);
        }

        return $next($request);
    }
}
