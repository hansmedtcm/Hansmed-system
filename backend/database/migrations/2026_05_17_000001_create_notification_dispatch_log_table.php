<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * notification_dispatch_log
 *
 * Audit-grade record of every notification sent by the platform that has
 * compliance or evidentiary significance. Initial use case: HM-BR-2026-001
 * data-subject and practitioner breach notifications (PDPA s.12B + DBN
 * Guideline para 9.1), where each send needs a defensible audit trail.
 *
 * Designed for the 8 PHI-encryption + audit-trail commits shipped on Day 2:
 * - One row per dispatch, never per attempt (failure cases get a separate
 *   row with status='failed' rather than mutating the original)
 * - Unique constraint (notification_kind, user_id) prevents accidental
 *   double-sends. The Artisan dispatch command refuses to insert a second
 *   row for the same (kind, user) pair, so an interrupted batch can be
 *   safely re-run.
 * - `payload_digest` is a SHA-256 of the rendered content at send time —
 *   future evidence that the exact wording sent matches the counsel-reviewed
 *   wording in the breach register.
 *
 * Schema kept generic enough to support future regulator-grade notifications
 * (consent withdrawals, account closures, future breach events) without
 * needing another table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_dispatch_log', function (Blueprint $table) {
            $table->id();

            // Categorisation
            $table->string('notification_kind', 64)->index();
            // Convention: 'breach:HM-BR-2026-001:patient' or
            // 'breach:HM-BR-2026-001:practitioner'. The colon-segmented
            // form lets us filter by family later.

            // Recipient
            $table->foreignId('user_id')
                  ->constrained('users')
                  ->cascadeOnDelete();
            $table->string('recipient_email_at_send', 255);
            // We store the email at the time of send rather than relying on
            // users.email — in case the user later changes their email and
            // we need to prove WHERE the notification went.

            // Dispatch
            $table->string('status', 32)->default('queued');
            // queued | sent | failed | bounced
            $table->string('locale', 8)->default('en');
            // Future: when per-user language_preference exists, record which
            // locale the email body led with. Bilingual sends record 'en'
            // (canonical) here.
            $table->string('mailer_message_id', 255)->nullable();
            $table->timestamp('dispatched_at')->nullable();

            // Evidence
            $table->char('payload_digest', 64)->nullable();
            // SHA-256 hex of the rendered body — proves what was sent.
            $table->text('failure_reason')->nullable();

            // Operator audit (who triggered the dispatch)
            $table->foreignId('triggered_by_user_id')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();
            $table->string('triggered_via', 32)->default('artisan');
            // artisan | controller | scheduled

            $table->timestamps();

            $table->unique(['notification_kind', 'user_id'], 'uq_notification_per_user');
            $table->index(['notification_kind', 'status']);
            $table->index('dispatched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_dispatch_log');
    }
};
