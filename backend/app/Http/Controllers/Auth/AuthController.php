<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** 6-digit codes — verification + password-reset both use this length. */
    private const CODE_LENGTH        = 6;
    /** 15 minutes. Codes are easier to brute-force than 64-char tokens, so
     *  the window is shorter. */
    private const CODE_TTL_MINUTES   = 15;
    /** Max enter attempts per code before it's invalidated. */
    private const CODE_MAX_ATTEMPTS  = 5;
    /** Max code re-issues per email per 15 min window (resend limit). */
    private const CODE_MAX_REISSUES  = 3;

    /**
     * Shared password complexity rule — enforced everywhere that accepts
     * a new password (register, forgot-password reset, admin reset).
     *
     * Requires: ≥ 8 chars, ≥ 1 uppercase letter, ≥ 1 digit, ≥ 1 special
     * character. Special-char list deliberately broad to accept symbols
     * common on Malaysian / Chinese keyboards.
     */
    public static function passwordRules(): array
    {
        return [
            'required', 'string', 'min:8', 'max:128',
            'regex:/[A-Z]/',                    // ≥ 1 uppercase
            'regex:/\d/',                       // ≥ 1 digit
            'regex:/[\W_]/',                    // ≥ 1 non-alphanumeric (symbol/punctuation)
        ];
    }

    /**
     * Step 1 of registration: create the account, mint a 6-digit code,
     * email it. User must POST it back to /auth/verify-email before
     * they can log in.
     *
     * Brief #16e — login() now refuses unverified accounts. Patient
     * accounts created here have status='active' but email_verified_at
     * is NULL until the user enters the code.
     *
     * Doctor / pharmacy accounts still get status='pending' for admin
     * review — verification doesn't replace admin approval.
     */
    public function register(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => self::passwordRules(),
            // Brief #17 hardening — public self-registration is restricted
            // to patient role only. Doctor and pharmacy accounts are
            // created exclusively by admins via /api/admin/doctors and
            // /api/admin/pharmacies after offline verification (interview,
            // license check, etc.). Without this restriction, any caller
            // with curl could create a doctor/pharmacy account by passing
            // role=doctor on the public endpoint — privilege escalation.
            'role'     => ['required', Rule::in([User::ROLE_PATIENT])],
            // Phone is MANDATORY for patient self-registration.
            'phone'     => ['nullable', 'string', 'max:40', 'regex:/^(\+?60|0)[0-9]{8,11}$/'],
            'nickname'  => ['nullable', 'string', 'max:80'],     // patient
            'full_name' => ['nullable', 'string', 'max:120'],    // doctor
            'name'      => ['nullable', 'string', 'max:160'],    // pharmacy
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one number, and one symbol. · 密碼必須包含大寫字母、數字及符號。',
            'phone.regex'    => 'Please enter a valid Malaysian phone number (e.g. +60123456789 or 0123456789). · 請輸入有效的馬來西亞電話號碼。',
        ]);

        if ($data['role'] === User::ROLE_PATIENT && empty($data['phone'])) {
            throw ValidationException::withMessages([
                'phone' => ['Phone number is required to register as a patient.'],
            ]);
        }

        // Block phone-number collisions so we can use phone as a login key.
        if (! empty($data['phone'])) {
            $normalized = $this->normalizePhone($data['phone']);
            $collision = DB::table('patient_profiles')->where('phone', $normalized)->exists();
            if ($collision) {
                throw ValidationException::withMessages([
                    'phone' => ['This phone number is already registered.'],
                ]);
            }
            $data['phone'] = $normalized;
        }

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
                'phone'     => $data['phone'] ?? null,
            ]),
            User::ROLE_DOCTOR   => $user->doctorProfile()->create([
                'full_name' => $data['full_name'] ?? $data['email'],
            ]),
            User::ROLE_PHARMACY => $user->pharmacyProfile()->create([
                'name' => $data['name'] ?? $data['email'],
            ]),
        };

        // Brief #16e — issue + send a verification code. Note we do NOT
        // issue a Sanctum token yet — the user must verify their email
        // first via /auth/verify-email.
        $code = $this->issueVerificationCode($user->email);
        $this->sendVerificationEmail($user->email, $code);

        return response()->json([
            'user'  => $user->load($data['role'] . 'Profile'),
            'requires_verification' => true,
            'email' => $user->email,
            'message' => 'We have sent a 6-digit verification code to your email. Please enter it on the next screen to complete registration. · 我們已將6位數驗證碼寄到您的電郵，請於下一畫面輸入完成註冊。',
        ], 201);
    }

    /**
     * Brief #16e — verify the 6-digit code and finalize registration.
     * On success: marks email_verified_at = NOW(), deletes the code,
     * issues a Sanctum token, and returns the same shape as login().
     *
     * Per-code attempts are capped at 5 (CODE_MAX_ATTEMPTS) to defend
     * against brute force. With a 6-digit space (1M codes) and 5
     * attempts per code, the chance of guessing within the window is
     * 5e-6 — acceptable for transactional verification.
     */
    public function verifyEmail(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'code'  => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.regex' => 'Please enter the 6-digit code from your email. · 請輸入電郵中的6位數驗證碼。',
        ]);

        $row = DB::table('email_verification_codes')->where('email', $data['email'])->first();
        if (! $row) {
            throw ValidationException::withMessages([
                'code' => ['No verification code on file for this email. Please request a new code. · 請重新申請驗證碼。'],
            ]);
        }

        // Window expired
        if (now()->greaterThan($row->expires_at)) {
            DB::table('email_verification_codes')->where('email', $data['email'])->delete();
            throw ValidationException::withMessages([
                'code' => ['Code has expired. Please request a new code. · 驗證碼已過期，請重新申請。'],
            ]);
        }

        // Attempts cap
        if ((int) $row->attempts >= self::CODE_MAX_ATTEMPTS) {
            DB::table('email_verification_codes')->where('email', $data['email'])->delete();
            throw ValidationException::withMessages([
                'code' => ['Too many incorrect attempts. Please request a new code. · 嘗試次數過多，請重新申請驗證碼。'],
            ]);
        }

        // Validate
        if (! Hash::check($data['code'], $row->code_hash)) {
            DB::table('email_verification_codes')
                ->where('email', $data['email'])
                ->update(['attempts' => DB::raw('attempts + 1')]);
            throw ValidationException::withMessages([
                'code' => ['Incorrect code. Please try again. · 驗證碼錯誤，請再試。'],
            ]);
        }

        // Success — clear code, mark user verified, issue token.
        DB::table('email_verification_codes')->where('email', $data['email'])->delete();

        $user = User::where('email', $data['email'])->first();
        if (! $user) {
            // Race condition: account was deleted between code issue and verify.
            throw ValidationException::withMessages(['email' => ['Account not found.']]);
        }

        $user->forceFill(['email_verified_at' => now()])->save();
        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('api', [$user->role])->plainTextToken;

        try {
            DB::table('audit_logs')->insert([
                'user_id'     => $user->id,
                'action'      => 'auth.email_verified',
                'target_type' => 'user',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) { /* audit_logs missing? ignore */ }

        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }

        return response()->json([
            'user'  => $user,
            'token' => $token,
            'must_change_password' => (bool) $user->must_change_password,
        ]);
    }

    /**
     * Brief #16e — re-issue a verification code. Rate-limited via
     * Cache to prevent abuse (max 3 reissues per 15 min per email).
     * Always returns 200 to avoid email-enumeration.
     */
    public function resendVerificationCode(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        $rateKey = 'verify_resend:' . strtolower($data['email']);
        $count = (int) Cache::get($rateKey, 0);
        if ($count >= self::CODE_MAX_REISSUES) {
            return response()->json([
                'message' => 'Too many code requests. Please wait 15 minutes before requesting another. · 申請次數過多，請等候15分鐘再試。',
            ], 429);
        }

        $user = User::where('email', $data['email'])->first();
        if ($user && ! $user->email_verified_at) {
            $code = $this->issueVerificationCode($user->email);
            $this->sendVerificationEmail($user->email, $code);
            Cache::put($rateKey, $count + 1, now()->addMinutes(self::CODE_TTL_MINUTES));
        }

        return response()->json([
            'message' => 'If an unverified account exists for that email, a new code has been sent. · 若該電郵存在未驗證帳戶，新驗證碼已寄出。',
        ]);
    }

    /**
     * Login — accepts either an email address OR a phone number in the
     * "identifier" field. The frontend submits a single field so the
     * user doesn't have to pick which method they used to sign up.
     *
     * Brief #16e — refuses to log in unverified email accounts. Returns
     * a 403 with {requires_verification: true, email} so the frontend
     * can route to the verify-code screen instead of just showing
     * "invalid credentials".
     */
    public function login(Request $request)
    {
        $data = $request->validate([
            // Accept legacy "email" field for backwards compat as well
            'identifier' => ['nullable', 'string', 'max:190'],
            'email'      => ['nullable', 'string', 'max:190'],
            'password'   => ['required', 'string'],
        ]);

        $identifier = trim($data['identifier'] ?? $data['email'] ?? '');
        if ($identifier === '') {
            throw ValidationException::withMessages([
                'identifier' => ['Enter your email or phone number.'],
            ]);
        }

        // Account lockout — after 5 failed attempts in 15 minutes,
        // refuse any further attempts for that ip+identifier pair.
        $lockoutKey = 'login_lockout:' . $request->ip() . ':' . strtolower($identifier);
        $attempts = (int) Cache::get($lockoutKey, 0);
        if ($attempts >= 5) {
            return response()->json([
                'message' => 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes or reset your password. · 登入失敗次數過多，帳號已暫時鎖定 15 分鐘，可重設密碼解鎖。',
            ], 423); // HTTP 423 Locked
        }

        // Detect whether the identifier looks like an email vs a phone number.
        $user = null;
        if (filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
            $user = User::where('email', $identifier)->first();
        } else {
            $phone = $this->normalizePhone($identifier);
            $profile = DB::table('patient_profiles')->where('phone', $phone)->first();
            if ($profile) {
                $user = User::find($profile->user_id);
            }
        }

        if (! $user || ! Hash::check($data['password'], $user->password_hash)) {
            Cache::put($lockoutKey, $attempts + 1, now()->addMinutes(15));
            Log::warning('failed_login', [
                'identifier' => $identifier,
                'ip'         => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 200),
                'attempt'    => $attempts + 1,
            ]);
            try {
                DB::table('audit_logs')->insert([
                    'user_id'     => $user?->id,
                    'action'      => 'auth.login.failed',
                    'target_type' => 'user',
                    'target_id'   => $user?->id,
                    'payload'     => json_encode([
                        'identifier' => $identifier,
                        'ip'         => $request->ip(),
                        'attempt'    => $attempts + 1,
                    ]),
                    'created_at'  => now(),
                ]);
            } catch (\Throwable $e) { /* audit_logs missing? ignore */ }

            throw ValidationException::withMessages([
                'identifier' => ['Invalid credentials.'],
            ]);
        }

        // Brief #16e — block unverified accounts. Re-issue a fresh
        // code so the user has something usable when they switch to
        // the verify panel. Existing users (created before this brief
        // shipped) were grandfathered to email_verified_at = created_at
        // by the migration, so this only blocks NEW registrations.
        if (! $user->email_verified_at) {
            $code = $this->issueVerificationCode($user->email);
            $this->sendVerificationEmail($user->email, $code);
            return response()->json([
                'message'              => 'Please verify your email first. We just sent a new 6-digit code. · 請先驗證電郵，新驗證碼已寄出。',
                'requires_verification' => true,
                'email'                => $user->email,
            ], 403);
        }

        // Success — clear lockout
        Cache::forget($lockoutKey);

        if ($user->status === 'suspended' || $user->status === 'deleted') {
            throw ValidationException::withMessages([
                'identifier' => ['Account is not available.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('api', [$user->role])->plainTextToken;

        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }
        return response()->json([
            'user'  => $user,
            'token' => $token,
            'must_change_password' => (bool) $user->must_change_password,
        ]);
    }

    /**
     * Step 1 of forgot-password: user submits their email; we mint a
     * 6-digit code, hash it into password_resets, and email it.
     *
     * Brief #16f — replaces the previous magic-link flow. Codes are
     * better mobile UX than reset URLs because the user stays on the
     * same browser/page.
     *
     * Always returns a generic 200 so the endpoint can't enumerate
     * which emails have accounts.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        $this->ensurePasswordResetsTable();

        $user = User::where('email', $data['email'])->first();
        if ($user) {
            $code = $this->generateNumericCode(self::CODE_LENGTH);

            DB::table('password_resets')->where('email', $user->email)->delete();
            DB::table('password_resets')->insert([
                'email'      => $user->email,
                'token'      => Hash::make($code),
                'created_at' => now(),
            ]);

            try {
                Mail::raw(
                    "Hello,\n\n" .
                    "Your HansMed password reset code is: " . $code . "\n\n" .
                    "Enter this code along with your new password on the reset screen. The code expires in " . self::CODE_TTL_MINUTES . " minutes.\n\n" .
                    "If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.\n\n" .
                    "HansMed Modern TCM\nsupport@hansmedtcm.com",
                    function ($m) use ($user) {
                        $m->to($user->email)->subject('Your HansMed password reset code');
                    }
                );
            } catch (\Throwable $e) {
                Log::warning('password_reset_email_failed', ['email' => $user->email, 'err' => $e->getMessage()]);
            }

            try {
                DB::table('audit_logs')->insert([
                    'user_id'     => $user->id,
                    'action'      => 'auth.forgot_password.requested',
                    'target_type' => 'user',
                    'target_id'   => $user->id,
                    'created_at'  => now(),
                ]);
            } catch (\Throwable $e) { /* fine */ }
        }

        return response()->json([
            'message' => 'If that email is registered, a 6-digit reset code has been sent. Check your inbox (and spam folder). · 如該電郵已註冊，6位數重設碼已寄出，請查收（亦請檢查垃圾郵件夾）。',
        ]);
    }

    /**
     * Step 2 of forgot-password: user submits email + 6-digit code +
     * new password. Code is validated against the hashed copy, expires
     * after CODE_TTL_MINUTES, and all Sanctum tokens for that user are
     * revoked on success (forces re-login from every device).
     *
     * Brief #16f — accepts a 'code' field instead of 'token'. The
     * password_resets row schema is unchanged; the column 'token'
     * just stores a bcrypt hash of a 6-digit string now instead of
     * a 64-char token.
     */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email'    => ['required', 'email', 'max:190'],
            'code'     => ['required', 'string', 'regex:/^\d{' . self::CODE_LENGTH . '}$/'],
            'password' => self::passwordRules(),
        ], [
            'code.regex'     => 'Please enter the 6-digit code from your email. · 請輸入電郵中的6位數驗證碼。',
            'password.regex' => 'Password must contain at least one uppercase letter, one number, and one symbol. · 密碼必須包含大寫字母、數字及符號。',
        ]);

        $this->ensurePasswordResetsTable();

        $row = DB::table('password_resets')->where('email', $data['email'])->first();
        if (! $row) {
            throw ValidationException::withMessages([
                'code' => ['Reset code is invalid or has expired. Please request a new one. · 重設碼無效或已過期，請重新申請。'],
            ]);
        }
        if (now()->diffInMinutes($row->created_at) > self::CODE_TTL_MINUTES) {
            DB::table('password_resets')->where('email', $data['email'])->delete();
            throw ValidationException::withMessages([
                'code' => ['Reset code has expired. Please request a new one. · 重設碼已過期，請重新申請。'],
            ]);
        }
        if (! Hash::check($data['code'], $row->token)) {
            throw ValidationException::withMessages([
                'code' => ['Reset code is incorrect. · 重設碼不正確。'],
            ]);
        }

        $user = User::where('email', $data['email'])->first();
        if (! $user) {
            throw ValidationException::withMessages(['email' => ['No account for this email.']]);
        }

        $user->update(['password_hash' => Hash::make($data['password'])]);
        // Resetting password also verifies the email — they proved access.
        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        try { $user->tokens()->delete(); } catch (\Throwable $e) { /* fine */ }

        DB::table('password_resets')->where('email', $data['email'])->delete();
        try {
            DB::table('audit_logs')->insert([
                'user_id'     => $user->id,
                'action'      => 'auth.password_reset.completed',
                'target_type' => 'user',
                'target_id'   => $user->id,
                'created_at'  => now(),
            ]);
        } catch (\Throwable $e) { /* fine */ }

        return response()->json([
            'message' => 'Password reset. You can now sign in with your new password. · 密碼已重設，現在可使用新密碼登入。',
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $relation = $user->role . 'Profile';
        if (method_exists($user, $relation)) {
            $user->load($relation);
        }
        return response()->json(['user' => $user]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['ok' => true]);
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    /** Strip formatting so "+60 12-345 6789" matches "+60123456789". */
    private function normalizePhone(string $phone): string
    {
        return preg_replace('/[^\d+]/', '', $phone) ?: '';
    }

    /** Create password_resets table on first use — idempotent. */
    private function ensurePasswordResetsTable(): void
    {
        if (Schema::hasTable('password_resets')) return;
        try {
            DB::statement("
                CREATE TABLE password_resets (
                    email      VARCHAR(190) NOT NULL PRIMARY KEY,
                    token      VARCHAR(255) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        } catch (\Throwable $e) { /* another thread raced us — fine */ }
    }

    /**
     * Generate a fresh N-digit numeric code and stash a bcrypt'd copy
     * in email_verification_codes for the given email. Overwrites any
     * existing row. Returns the plaintext code so the caller can email
     * it.
     */
    private function issueVerificationCode(string $email): string
    {
        $code = $this->generateNumericCode(self::CODE_LENGTH);
        DB::table('email_verification_codes')->updateOrInsert(
            ['email' => $email],
            [
                'code_hash'  => Hash::make($code),
                'attempts'   => 0,
                'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
                'created_at' => now(),
            ]
        );
        return $code;
    }

    /**
     * Cryptographically strong random N-digit numeric string. Uses
     * random_int (CSPRNG-backed) — never use rand() for credentials.
     */
    private function generateNumericCode(int $length): string
    {
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= (string) random_int(0, 9);
        }
        return $out;
    }

    /**
     * Send the verification code email via the configured mailer
     * (Resend in production via Brief #16d). Best-effort: on send
     * failure, log + swallow so the registration response still
     * returns 201. Caller can re-issue via /auth/resend-verification.
     */
    private function sendVerificationEmail(string $email, string $code): void
    {
        try {
            Mail::raw(
                "Hello,\n\n" .
                "Welcome to HansMed Modern TCM. Your verification code is:\n\n" .
                "    " . $code . "\n\n" .
                "Enter this 6-digit code on the verification screen to complete your registration. The code expires in " . self::CODE_TTL_MINUTES . " minutes.\n\n" .
                "If you didn't sign up for HansMed, you can safely ignore this email — your address won't be used again.\n\n" .
                "HansMed Modern TCM\nsupport@hansmedtcm.com",
                function ($m) use ($email) {
                    $m->to($email)->subject('Your HansMed verification code');
                }
            );
        } catch (\Throwable $e) {
            Log::warning('verification_email_failed', ['email' => $email, 'err' => $e->getMessage()]);
        }
    }
}
