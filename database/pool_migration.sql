-- ============================================================
-- HansMed Pool Booking Migration
-- Run this ONCE on Railway MySQL to enable pool-based booking.
-- Safe to re-run (uses IF NOT EXISTS / tolerates already-applied state).
-- ============================================================

-- 1. Allow doctor_id to be NULL so pool appointments can wait for a doctor
ALTER TABLE appointments MODIFY COLUMN doctor_id BIGINT UNSIGNED NULL;

-- 2. Add pool-related columns
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS concern               VARCHAR(60)  NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS concern_label         VARCHAR(120) NULL AFTER concern,
  ADD COLUMN IF NOT EXISTS recommended_specialty VARCHAR(120) NULL AFTER concern_label,
  ADD COLUMN IF NOT EXISTS is_pool               TINYINT(1)   NOT NULL DEFAULT 0 AFTER recommended_specialty;

-- 3. Index for pool queries
ALTER TABLE appointments ADD INDEX IF NOT EXISTS idx_ap_pool (is_pool, scheduled_start);
