-- 2026-05-18 — Add ai_training_consent to tongue_assessments
--
-- Separate opt-in for AI model training dataset, distinct from the
-- treatment consent already captured in consent_text / consented_at.
-- Stored per-assessment so we know exactly which R2 images are
-- training-eligible, independent of any future consent_grant revocations.
--
-- DEFAULT 0 means all historical rows are correctly marked as NOT consented
-- for training — we never retroactively include images the patient didn't
-- explicitly opt in to.
--
-- Run on production Railway MySQL before deploying the matching backend code.

ALTER TABLE tongue_assessments
  ADD COLUMN ai_training_consent TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Patient opt-in for AI model training dataset (separate from treatment consent).'
  AFTER consented_at;
