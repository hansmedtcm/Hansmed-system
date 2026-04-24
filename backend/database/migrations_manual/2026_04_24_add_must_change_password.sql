-- BUG-015 — Force password change on first login for admin-created
-- accounts and admin-reset passwords. Run once against the Railway
-- MySQL instance; schema.sql already contains the column for fresh
-- installs.
--
-- Guard with an IF NOT EXISTS-style check (MySQL pre-8.0.29 doesn't
-- support ADD COLUMN IF NOT EXISTS directly, so use information_schema).

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name   = 'users'
    AND column_name  = 'must_change_password'
);

SET @sql := IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER last_login_at',
  'SELECT "must_change_password already present" AS note');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
