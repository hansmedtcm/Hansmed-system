<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests POST /api/admin/migrate/run-pending added in commit ff6b1be (Day 2).
 * This endpoint is the manual fallback for the Dockerfile auto-migrate chain
 * shipped in commit 4869eee.
 *
 * Security posture: must require auth:sanctum + manage_users permission.
 * If this gate breaks, ANY logged-in user could trigger Artisan migrate on
 * production — that's the failure mode this test protects against.
 */
class MigrationRunnerTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function unauthenticated_request_is_rejected(): void
    {
        $this->postJson('/api/admin/migrate/run-pending')
             ->assertStatus(401);
    }

    /** @test */
    public function patient_role_is_rejected(): void
    {
        $patient = User::factory()->create(['role' => 'patient']);
        $this->actingAs($patient, 'sanctum');

        $this->postJson('/api/admin/migrate/run-pending')
             ->assertStatus(403);
    }

    /** @test */
    public function doctor_role_is_rejected(): void
    {
        $doctor = User::factory()->create(['role' => 'doctor']);
        $this->actingAs($doctor, 'sanctum');

        $this->postJson('/api/admin/migrate/run-pending')
             ->assertStatus(403);
    }

    /** @test */
    public function pharmacy_role_is_rejected(): void
    {
        $pharmacy = User::factory()->create(['role' => 'pharmacy']);
        $this->actingAs($pharmacy, 'sanctum');

        $this->postJson('/api/admin/migrate/run-pending')
             ->assertStatus(403);
    }

    /** @test */
    public function admin_with_manage_users_permission_can_run_migrations(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin@hansmed.com',  // master account — auto-grants all perms
            'role'  => 'admin',
        ]);
        $this->actingAs($admin, 'sanctum');

        $res = $this->postJson('/api/admin/migrate/run-pending');

        // Successful response: either 200 (migrations ran cleanly) or 200 with empty log
        // The route returns 200 either way and reports `log` + `errors` arrays.
        $res->assertOk()
            ->assertJsonStructure(['log', 'errors']);
    }
}
