-- Brief #16 — per-user voucher redemption tracking + per-user limit.
--
-- Adds a new voucher_redemptions table (source of truth for "has this
-- specific user already redeemed this voucher?") and a per_user_limit
-- column on vouchers (configurable cap, default 1, NULL = unlimited).
--
-- The denormalised vouchers.redemption_count counter stays put for
-- backward compatibility and admin display; the new table is the
-- source of truth for per-user counts.
--
-- For fresh installs that auto-create the vouchers table via the
-- VoucherController::ensureTable() path, the same logic now also
-- creates voucher_redemptions and ensures per_user_limit exists.

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  voucher_id      BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  ref_type        VARCHAR(32) NULL,
  ref_id          BIGINT UNSIGNED NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  redeemed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_vr_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_vr_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,

  INDEX idx_vr_voucher_user  (voucher_id, user_id),
  INDEX idx_vr_voucher_when  (voucher_id, redeemed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add per_user_limit column to existing vouchers table.
-- Default 1 = each user can redeem the voucher exactly once.
-- NULL = no per-user cap (legacy "unlimited per person" behaviour).
-- Use ALTER TABLE ... ADD COLUMN IF NOT EXISTS where supported, else
-- guard manually — MySQL 8.0+ supports the IF NOT EXISTS form, MariaDB
-- ditto. On older MySQL the duplicate-column error is harmless on re-run.
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS per_user_limit SMALLINT UNSIGNED NULL DEFAULT 1
  AFTER max_redemptions;
