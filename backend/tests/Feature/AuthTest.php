<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_patient_can_register_and_login(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'email'    => 'newp@test.com',
            'password' => 'password123',
            'role'     => 'patient',
            'nickname' => 'Bob',
        ]);
        $res->assertCreated()->assertJsonStructure(['user' => ['id', 'email', 'role'], 'token']);

        $login = $this->postJson('/api/auth/login', [
            'email'    => 'newp@test.com',
            'password' => 'password123',
        ]);
        $login->assertOk()->assertJsonPath('user.role', 'patient');
    }

    public function test_doctor_starts_pending_and_cannot_login(): void
    {
        $this->postJson('/api/auth/register', [
            'email'     => 'newd@test.com',
            'password'  => 'password123',
            'role'      => 'doctor',
            'full_name' => 'Dr. Test',
        ])->assertCreated();

        $login = $this->postJson('/api/auth/login', [
            'email'    => 'newd@test.com',
            'password' => 'password123',
        ]);
        $login->assertStatus(422);
    }

    public function test_me_endpoint_requires_token(): void
    {
        $this->getJson('/api/auth/me')->assertStatus(401);
    }
}
