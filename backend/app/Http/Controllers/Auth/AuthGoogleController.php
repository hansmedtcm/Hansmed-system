<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

/**
 * Brief #15 — Google OAuth login.
 *
 * Three-endpoint flow:
 *   1. GET  /api/auth/google/redirect  → bounce user to Google's consent screen
 *   2. GET  /api/auth/google/callback  → Google sends user back; create/find
 *                                         User, stash one-time exchange-code → token
 *                                         mapping in cache (60s TTL, single-use),
 *                                         redirect frontend to portal with code
 *                                         in URL fragment
 *   3. POST /api/auth/google/exchange  → frontend POSTs the code, gets the
 *                                         Sanctum token + user payload back
 *
 * Why exchange-code instead of putting the token in the URL?
 *   Tokens in URLs leak via browser history, Referer headers, server access
 *   logs, browser extensions, and the clipboard. The exchange code is a 40-
 *   character random string that's single-use and expires in 60 seconds, so
 *   even if it leaks the worst case is a 60-second window for someone to
 *   replay it — and once consumed, replay returns 400.
 *
 * Account-linking strategy (handles the 3 cases):
 *   A. New user (no row with this google_id or email) → create users + patient_profiles
 *   B. Existing user with same email but no google_id → link Google to it
 *   C. Existing google-linked user → just log them in
 *
 * For new patients we set status='active' (no admin verification — patients
 * self-register today via the password flow with the same outcome) and
 * email_verified_at=now() (Google has already verified the email).
 *
 * Stateless mode (no Laravel session) is correct because:
 *   - Frontend is on hansmedtcm.com (static GitHub Pages, no shared session)
 *   - Backend is on hansmed-system-production.up.railway.app (different origin)
 *   - Google's authorization codes are one-time-use and bound to the
 *     redirect URI, which provides natural CSRF protection without state.
 */
