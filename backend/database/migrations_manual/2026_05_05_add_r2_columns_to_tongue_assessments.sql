-- Brief 1A Phase 2 — extend tongue_assessments for R2 + PDPA.
--
-- Mirrors the Laravel migration at
--   database/migrations/2026_05_05_000001_add_r2_columns_to_tongue_assessments_table.php
-- This raw SQL file is what actually runs on production (project
-- convention: apply migrations_manual/*.sql by hand against MySQL).
--
-- Adds:
--   - r2_key      VARCHAR(500) NULL after image_url
--                 — Cloudflare R2 object key for the new upload flow.
--                   Null on legacy rows (they keep using image_url +
--                   the AnthropicTongueClient filesystem fallback).
--   - consent_text TEXT NULL after r2_key
--                 — verbatim consent copy at upload time (PDPA audit).
--   - consented_at TIMESTAMP NULL after consent_text
--                 — when the patient ticked the consent box.
--   - deleted_at  TIMESTAMP NULL  (Laravel SoftDeletes convention)
--                 — set when the patient invokes PDPA right of erasure.
--                   Sensitive fields are scrubbed at delete time, the
--                   row stays for audit.
--
-- Index on r2_key supports the post-delete Storage::disk('r2')->delete()
-- key lookup. Non-unique because legacy rows have null (multiple nulls
-- are valid in MySQL non-unique indexes).
--
-- NOT idempotent on this stack. Production MySQL is 9.4.0, which
-- (despite docs) rejects `ADD COLUMN IF NOT EXISTS` with a syntax
-- error — empirically observed during initial apply on 2026-05-05.
-- So statements below are plain ADD COLUMN / CREATE INDEX. Re-running
-- on a DB that already has the columns will throw "Duplicate column
-- name" or "Duplicate key name" — harmless, but you'll need to skip
-- past the failures or DROP first.
--
-- For fresh installs, the columns are defined in database/schema.sql
-- already (kept in sync as part of this brief), so this file is only
-- for upgrading an existing database.

ALTER TABLE tongue_assessments ADD COLUMN r2_key       VARCHAR(500) NULL AFTER image_url;
ALTER TABLE tongue_assessments ADD COLUMN consent_text TEXT         NULL AFTER r2_key;
ALTER TABLE tongue_assessments ADD COLUMN consented_at TIMESTAMP    NULL AFTER consent_text;
ALTER TABLE tongue_assessments ADD COLUMN deleted_at   TIMESTAMP    NULL AFTER updated_at;

CREATE INDEX idx_ta_r2_key ON tongue_assessments (r2_key);
