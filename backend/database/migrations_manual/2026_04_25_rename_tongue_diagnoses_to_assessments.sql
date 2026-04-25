-- Backend rename sprint — tongue_diagnoses → tongue_assessments
-- See BACKEND_RENAME_TODO.md and AUDIT_V3_RESPONSE.md for context.
--
-- The PHP code in this deploy expects the new table + column names.
-- The class_alias() lines we added in the model/job/controller files
-- mean any old code path still resolves, but the DB names are
-- authoritative — they MUST be renamed before the new code goes
-- live or queries will fail.
--
-- Run this BEFORE the Railway redeploy completes (it'll auto-redeploy
-- when you push, so realistically run it within a minute of the push,
-- or pause Railway autodeploy first).
--
-- Idempotent: each rename is guarded with information_schema checks.
-- Safe to re-run.

-- ==========================================================
-- 1) Rename the main table.
-- ==========================================================
SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'tongue_diagnoses');
SET @new_exists := (
  SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE() AND table_name = 'tongue_assessments');
SET @sql := IF(@table_exists = 1 AND @new_exists = 0,
  'RENAME TABLE tongue_diagnoses TO tongue_assessments',
  'SELECT "tongue table already renamed (or both names present — manual review needed)" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==========================================================
-- 2) Rename the FK column on appointments.
--    appointments.tongue_diagnosis_id → tongue_assessment_id
--    Use CHANGE COLUMN so the type stays identical.
-- ==========================================================
SET @col_old := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'appointments'
     AND column_name = 'tongue_diagnosis_id');
SET @col_new := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'appointments'
     AND column_name = 'tongue_assessment_id');
SET @sql := IF(@col_old = 1 AND @col_new = 0,
  'ALTER TABLE appointments CHANGE COLUMN tongue_diagnosis_id tongue_assessment_id BIGINT UNSIGNED NULL',
  'SELECT "appointments column already renamed" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==========================================================
-- 3) Verify (selects only — safe to leave in)
-- ==========================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'tongue_assessments') AS new_table_present,
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'tongue_diagnoses') AS old_table_present,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'appointments'
      AND column_name = 'tongue_assessment_id') AS new_column_present,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'appointments'
      AND column_name = 'tongue_diagnosis_id') AS old_column_present;
