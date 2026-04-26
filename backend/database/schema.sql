-- HansMed TCM Platform — canonical schema (MySQL 8)
-- Covers: users/roles, tongue diagnosis, questionnaires, appointments,
-- video consultations, prescriptions, pharmacies, inventory, orders,
-- shipments, payments, withdrawals, notifications, audit, content.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- 1. AUTH & PROFILES
-- =========================================================
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(190) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('patient','doctor','pharmacy','admin') NOT NULL,
  status          ENUM('pending','active','suspended','deleted') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  remember_token  VARCHAR(100) NULL,
  last_login_at   DATETIME NULL,
  -- BUG-015: force a password change on first login after the account
  -- was created or had its password reset by an admin. Cleared to 0
  -- by the change-password endpoint. Frontend inspects this in the
  -- login response and routes to a mandatory change-password screen.
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE personal_access_tokens (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tokenable_type VARCHAR(191) NOT NULL,
  tokenable_id   BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(191) NOT NULL,
  token          VARCHAR(64) NOT NULL UNIQUE,
  abilities      TEXT NULL,
  last_used_at   DATETIME NULL,
  expires_at     DATETIME NULL,
  created_at     DATETIME NULL,
  updated_at     DATETIME NULL,
  KEY idx_pat_tokenable (tokenable_type, tokenable_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patient_profiles (
  user_id      BIGINT UNSIGNED PRIMARY KEY,
  nickname     VARCHAR(80) NULL,
  avatar_url   VARCHAR(500) NULL,
  gender       ENUM('male','female','other') NULL,
  birth_date   DATE NULL,
  phone        VARCHAR(40) NULL,
  height_cm    DECIMAL(5,2) NULL,
  weight_kg    DECIMAL(5,2) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctor_profiles (
  user_id           BIGINT UNSIGNED PRIMARY KEY,
  full_name         VARCHAR(120) NOT NULL,
  avatar_url        VARCHAR(500) NULL,
  bio               TEXT NULL,
  specialties       VARCHAR(500) NULL,
  -- license_no stores the T&CM Council Malaysia registration number
  -- (T&CM Act 2016 §14). Malaysian TCM practitioners hold a single
  -- Council-issued registration which serves as their practice
  -- licence, so we don't keep a separate column. The
  -- tcm_council_verified_* pair records the audit trail — when admin
  -- sighted the certificate and which admin user id did it.
  license_no        VARCHAR(120) NULL,
  license_doc_url   VARCHAR(500) NULL,
  -- Legacy column from an earlier design; unused now. Left in place
  -- to avoid a destructive migration on the live DB.
  tcm_council_no    VARCHAR(80) NULL,
  tcm_council_verified_at DATETIME NULL,
  tcm_council_verified_by BIGINT UNSIGNED NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rating            DECIMAL(3,2) NOT NULL DEFAULT 0,
  consultation_count INT UNSIGNED NOT NULL DEFAULT 0,
  consultation_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,
  accepting_appointments TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_doctor_status (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctor_schedules (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id   BIGINT UNSIGNED NOT NULL,
  weekday     TINYINT NOT NULL, -- 0..6
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  slot_minutes SMALLINT NOT NULL DEFAULT 30,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_ds_doctor FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_ds_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pharmacy_profiles (
  user_id        BIGINT UNSIGNED PRIMARY KEY,
  name           VARCHAR(160) NOT NULL,
  license_no     VARCHAR(120) NULL,
  license_doc_url VARCHAR(500) NULL,
  business_doc_url VARCHAR(500) NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  address_line   VARCHAR(255) NULL,
  city           VARCHAR(80) NULL,
  state          VARCHAR(80) NULL,
  country        VARCHAR(80) NULL,
  postal_code    VARCHAR(20) NULL,
  latitude       DECIMAL(10,7) NULL,
  longitude      DECIMAL(10,7) NULL,
  delivery_radius_km DECIMAL(6,2) NULL,
  business_hours VARCHAR(255) NULL,
  phone          VARCHAR(40) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_php_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_php_status (verification_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 2. HEALTH RECORDS / TONGUE WELLNESS ASSESSMENT / QUESTIONNAIRES
-- (Renamed from tongue_diagnoses on 2026-04-25 — see
--  BACKEND_RENAME_TODO.md. The table holds AI-driven wellness
--  analysis reviewed by a licensed practitioner; it is not a
--  diagnosis in the MDA 2012 sense.)
-- =========================================================
CREATE TABLE tongue_assessments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED NOT NULL,
  image_url       VARCHAR(500) NOT NULL,
  thumbnail_url   VARCHAR(500) NULL,
  third_party_request_id VARCHAR(120) NULL,
  status          ENUM('uploaded','processing','completed','failed') NOT NULL DEFAULT 'uploaded',
  -- structured result fields per PDF: 舌色/舌苔/舌形/齿痕/裂纹/润燥
  tongue_color    VARCHAR(60) NULL,
  coating         VARCHAR(60) NULL,
  shape           VARCHAR(60) NULL,
  teeth_marks     TINYINT(1) NULL,
  cracks          TINYINT(1) NULL,
  moisture        VARCHAR(60) NULL,
  raw_response    JSON NULL,
  constitution_report JSON NULL,
  health_score    SMALLINT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ta_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_ta_patient_created (patient_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE questionnaires (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id  BIGINT UNSIGNED NOT NULL,
  symptoms    JSON NULL,
  lifestyle   JSON NULL,
  diet        JSON NULL,
  discomfort_areas JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_q_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_q_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 3. APPOINTMENTS & CONSULTATIONS
-- =========================================================
CREATE TABLE appointments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED NOT NULL,
  doctor_id       BIGINT UNSIGNED NOT NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end   DATETIME NOT NULL,
  status          ENUM('pending_payment','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'pending_payment',
  fee             DECIMAL(10,2) NOT NULL,
  payment_id      BIGINT UNSIGNED NULL,
  tongue_assessment_id BIGINT UNSIGNED NULL,
  questionnaire_id BIGINT UNSIGNED NULL,
  notes           TEXT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ap_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT fk_ap_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id),
  KEY idx_ap_doctor_time (doctor_id, scheduled_start),
  KEY idx_ap_patient_time (patient_id, scheduled_start),
  KEY idx_ap_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE consultations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  BIGINT UNSIGNED NOT NULL UNIQUE,
  room_id         VARCHAR(120) NULL,
  started_at      DATETIME NULL,
  ended_at        DATETIME NULL,
  duration_seconds INT UNSIGNED NULL,
  transcript      MEDIUMTEXT NULL,
  doctor_notes    TEXT NULL,
  CONSTRAINT fk_co_ap FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE consultation_snapshots (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consultation_id BIGINT UNSIGNED NOT NULL,
  image_url       VARCHAR(500) NOT NULL,
  taken_by        ENUM('patient','doctor') NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_co FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 4. PRESCRIPTIONS
-- =========================================================
CREATE TABLE prescriptions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  BIGINT UNSIGNED NOT NULL,
  doctor_id       BIGINT UNSIGNED NOT NULL,
  patient_id      BIGINT UNSIGNED NOT NULL,
  status          ENUM('draft','issued','revised','revoked','dispensed') NOT NULL DEFAULT 'draft',
  diagnosis       TEXT NULL,
  instructions    TEXT NULL,
  contraindications TEXT NULL,
  duration_days   SMALLINT NULL,
  parent_id       BIGINT UNSIGNED NULL, -- for revisions
  issued_at       DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rx_ap FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  CONSTRAINT fk_rx_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  KEY idx_rx_patient (patient_id),
  KEY idx_rx_doctor (doctor_id),
  KEY idx_rx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE prescription_items (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescription_id BIGINT UNSIGNED NOT NULL,
  product_id      BIGINT UNSIGNED NULL,
  drug_name       VARCHAR(200) NOT NULL,
  specification   VARCHAR(120) NULL,
  dosage          VARCHAR(120) NULL,    -- e.g. "10g"
  frequency       VARCHAR(120) NULL,    -- e.g. "TID"
  usage_method    VARCHAR(255) NULL,
  quantity        DECIMAL(10,2) NOT NULL,
  unit            VARCHAR(20) NOT NULL DEFAULT 'g',
  notes           VARCHAR(500) NULL,
  CONSTRAINT fk_rxi_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 5. PRODUCTS / INVENTORY (per pharmacy)
-- =========================================================
-- Master TCM medicine catalogue (shared price list, not pharmacy-scoped).
-- Seeded from Timing Herbs SDN. BHD. monthly price sheet (单方 + 复方).
CREATE TABLE medicine_catalog (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,          -- e.g. 5610 or B0206
  name_zh       VARCHAR(120) NOT NULL,                -- 艾叶 / 八正散
  name_pinyin   VARCHAR(160) NOT NULL,                -- Ai Ye / Ba Zheng Shan
  type          ENUM('single','compound') NOT NULL,   -- 单方 / 复方
  category      VARCHAR(10) NULL,                     -- A / B / C (first letter of pinyin)
  unit          VARCHAR(20) NOT NULL DEFAULT 'per 100g',
  unit_price    DECIMAL(10,2) NULL,                   -- NULL = 询 (inquire)
  source        VARCHAR(80) NOT NULL DEFAULT 'Timing Herbs',
  price_month   VARCHAR(20) NULL,                     -- e.g. 2026-03
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  notes         TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_mc_type (type, is_active),
  KEY idx_mc_name (name_zh)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  sku             VARCHAR(80) NULL,
  name            VARCHAR(200) NOT NULL,
  specification   VARCHAR(120) NULL,
  description     TEXT NULL,
  image_url       VARCHAR(500) NULL,
  unit            VARCHAR(20) NOT NULL DEFAULT 'g',
  unit_price      DECIMAL(10,2) NOT NULL,
  is_listed       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_pharm FOREIGN KEY (pharmacy_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_pr_pharm_listed (pharmacy_id, is_listed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      BIGINT UNSIGNED NOT NULL,
  quantity_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_pr FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_inv_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_movements (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      BIGINT UNSIGNED NOT NULL,
  change_qty      DECIMAL(12,2) NOT NULL, -- + in / - out
  reason          ENUM('purchase','sale','adjustment','return','stocktake') NOT NULL,
  reference_type  VARCHAR(60) NULL,
  reference_id    BIGINT UNSIGNED NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_im_pr FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  KEY idx_im_product (product_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 6. ADDRESSES, ORDERS, SHIPMENTS
-- =========================================================
CREATE TABLE addresses (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  recipient    VARCHAR(120) NOT NULL,
  phone        VARCHAR(40) NOT NULL,
  country      VARCHAR(80) NOT NULL,
  state        VARCHAR(80) NULL,
  city         VARCHAR(80) NOT NULL,
  line1        VARCHAR(255) NOT NULL,
  line2        VARCHAR(255) NULL,
  postal_code  VARCHAR(20) NULL,
  is_default   TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_addr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no        VARCHAR(40) NOT NULL UNIQUE,
  patient_id      BIGINT UNSIGNED NOT NULL,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  prescription_id BIGINT UNSIGNED NULL,
  address_id      BIGINT UNSIGNED NOT NULL,
  status          ENUM('pending_payment','paid','dispensing','dispensed','shipped','delivered','completed','cancelled','refunded','after_sale') NOT NULL DEFAULT 'pending_payment',
  subtotal        DECIMAL(10,2) NOT NULL,
  shipping_fee    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'CNY',
  payment_id      BIGINT UNSIGNED NULL,
  paid_at         DATETIME NULL,
  cancelled_at    DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_o_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT fk_o_pharm   FOREIGN KEY (pharmacy_id) REFERENCES users(id),
  CONSTRAINT fk_o_rx      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  CONSTRAINT fk_o_addr    FOREIGN KEY (address_id) REFERENCES addresses(id),
  KEY idx_o_patient (patient_id, created_at),
  KEY idx_o_pharm (pharmacy_id, created_at),
  KEY idx_o_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     BIGINT UNSIGNED NOT NULL,
  product_id   BIGINT UNSIGNED NULL,
  drug_name    VARCHAR(200) NOT NULL,
  specification VARCHAR(120) NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL,
  unit         VARCHAR(20) NOT NULL DEFAULT 'g',
  line_total   DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipments (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id     BIGINT UNSIGNED NOT NULL UNIQUE,
  carrier      VARCHAR(80) NULL,
  tracking_no  VARCHAR(120) NULL,
  status       ENUM('preparing','shipped','in_transit','delivered','exception') NOT NULL DEFAULT 'preparing',
  shipped_at   DATETIME NULL,
  delivered_at DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sh_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipment_events (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shipment_id  BIGINT UNSIGNED NOT NULL,
  event_time   DATETIME NOT NULL,
  location     VARCHAR(200) NULL,
  description  VARCHAR(500) NULL,
  CONSTRAINT fk_se_sh FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  KEY idx_se_sh_time (shipment_id, event_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 7. PAYMENTS, FINANCE
-- =========================================================
CREATE TABLE payments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  payable_type    ENUM('appointment','order') NOT NULL,
  payable_id      BIGINT UNSIGNED NOT NULL,
  provider        ENUM('stripe','paypal','alipay','wechat') NOT NULL,
  provider_ref    VARCHAR(190) NULL,
  amount          DECIMAL(10,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'CNY',
  status          ENUM('pending','succeeded','failed','refunded','partial_refunded') NOT NULL DEFAULT 'pending',
  raw_payload     JSON NULL,
  paid_at         DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_pay_payable (payable_type, payable_id),
  KEY idx_pay_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE withdrawals (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL, -- doctor or pharmacy
  amount      DECIMAL(10,2) NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'CNY',
  status      ENUM('pending','approved','rejected','paid') NOT NULL DEFAULT 'pending',
  bank_info   JSON NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_w_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_w_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- 8. NOTIFICATIONS, CONTENT, CONFIG, AUDIT
-- =========================================================
CREATE TABLE notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  type        VARCHAR(80) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT NULL,
  data        JSON NULL,
  read_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_n_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_n_user_read (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE content_pages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(120) NOT NULL UNIQUE, -- privacy, tos, help, faq
  title       VARCHAR(200) NOT NULL,
  body_html   MEDIUMTEXT NOT NULL,
  locale      VARCHAR(10) NOT NULL DEFAULT 'en',
  updated_by  BIGINT UNSIGNED NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_configs (
  `key`       VARCHAR(120) PRIMARY KEY,
  `value`     TEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(120) NOT NULL,
  target_type  VARCHAR(80) NULL,
  target_id    BIGINT UNSIGNED NULL,
  ip_address   VARCHAR(45) NULL,
  user_agent   VARCHAR(255) NULL,
  payload      JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_al_user (user_id),
  KEY idx_al_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
-- consent_grants — PDPA 2010 § 6 / § 7 / § 38 consent audit
-- Added 2026-04-21. See docs/ux/consent-copy.md for purposes
-- and docs/legal/privacy-notice.md for user-facing wording.
--
-- Insert a new row on EVERY grant AND every revoke. The latest
-- row per (user_id, purpose_id) is the current state. Never
-- UPDATE or DELETE existing rows — the table is the audit log.
--
-- Canonical purpose_id values (keep in sync with consent-copy.md):
--   core_account         — required for signup
--   tongue_image         — tongue photo storage + AI processing
--   questionnaire        — questionnaire storage + use
--   ai_processing        — third-party AI vendor processing
--   practitioner_share   — share records with a practitioner (per booking)
--   marketing_email      — newsletters
--   analytics            — anonymised usage analytics
-- ─────────────────────────────────────────────────────────
CREATE TABLE consent_grants (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  purpose_id        VARCHAR(64) NOT NULL,
  granted           TINYINT(1) NOT NULL,
  consent_version   VARCHAR(16) NOT NULL,
  granted_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address        VARCHAR(45) NULL,
  user_agent        VARCHAR(255) NULL,
  related_booking   BIGINT UNSIGNED NULL COMMENT 'appointment id for practitioner_share, NULL otherwise',
  note              VARCHAR(255) NULL,
  KEY idx_cg_user_purpose (user_id, purpose_id),
  KEY idx_cg_user_time (user_id, granted_at),
  KEY idx_cg_purpose (purpose_id),
  CONSTRAINT fk_cg_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────
-- user_permission_overrides — per-user permission grants/denials.
--
-- Permissions default to the role-level map in system_configs.
-- role_permissions. A row in this table overrides that default for a
-- single user + single permission key:
--   granted = 1  → force allow even if role default is false
--   granted = 0  → force deny even if role default is true
-- Delete the row to revert to role default.
--
-- Used by User::hasPermission($key) and the EnsurePermission middleware.
-- Lets admins give Doctor A access to finance while Doctor B can't.
-- ─────────────────────────────────────────────────────────
CREATE TABLE user_permission_overrides (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  permission_key  VARCHAR(64) NOT NULL,
  granted         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NULL DEFAULT NULL,
  updated_at      TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_user_permission (user_id, permission_key),
  KEY idx_user (user_id),
  CONSTRAINT fk_upo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- BLOG — admin/doctor-managed articles, replaces the three
-- hardcoded /v2/blog/*.html files. Posts live in the DB and
-- are rendered dynamically by /v2/article.html?slug=…
-- =========================================================
CREATE TABLE blog_categories (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(80)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  name_zh       VARCHAR(120) NULL,
  display_order INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE blog_posts (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(120) NOT NULL UNIQUE,
  title            VARCHAR(220) NOT NULL,
  title_zh         VARCHAR(220) NULL,
  subtitle         VARCHAR(300) NULL,
  subtitle_zh     VARCHAR(300) NULL,
  excerpt          TEXT         NULL,
  excerpt_zh       TEXT         NULL,
  body_html        LONGTEXT     NULL,
  body_zh_html     LONGTEXT     NULL,
  cover_image_url  VARCHAR(500) NULL,
  -- Used on the blog card thumbnail when no cover image is set
  -- (mirrors the original hardcoded design with a Chinese
  -- character + uppercase EN label).
  thumb_initial    VARCHAR(8)   NULL,
  thumb_label      VARCHAR(60)  NULL,
  -- Author = a user with role doctor or admin. Denormalised
  -- author_name so display doesn't break if the user is later
  -- renamed or soft-deleted.
  author_id        BIGINT UNSIGNED NOT NULL,
  author_name      VARCHAR(160) NOT NULL,
  category_id      BIGINT UNSIGNED NULL,
  reading_time_min SMALLINT NULL,
  -- Workflow:
  --   draft           — author still working
  --   pending_review  — doctor submitted; awaiting admin approval
  --   published       — live (only shown when published_at <= NOW)
  --   archived        — hidden but not deleted
  status           ENUM('draft','pending_review','published','archived') NOT NULL DEFAULT 'draft',
  published_at     DATETIME NULL,
  view_count       INT UNSIGNED NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bp_author   FOREIGN KEY (author_id)   REFERENCES users(id),
  CONSTRAINT fk_bp_category FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL,
  KEY idx_bp_status_pub (status, published_at),
  KEY idx_bp_author (author_id),
  KEY idx_bp_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
