<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Emergency admin-bootstrap endpoint. Gated by the ADMIN_BOOTSTRAP_SECRET
 * environment variable — if the env var is unset/empty the endpoint
 * refuses all calls. Use this when you need to create or reset the
 * platform admin and don't have shell access to run
 * `php artisan hansmed:create-admin`.
 *
 * Usage (after setting ADMIN_BOOTSTRAP_SECRET on Railway):
 *
 *   POST /api/bootstrap-admin
 *   Header: X-Bootstrap-Secret: <your secret>
 *   Body:   { "email": "you@example.com", "password": "NewPassword123" }
 *
 * The response confirms the admin email and whether it was created or reset.
 * Existing admins are updated in place — the email+password are reset and
 * the role is forced back to "admin" with status "active".
 */
class BootstrapController extends Controller
{
    public function resetAdmin(Request $request)
    {
        $configured = env('ADMIN_BOOTSTRAP_SECRET');
        if (empty($configured)) {
            return response()->json([
                'error' => 'Bootstrap endpoint is disabled. Set ADMIN_BOOTSTRAP_SECRET in environment to enable.',
            ], 503);
        }

        $provided = $request->header('X-Bootstrap-Secret') ?: $request->input('secret');
        if (! hash_equals((string) $configured, (string) $provided)) {
            return response()->json(['error' => 'Invalid bootstrap secret'], 403);
        }

        $data = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string|min:8',
        ]);

        $existing = User::where('email', $data['email'])->first();
        $user = User::updateOrCreate(
            ['email' => $data['email']],
            [
                'password_hash' => Hash::make($data['password']),
                'role'          => 'admin',
                'status'        => 'active',
            ],
        );

        return response()->json([
            'success' => true,
            'action'  => $existing ? 'reset' : 'created',
            'admin'   => [
                'id'     => $user->id,
                'email'  => $user->email,
                'role'   => $user->role,
                'status' => $user->status,
            ],
            'message' => $existing
                ? "Existing user {$user->email} reset to admin with new password."
                : "New admin {$user->email} created.",
        ]);
    }
}
