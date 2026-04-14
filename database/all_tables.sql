-- ============================================================
-- HansMed TCM — Complete DB setup (additional tables beyond schema.sql)
-- Run this in Railway MySQL to ensure all tables exist
-- ============================================================

-- POS Sales (walk-in, OTC, prescription dispensing)
CREATE TABLE IF NOT EXISTS pos_sales (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_no         VARCHAR(40) NOT NULL UNIQUE,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  cashier_id      BIGINT UNSIGNED NOT NULL,
  patient_name    VARCHAR(120) NULL,
  patient_id      BIGINT UNSIGNED NULL,
  prescription_id BIGINT UNSIGNED NULL,
  sale_type       ENUM('walk_in','otc','prescription') NOT NULL DEFAULT 'walk_in',
  payment_method  ENUM('cash','card','ewallet_tng','ewallet_grab','ewallet_shopee','fpx') NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  tax             DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  amount_received DECIMAL(10,2) NOT NULL,
  change_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes           VARCHAR(500) NULL,
  items           JSON NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pos_pharm FOREIGN KEY (pharmacy_id) REFERENCES users(id),
  KEY idx_pos_pharm_date (pharmacy_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chat threads (patient ↔ doctor)
CREATE TABLE IF NOT EXISTS chat_threads (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     BIGINT UNSIGNED NOT NULL,
  doctor_id      BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  status         ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ct_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT fk_ct_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id),
  KEY idx_ct_patient (patient_id),
  KEY idx_ct_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id  BIGINT UNSIGNED NOT NULL,
  sender_id  BIGINT UNSIGNED NOT NULL,
  message    TEXT NOT NULL,
  image_url  VARCHAR(500) NULL,
  read_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  KEY idx_cm_thread_created (thread_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit logs (all admin actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  action      VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id   BIGINT UNSIGNED NULL,
  ip_address  VARCHAR(45) NULL,
  user_agent  VARCHAR(255) NULL,
  payload     JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_al_user (user_id),
  KEY idx_al_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System configs (if not created yet — uses config_key/config_value)
CREATE TABLE IF NOT EXISTS system_configs (
  config_key   VARCHAR(120) PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Patient profile — extended columns for healthcare registration
-- (run only if columns don't already exist; will fail silently if they do)
ALTER TABLE patient_profiles
  ADD COLUMN IF NOT EXISTS registration_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER user_id,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS ic_number VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS city VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS state VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS country VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(60) NULL,
  ADD COLUMN IF NOT EXISTS blood_type VARCHAR(10) NULL,
  ADD COLUMN IF NOT EXISTS allergies TEXT NULL,
  ADD COLUMN IF NOT EXISTS medical_history TEXT NULL,
  ADD COLUMN IF NOT EXISTS current_medications TEXT NULL,
  ADD COLUMN IF NOT EXISTS family_history TEXT NULL;