class AuthGoogleController extends Controller
{
    /**
     * Step 1 — bounce the user to Google's consent screen.
     */
    public function redirect()
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    /**
     * Step 2 — Google sends the user back here with an auth code.
     * We exchange that for the Google profile, then either:
     *   - find an existing user (by google_id, or by email for account-linking)
     *   - or create a brand-new user + patient_profiles row
     * Then issue a Sanctum token and stash a one-time exchange code in
     * cache so the frontend can retrieve the token without it ever
     * appearing in the URL.
     */
    public function callback(Request $request)
    {
        try {
            $google = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('google_oauth_callback_failed', ['err' => $e->getMessage()]);
            return redirect($this->frontend()
                . '/v2/index.html?google_error=auth_failed');
        }

        $googleId    = $google->getId();
        $googleEmail = $google->getEmail();
        $googleName  = $google->getName() ?: $googleEmail;
        $googleAvatar = $google->getAvatar();

        // ── Find user — by google_id first, then by email (account-linking) ──
        $user = User::where('google_id', $googleId)->first();

        if (! $user) {
            $user = User::where('email', $googleEmail)->first();

            if ($user) {
                // Case B: existing email/password user signs in via Google
                // for the first time → link the Google account.
                $user->google_id = $googleId;
                if (! $user->email_verified_at) {
                    $user->email_verified_at = now();
                }
                $user->save();

                // Refresh patient avatar if we have one and they're a patient.
                if ($user->role === User::ROLE_PATIENT && $googleAvatar) {
                    DB::table('patient_profiles')
                        ->where('user_id', $user->id)
                        ->update([
                            'avatar_url' => $googleAvatar,
                            'updated_at' => now(),
                        ]);
                }

                $this->auditLog($user->id, 'auth.google.linked');
            } else {
                // Case A: brand-new account. Create as patient (matches the
                // existing register flow's default; doctor/pharmacy still
                // require admin-created accounts via a separate brief).
                $user = new User();
                $user->email             = $googleEmail;
                // Unusable random password — they sign in via Google, not
                // via password. If they ever want to add a password, the
                // forgot-password flow lets them set one.
                $user->password_hash     = Hash::make(Str::random(40));
                $user->role              = User::ROLE_PATIENT;
                $user->status            = 'active';
                $user->google_id         = $googleId;
                $user->email_verified_at = now();   // Google has already verified the email
                $user->save();

                // Patient profile — Google gives us name + picture,
                // phone is collected later in the patient onboarding UX.
                DB::table('patient_profiles')->insert([
                    'user_id'    => $user->id,
                    'nickname'   => $googleName,
                    'full_name'  => $googleName,
                    'avatar_url' => $googleAvatar,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->auditLog($user->id, 'auth.google.register');
            }
        } else {
            // Case C: returning google-linked user. Refresh avatar if it
            // changed (rare — Google rotates the URL when user changes
            // their picture).
            if ($user->role === User::ROLE_PATIENT && $googleAvatar) {
                DB::table('patient_profiles')
                    ->where('user_id', $user->id)
                    ->where(function ($q) use ($googleAvatar) {
                        $q->whereNull('avatar_url')
                          ->orWhere('avatar_url', '!=', $googleAvatar);
                    })
                    ->update([
                        'avatar_url' => $googleAvatar,
                        'updated_at' => now(),
                    ]);
            }
            $this->auditLog($user->id, 'auth.google.login');
        }

        // ── Block suspended/deleted accounts (mirrors AuthController::login) ──
        if ($user->status === 'suspended' || $user->status === 'deleted') {
            return redirect($this->frontend()
                . '/v2/index.html?google_error=account_unavailable');
        }

        // Mirror the existing login flow's last_login_at touch.
        $user->forceFill(['last_login_at' => now()])->save();

        // ── Issue Sanctum token + stash a single-use exchange code ──
        // The token ability is the user's role (matches AuthController::login).
        $token = $user->createToken('google-oauth', [$user->role])->plainTextToken;
        $code  = Str::random(40);
        Cache::put('google_exchange:' . $code, [
            'user_id' => $user->id,
            'token'   => $token,
        ], now()->addSeconds(60));

        // Hash fragment, NOT query string — the fragment is never sent to
        // the server, so it can't end up in our access logs (defence in
        // depth on top of single-use + 60s TTL).
        //
        // Land on index.html (PUBLIC, no auth guard) so landing.js can
        // exchange the code for a token. patient.js's requireAuth() at
        // the top of portal.html would otherwise bounce us to login
        // before the exchange runs.
        return redirect($this->frontend() . '/v2/index.html#/google-exchange?code=' . $code);
    }

    /**
     * Step 3 — frontend POSTs the exchange code, receives Sanctum token
     * + user payload. Single-use: a second POST with the same code
     * returns 400 because Cache::pull deleted it.
     */
    public function exchange(Request $request)
    {
        $request->validate([
            'code' => ['required', 'string', 'size:40'],
        ]);

        $key = 'google_exchange:' . $request->code;
        $payload = Cache::pull($key);   // pull = read+delete atomically

        if (! $payload) {
            return response()->json([
                'message' => 'Code expired or invalid',
            ], 400);
        }

        $user = User::find($payload['user_id']);
        if (! $user) {
            return response()->json([
                'message' => 'User not found',
            ], 404);
        }

        // Match AuthController::login response shape so the frontend can
        // reuse the same auth-store code path.
        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }

        return response()->json([
            'token' => $payload['token'],
            'user'  => $user,
            'must_change_password' => false,   // Google users never have a real password
        ]);
    }

    // ── helpers ──

    private function frontend(): string
    {
        return rtrim(config('app.frontend_url', 'https://hansmedtcm.com'), '/');
    }

    private function auditLog(int $userId, string $action): void
    {
        try {
            DB::table('audit_logs')->insert([
                'user_id'     => $userId,
                'action'      => $action,
                'target_type' => 'user',
                'target_id'   => $userId,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) {
            // audit_logs missing — fine, it's best-effort.
        }
    }
}
