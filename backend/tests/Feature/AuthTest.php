<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Day 6 reconciliation (2026-05-18): rewritten against the actual
 * AuthController behavior after Brief #16e (email verification flow)
 * and Brief #17 (public self-registration restricted to patient role).
 *
 * What the original Day 5 tests got wrong:
 *   1. Password 'password123' fails passwordRules() — needs upper +
 *      digit + symbol (see AuthController::passwordRules).
 *   2. Public register no longer returns a Sanctum token directly;
 *      it returns requires_verification=true and emails a 6-digit code
 *      (Brief #16e). Token is issued by /auth/verify-email.
 *   3. Public register blocks role=doctor and role=pharmacy entirely
 *      (Brief #17 — doctor/pharmacy accounts are admin-created only).
 *   4. Patient self-registration requires a Malaysian phone number.
 *
 * H5 discipline marker (CLAUDE.md): controller was read before the
 * tests were written this time.
 */
class AuthTest extends TestCase
{
    /**
     * Happy-path registration. Asserts shape + status, doesn't try to
     * log in immediately (login requires email-verified status; the
     * verification flow is exercised by its own test below).
     */
    public function test_patient_can_register_and_receive_verification_prompt(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'email'    => 'newp@test.com',
            'password' => 'Password123!',
            'role'     => 'patient',
            'phone'    => '+60123456789',
            'nickname' => 'Bob',
        ]);

        $res->assertCreated()
            ->assertJsonPath('requires_verification', true)
            ->assertJsonPath('email', 'newp@test.com')
            ->assertJsonStructure(['user' => ['id', 'email', 'role']]);

        // User row exists, status='active' for patients (doctor/pharmacy
        // start 'pending' for admin approval — see AuthController:102).
        $this->assertDatabaseHas('users', [
            'email' => 'newp@test.com',
            'role'  => 'patient',
        ]);
    }

    /**
     * Brief #17 hardening — public self-registration as doctor must be
     * blocked at the validation layer (not just rejected at login).
     * Without this guard, anyone with curl could create a doctor
     * account by passing role=doctor.
     */
    public function test_doctor_self_registration_is_forbidden(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'email'     => 'newd@test.com',
            'password'  => 'Password123!',
            'role'      => 'doctor',
            'phone'     => '+60123456789',
            'full_name' => 'Dr. Test',
        ]);

        $res->assertStatus(422);
        $this->assertDatabaseMissing('users', ['email' => 'newd@test.com']);
    }

    /**
     * Login uses the standard Sanctum flow. We bypass the email-
     * verification step by inserting a user with email_verified_at
     * already set, which is what the verify-email endpoint does in
     * the real flow.
     */
    /**
     * Login uses the standard Sanctum flow. email_verified_at must be
     * set directly (not via User::create fillable — it's not on the
     * fillable list since the verify-email endpoint owns that field)
     * because login() re-issues a verification code if it sees the
     * user as unverified, which means it writes to
     * email_verification_codes and breaks if that table is missing
     * its row pattern.
     */
    public function test_verified_patient_can_login(): void
    {
        $user = User::create([
            'email'         => 'verified@test.com',
            'password_hash' => Hash::make('Password123!'),
            'role'          => 'patient',
            'status'        => 'active',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $res = $this->postJson('/api/auth/login', [
            'email'    => 'verified@test.com',
            'password' => 'Password123!',
        ]);

        $res->assertOk()
            ->assertJsonPath('user.role', 'patient')
            ->assertJsonStructure(['user' => ['id', 'email', 'role'], 'token']);
    }

    /** The /auth/me endpoint must reject requests without a Sanctum token. */
    public function test_me_endpoint_requires_token(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }
}
