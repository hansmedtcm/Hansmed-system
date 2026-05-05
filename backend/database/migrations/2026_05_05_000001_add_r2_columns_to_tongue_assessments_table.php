<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Brief 1A Phase 2 — extend tongue_assessments for R2 + PDPA.
 *
 * Adds 4 things:
 *   - r2_key (VARCHAR(500)) — Cloudflare R2 object key for the new
 *     direct-upload flow. Legacy rows have null here and continue to
 *     resolve via the existing image_url + filesystem fallback.
 *   - consent_text (TEXT) — verbatim copy of the consent the patient
 *     ticked at upload time (PDPA Section 8 cross-border-transfer audit).
 *   - consented_at (TIMESTAMP) — when they ticked it.
 *   - deleted_at via softDeletes() — patients can request erasure under
 *     PDPA right of erasure; we soft-delete + scrub sensitive fields
 *     rather than hard-delete so the row remains for audit (deleted_at,
 *     consented_at, etc. preserved).
 *
 * Index on r2_key so the post-delete `Storage::disk('r2')->delete($key)`
 * lookup hits an index when the controller resolves the assessment row
 * by key (see Phase 5 destroy() flow). Non-unique because multiple null
 * legacy rows are valid; the index just supports lookups, not uniqueness.
 *
 * IMPORTANT: this project applies migrations via raw SQL files in
 * `database/migrations_manual/` rather than `php artisan migrate`. The
 * Laravel migration here exists for parity / future tooling; the SQL
 * file `2026_05_05_add_r2_columns_to_tongue_assessments.sql` is what
 * actually runs on the database. Keep both in sync if you edit one.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('tongue_assessments', function (Blueprint $table) {
            $table->string('r2_key', 500)->nullable()->after('image_url');
            $table->text('consent_text')->nullable()->after('r2_key');
            $table->timestamp('consented_at')->nullable()->after('consent_text');
            $table->softDeletes();           // adds deleted_at TIMESTAMP NULL
            $table->index('r2_key', 'idx_ta_r2_key');
        });
    }

    public function down(): void
    {
        Schema::table('tongue_assessments', function (Blueprint $table) {
            $table->dropIndex('idx_ta_r2_key');
            $table->dropSoftDeletes();       // drops deleted_at
            $table->dropColumn(['consented_at', 'consent_text', 'r2_key']);
        });
    }
};
