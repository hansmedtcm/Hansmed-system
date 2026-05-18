<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Fix notification_dispatch_log for PDPA audit compliance.
 *
 * Two changes — both surfaced by the Monday 2026-05-18 code-review pass
 * on the Day 3 i18n infrastructure that landed in commit 40ff980.
 *
 * 1. user_id FK: cascadeOnDelete → nullOnDelete.
 *
 *    The original migration (2026_05_17_000001) used cascadeOnDelete on
 *    user_id. If a patient ever exercises a right-to-erasure request
 *    under PDPA s.39 and the user row is hard-deleted, every breach-
 *    notification audit row referencing them would disappear too —
 *    destroying the evidence that the breach notification was actually
 *    sent. PDPA s.12B(8) and DBN Guideline para 9.1 require the data
 *    controller to retain proof of notification.
 *
 *    Fix: make user_id nullable and switch the FK to nullOnDelete. The
 *    recipient_email_at_send column already preserves the recipient
 *    identity at dispatch time, so the row remains evidentially useful
 *    after user deletion.
 *
 * 2. Add triggered_by_os_user (varchar): capture OS user for CLI runs.
 *
 *    DispatchBreachNotification calls auth()->user() to populate
 *    triggered_by_user_id, but auth() returns null when invoked from
 *    Artisan (the only way the command currently runs). The column
 *    was always null and an auditor's "who ran the dispatch" question
 *    had no answer. Adding a separate text column populated from
 *    get_current_user() gives CLI runs a real operator identifier.
 *    triggered_by_user_id stays for the future case where a controller
 *    method also triggers dispatch from a web session.
 */
return new class extends Migration {

    public function up(): void
    {
        Schema::table('notification_dispatch_log', function (Blueprint $table) {
            // Drop the existing FK + add a new nullable one with nullOnDelete.
            // Foreign-key drop in Laravel 11 requires the constraint name; if
            // the original migration used the default name we can drop by
            // column; otherwise the explicit constraint name is needed.
            $table->dropForeign(['user_id']);
        });

        // Make user_id nullable (separate Schema::table because mixing
        // dropForeign and change() in one closure can produce ordering
        // surprises across drivers).
        Schema::table('notification_dispatch_log', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
        });

        Schema::table('notification_dispatch_log', function (Blueprint $table) {
            $table->foreign('user_id')
                  ->references('id')
                  ->on('users')
                  ->nullOnDelete();

            // CLI-run operator identification. get_current_user() returns
            // the OS user that owns the running PHP process — for Railway
            // it'll be the container user, for local dev it'll be the
            // developer's username. Either is meaningful audit data.
            $table->string('triggered_by_os_user', 64)
                  ->nullable()
                  ->after('triggered_by_user_id');
        });
    }

    public function down(): void
    {
        // Reversing the user_id change is intentionally NOT a true rollback
        // — restoring cascadeOnDelete would re-introduce the audit-evidence
        // destruction we just fixed. Down() leaves user_id nullable + nullOnDelete
        // (the safer state) and only removes the OS-user column.
        Schema::table('notification_dispatch_log', function (Blueprint $table) {
            $table->dropColumn('triggered_by_os_user');
        });
    }
};
