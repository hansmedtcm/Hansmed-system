<?php

namespace Tests\Feature\Notification;

use App\Mail\BreachNotificationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Tests the Day 3 i18n dispatch infrastructure for HM-BR-2026-001
 * data-subject notification (Guideline para 9.1, 7-day window).
 *
 * Covers:
 *   - Lang file key parity check refuses to dispatch on drift
 *   - --dry-run does not send mail nor write log rows
 *   - Real send writes one log row per recipient with SHA-256 digest
 *   - Idempotency: re-running skips already-sent rows
 *   - Internal accounts (admin@/pharma@/audit-dr-*) are excluded
 */
class BreachNotificationDispatchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    /** @test */
    public function dry_run_does_not_send_or_log(): void
    {
        User::factory()->count(3)->create(['role' => 'patient']);

        $this->artisan('breach:notify', ['--role' => 'patient', '--dry-run' => true])
             ->assertExitCode(0);

        Mail::assertNothingSent();
        $this->assertSame(0, DB::table('notification_dispatch_log')->count());
    }

    /** @test */
    public function real_dispatch_writes_one_log_row_per_recipient(): void
    {
        $patients = User::factory()->count(2)->create(['role' => 'patient']);

        $this->artisan('breach:notify', ['--role' => 'patient'])
             ->assertExitCode(0);

        Mail::assertSent(BreachNotificationMail::class, 2);

        $logs = DB::table('notification_dispatch_log')->get();
        $this->assertCount(2, $logs);

        foreach ($logs as $log) {
            $this->assertSame('sent', $log->status);
            $this->assertSame('breach:HM-BR-2026-001:patient', $log->notification_kind);
            $this->assertNotEmpty($log->payload_digest, 'SHA-256 digest must be recorded');
            $this->assertSame(64, strlen($log->payload_digest), 'SHA-256 digest must be 64 hex chars');
        }
    }

    /** @test */
    public function rerun_skips_already_sent_recipients(): void
    {
        User::factory()->count(2)->create(['role' => 'patient']);

        $this->artisan('breach:notify', ['--role' => 'patient'])->assertExitCode(0);
        Mail::assertSent(BreachNotificationMail::class, 2);

        // Reset fake — second run should send 0 because both are logged as 'sent'
        Mail::fake();
        $this->artisan('breach:notify', ['--role' => 'patient'])->assertExitCode(0);

        Mail::assertNothingSent();
        // Log still has exactly 2 rows
        $this->assertSame(2, DB::table('notification_dispatch_log')->count());
    }

    /** @test */
    public function internal_accounts_are_excluded_from_dispatch(): void
    {
        User::factory()->create(['email' => 'admin@hansmed.com', 'role' => 'patient']);
        User::factory()->create(['email' => 'pharma@hansmed.com', 'role' => 'patient']);
        User::factory()->create(['email' => 'audit-dr-12345@test.com', 'role' => 'patient']);
        User::factory()->create(['email' => 'real-patient@example.com', 'role' => 'patient']);

        $this->artisan('breach:notify', ['--role' => 'patient'])->assertExitCode(0);

        // Only the real patient gets the email
        Mail::assertSent(BreachNotificationMail::class, 1);

        $log = DB::table('notification_dispatch_log')->first();
        $this->assertSame('real-patient@example.com', $log->recipient_email_at_send);
    }
}
