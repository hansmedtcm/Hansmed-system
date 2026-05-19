<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Day 7 #2 — HMAC chain for audit_logs.
 *
 * Adds:
 *   - audit_logs.prev_hash CHAR(64) NULL
 *   - audit_logs.row_hash  CHAR(64) NULL
 *   - new table audit_chain_head (singleton serialization point)
 *
 * Both columns are nullable during the transition window. After all 35
 * legacy DB::table('audit_logs')->insert(...) call sites are refactored
 * to App\Services\AuditLogger::log() (Commit 2) AND the one-shot
 * `php artisan audit:backfill-chain --confirm` runs against prod,
 * row_hash will be populated for every row and the AuditLogger
 * guarantees it stays populated for all future inserts.
 *
 * NOT NULL is NOT enforced at the schema layer because:
 *   (a) Backfill happens after this migration lands on Railway, so the
 *       columns must be NULLable when the migration runs.
 *   (b) A future migration tightens to NOT NULL after the backfill is
 *       complete on prod and confirmed via `audit:verify-chain` exit 0.
 *
 * Idempotent: uses Schema::hasColumn / Schema::hasTable guards so that
 * re-running on a DB where schema.sql already created the columns
 * (i.e. fresh test DB) is a no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('audit_logs', 'prev_hash')) {
            DB::statement("
                ALTER TABLE audit_logs
                  ADD COLUMN prev_hash CHAR(64) NULL AFTER payload,
                  ADD COLUMN row_hash  CHAR(64) NULL AFTER prev_hash,
                  ADD KEY idx_al_row_hash (row_hash),
                  ADD KEY idx_al_created  (created_at)
            ");
        }

        if (! Schema::hasTable('audit_chain_head')) {
            DB::statement("
                CREATE TABLE audit_chain_head (
                  id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
                  last_id     BIGINT UNSIGNED NULL,
                  last_hash   CHAR(64) NULL,
                  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  CONSTRAINT chk_audit_chain_head_singleton CHECK (id = 1)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            DB::statement("
                INSERT IGNORE INTO audit_chain_head (id, last_id, last_hash)
                VALUES (1, NULL, NULL)
            ");
        }
    }

    public function down(): void
    {
        // Defensive: dropping the chain table forfeits forensic integrity.
        // Refuse unless the caller explicitly sets the env var.
        if (env('HANSMED_ALLOW_AUDIT_CHAIN_ROLLBACK') !== 'yes-i-really-mean-it') {
            throw new \RuntimeException(
                'Refusing to roll back HMAC audit chain. Set ' .
                'HANSMED_ALLOW_AUDIT_CHAIN_ROLLBACK=yes-i-really-mean-it ' .
                'if this is intentional.'
            );
        }

        Schema::dropIfExists('audit_chain_head');

        if (Schema::hasColumn('audit_logs', 'prev_hash')) {
            DB::statement("ALTER TABLE audit_logs DROP COLUMN prev_hash, DROP COLUMN row_hash");
        }
    }
};
