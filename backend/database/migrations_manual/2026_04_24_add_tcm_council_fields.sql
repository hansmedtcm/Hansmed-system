-- Audit v3 response — T&CM Council registration metadata on
-- doctor_profiles. T&CM Act 2016 §14 requires every practising
-- practitioner to hold a valid registration with the T&CM Council
-- Malaysia; MOH audits can ask us to produce the number, who
-- verified it, and when. The existing license_no column is kept as
-- free-form (covers general medical license / certificate numbers);
-- these three new columns are specifically for the T&CM Council
-- registration on the practice certificate.
--
-- Run once against Railway MySQL before deploying the new backend.
-- Safe to re-run: each ADD COLUMN is guarded by an information_schema
-- existence check.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'doctor_profiles'
     AND column_name = 'tcm_council_no');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE doctor_profiles ADD COLUMN tcm_council_no VARCHAR(80) NULL AFTER license_doc_url',
  'SELECT "tcm_council_no already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'doctor_profiles'
     AND column_name = 'tcm_council_verified_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE doctor_profiles ADD COLUMN tcm_council_verified_at DATETIME NULL AFTER tcm_council_no',
  'SELECT "tcm_council_verified_at already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'doctor_profiles'
     AND column_name = 'tcm_council_verified_by');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE doctor_profiles ADD COLUMN tcm_council_verified_by BIGINT UNSIGNED NULL AFTER tcm_council_verified_at',
  'SELECT "tcm_council_verified_by already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
