-- HansMed TCM Platform — canonical schema (MySQL 8)
-- Covers: users/roles, tongue diagnosis, questionnaires, appointments,
-- video consultations, prescriptions, pharmacies, inventory, orders,
-- shipments, payments, withdrawals, notifications, audit, content.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- 1. AUTH & PROFILES
-- =========================================================
-- users — reconciled with production 2026-05-18. Added google_id column
-- (Brief #16f Google SSO — was applied to prod via the 2026_05_06 migration
-- but never reflected back into schema.sql).
CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id       VARCHAR(255) DEFAULT NULL,
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
  KEY idx_users_role_status (role, status),
  KEY idx_users_google_id (google_id)
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

-- patient_profiles — reconciled with production 2026-05-18 via
-- `SHOW CREATE TABLE patient_profiles` on Railway MySQL. Prior version
-- of this CREATE TABLE was 22 columns behind production; the missing
-- columns (notably `registration_completed`) were causing CI feature
-- tests to fail because the EnsureRegistrationComplete middleware
-- reads $profile->registration_completed and the test DB didn't have
-- the column. PHI-bearing TEXT columns (address_*, emergency_*, etc.)
-- are already encrypted-at-rest by the 2026_05_16 migration's
-- application-layer `encrypted` casts on the model.
CREATE TABLE patient_profiles (
  user_id                     BIGINT UNSIGNED NOT NULL,
  registration_completed      TINYINT(1) NOT NULL DEFAULT 0,
  nickname                    VARCHAR(80) DEFAULT NULL,
  full_name                   VARCHAR(120) DEFAULT NULL,
  avatar_url                  VARCHAR(500) DEFAULT NULL,
  gender                      ENUM('male','female','other') DEFAULT NULL,
  birth_date                  DATE DEFAULT NULL,
  phone                       VARCHAR(40) DEFAULT NULL,
  ic_number                   VARCHAR(40) DEFAULT NULL,
  occupation                  VARCHAR(120) DEFAULT NULL,
  address_line1               TEXT,
  address_line2               TEXT,
  city                        VARCHAR(80) DEFAULT NULL,
  state                       VARCHAR(80) DEFAULT NULL,
  postal_code                 VARCHAR(20) DEFAULT NULL,
  country                     VARCHAR(80) DEFAULT NULL,
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  emergency_contact_relation  TEXT,
  blood_type                  VARCHAR(10) DEFAULT NULL,
  allergies                   TEXT,
  medical_history             TEXT,
  current_medications         TEXT,
  family_history              TEXT,
  height_cm                   DECIMAL(5,2) DEFAULT NULL,
  weight_kg                   DECIMAL(5,2) DEFAULT NULL,
  created_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  chronic_conditions          JSON DEFAULT NULL,
  halal_only                  TINYINT(1) DEFAULT NULL,
  pregnancy_status            ENUM('not_applicable','not_pregnant','pregnant_1st_tri','pregnant_2nd_tri','pregnant_3rd_tri','breastfeeding','trying_to_conceive') DEFAULT NULL,
  pregnancy_status_updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id),
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
  -- off_days: JSON array of dates the doctor is unavailable
  -- (e.g. ["2026-06-01","2026-06-15"]). Reconciled with prod 2026-05-18.
  off_days          JSON DEFAULT NULL,
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
  -- Brief 1A Phase 2 — R2 object key for the new direct-upload flow.
  -- NULL on legacy rows (those continue to resolve via image_url).
  r2_key          VARCHAR(500) NULL,
  -- Brief 1A Phase 2 — PDPA Section 8 cross-border-transfer consent
  -- captured verbatim at upload time. Consented_at marks when ticked.
  consent_text    TEXT NULL,
  consented_at    TIMESTAMP NULL,
  -- Separate opt-in for AI model training dataset (PDPA — distinct purpose
  -- from treatment consent above). 0 = not consented / legacy rows.
  -- Stored per-assessment so we know exactly which images are training-eligible.
  ai_training_consent TINYINT(1) NOT NULL DEFAULT 0,
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
  -- Practitioner review (Brief #20 — MDA 2012 §6 makes a licensed
  -- practitioner the only entity that may diagnose, so the patient-
  -- facing constitution_report is treated as "AI-assisted assessment"
  -- until a doctor sets review_status = approved). doctor_comment is
  -- the practitioner's free-text annotation. reviewed_by + reviewed_at
  -- record audit trail. medicine_suggestions is the practitioner's
  -- recommended herbs (separate from the AI's constitution_report).
  review_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  doctor_comment       TEXT NULL,
  reviewed_by          BIGINT UNSIGNED NULL,
  reviewed_at          DATETIME NULL,
  medicine_suggestions JSON NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Brief 1A Phase 2 — SoftDeletes for PDPA right-of-erasure flow.
  deleted_at      TIMESTAMP NULL,
  CONSTRAINT fk_ta_patient  FOREIGN KEY (patient_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  KEY idx_ta_patient_created (patient_id, created_at),
  KEY idx_ta_r2_key (r2_key),
  KEY idx_ta_review_status (review_status)
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
-- appointments — reconciled with production 2026-05-18. Added
-- visit_type (online/in-person), is_pool (pool-booking flag), and the
-- concern triad (concern, concern_label, recommended_specialty) used
-- by the pool-booking flow when no specific doctor is selected.
-- doctor_id now NULL so pool bookings can exist without a doctor
-- (controller assigns one when the doctor accepts the case).
CREATE TABLE appointments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id      BIGINT UNSIGNED NOT NULL,
  doctor_id       BIGINT UNSIGNED NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end   DATETIME NOT NULL,
  status          ENUM('pending_payment','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'pending_payment',
  visit_type      VARCHAR(20) NOT NULL DEFAULT 'online',
  fee             DECIMAL(10,2) NOT NULL,
  payment_id      BIGINT UNSIGNED NULL,
  tongue_assessment_id BIGINT UNSIGNED NULL,
  questionnaire_id BIGINT UNSIGNED NULL,
  notes           TEXT NULL,
  concern         VARCHAR(60) NULL,
  concern_label   VARCHAR(120) NULL,
  recommended_specialty VARCHAR(120) NULL,
  is_pool         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ap_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT fk_ap_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id),
  KEY idx_ap_doctor_time (doctor_id, scheduled_start),
  KEY idx_ap_patient_time (patient_id, scheduled_start),
  KEY idx_ap_status (status),
  KEY idx_ap_pool (is_pool, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- consultations — reconciled with production 2026-05-19. Added
-- case_record + treatments JSON columns the doctor-side consult UI
-- writes after the call (structured case summary + recommended
-- treatment plan, distinct from the freeform doctor_notes above).
CREATE TABLE consultations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  BIGINT UNSIGNED NOT NULL UNIQUE,
  room_id         VARCHAR(120) NULL,
  started_at      DATETIME NULL,
  ended_at        DATETIME NULL,
  duration_seconds INT UNSIGNED NULL,
  transcript      MEDIUMTEXT NULL,
  doctor_notes    TEXT NULL,
  case_record     JSON NULL,
  treatments      JSON NULL,
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
-- medicine_catalog — reconciled with production 2026-05-18. Added
-- pack_grams, stock_grams, reorder_threshold, stock_updated_at —
-- the inventory bookkeeping that the DoctorPrescriptionController
-- stock-availability gate reads from. Without these columns, the
-- stock check is undefined and the controller falls through.
CREATE TABLE medicine_catalog (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,          -- e.g. 5610 or B0206
  name_zh       VARCHAR(120) NOT NULL,                -- 艾叶 / 八正散
  name_pinyin   VARCHAR(160) NOT NULL,                -- Ai Ye / Ba Zheng Shan
  type          ENUM('single','compound') NOT NULL,   -- 单方 / 复方
  category      VARCHAR(10) NULL,                     -- A / B / C (first letter of pinyin)
  unit          VARCHAR(20) NOT NULL DEFAULT 'per 100g',
  pack_grams    DECIMAL(10,2) NOT NULL DEFAULT 100.00, -- grams per pack
  unit_price    DECIMAL(10,2) NULL,                   -- NULL = 询 (inquire)
  stock_grams   DECIMAL(12,2) NOT NULL DEFAULT 0,     -- on-hand grams
  reorder_threshold DECIMAL(12,2) NOT NULL DEFAULT 0,  -- low-stock alert level
  stock_updated_at DATETIME NULL,
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

-- audit_logs — tamper-evident HMAC chain added 2026-05-19 (Day 7 #2).
-- Each row's row_hash = HMAC-SHA256(secret, prev_hash || canonical_payload)
-- where canonical_payload is a deterministically-encoded JSON of the
-- row's fields. prev_hash links to the previous row's row_hash,
-- forming a chain. Tampering with any past row breaks verification
-- for every subsequent row.
--
-- prev_hash + row_hash are NULL during the transition window (before
-- the AuditLogger::log() refactor lands at all call sites and the
-- one-shot backfill is run). After backfill, row_hash is NEVER NULL
-- for committed rows — the AuditLogger guarantees both columns are
-- populated atomically inside the same transaction as the INSERT.
--
-- See App\Services\AuditLogger for the write path, audit_chain_head
-- below for the serialization point, App\Console\Commands\AuditVerifyChain
-- for verification.
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NULL,
  action       VARCHAR(120) NOT NULL,
  target_type  VARCHAR(80) NULL,
  target_id    BIGINT UNSIGNED NULL,
  ip_address   VARCHAR(45) NULL,
  user_agent   VARCHAR(255) NULL,
  payload      JSON NULL,
  prev_hash    CHAR(64) NULL,
  row_hash     CHAR(64) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_al_user (user_id),
  KEY idx_al_target (target_type, target_id),
  KEY idx_al_row_hash (row_hash),
  KEY idx_al_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- audit_chain_head — serialization point for the HMAC chain.
-- Single-row table (id locked to 1). Holds the most recent committed
-- row's id + hash. Every AuditLogger::log() call:
--   1. BEGIN
--   2. SELECT * FROM audit_chain_head WHERE id=1 FOR UPDATE
--      (acquires row lock — concurrent writers block here)
--   3. Reads last_hash, computes row_hash for new row
--   4. INSERT audit_logs row
--   5. UPDATE audit_chain_head SET last_id=NEW.id, last_hash=NEW.row_hash
--   6. COMMIT
-- The FOR UPDATE on a fixed PK is what serializes concurrent writers —
-- not the audit_logs table itself. If a transaction rolls back after
-- step 4, the head doesn't advance (step 5 never runs), so the chain
-- has no dangling references. See agent review notes in
-- _internal/CLAUDE_OPS.md Day 7 #2 for the rationale.
CREATE TABLE audit_chain_head (
  id          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  last_id     BIGINT UNSIGNED NULL,
  last_hash   CHAR(64) NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_audit_chain_head_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the single head row so SELECT ... FOR UPDATE always finds it.
-- INSERT IGNORE so re-running schema.sql in tests doesn't duplicate.
INSERT IGNORE INTO audit_chain_head (id, last_id, last_hash)
VALUES (1, NULL, NULL);

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

-- =========================================================
-- email_verification_codes — Brief #16e
-- =========================================================
-- 6-digit code emailed to a registering user. They POST it back to
-- /auth/verify-email to flip users.email_verified_at and receive their
-- first Sanctum token. Created by the 2026_05_07 migration on prod;
-- reconciled into schema.sql 2026-05-18 so CI tests that touch the
-- AuthController register/login flow don't hit "table doesn't exist".
CREATE TABLE email_verification_codes (
  email       VARCHAR(190) NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- DAY 7 SCHEMA DRIFT PHASE 2 — 10 tables reconciled with prod
-- =========================================================
-- All 10 below existed in production but were missing from schema.sql.
-- DDL captured 2026-05-19 from Railway MySQL via `SHOW CREATE TABLE`
-- (Chrome MCP + DevTools innerText scrape, same workflow as Day 6).
-- Collations are PRESERVED per-table: tables created by Laravel
-- migrations use `utf8mb4_unicode_ci` (the Laravel default), tables
-- created by the original schema.sql use `utf8mb4_0900_ai_ci` (the
-- MySQL 8 default). Mixing per-table is intentional — preserves
-- byte-equivalence with prod for future mysqldump diffs.

-- ─── Laravel framework defaults ───────────────────────────────────────────
-- migrations: Laravel's migration tracker. Auto-created by the first
-- `php artisan migrate` run. Listed here so a fresh schema.sql load
-- leaves the test DB in the same shape as a freshly-deployed prod.
CREATE TABLE migrations (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  migration VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  batch     INT NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- password_resets: Laravel default password-reset token store. Only
-- used by older flows; the modern flow uses email_verification_codes.
-- Kept because production has it.
CREATE TABLE password_resets (
  email      VARCHAR(190) NOT NULL,
  token      VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─── Patient-doctor messaging (Brief C-14) ────────────────────────────────
-- chat_threads: per-(patient, doctor) conversation. Optional
-- appointment_id links the thread to a specific consultation. Status
-- closes when either side ends the thread.
CREATE TABLE chat_threads (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id      BIGINT UNSIGNED NOT NULL,
  doctor_id       BIGINT UNSIGNED NOT NULL,
  appointment_id  BIGINT UNSIGNED DEFAULT NULL,
  status          ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ct_patient (patient_id),
  KEY idx_ct_doctor (doctor_id),
  CONSTRAINT fk_ct_patient FOREIGN KEY (patient_id) REFERENCES users (id),
  CONSTRAINT fk_ct_doctor  FOREIGN KEY (doctor_id)  REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- chat_messages: individual messages inside a thread. read_at NULL
-- until the other party views the message. image_url for chat-attached
-- images (patient sending a photo of a rash, etc.).
CREATE TABLE chat_messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id  BIGINT UNSIGNED NOT NULL,
  sender_id  BIGINT UNSIGNED NOT NULL,
  message    TEXT NOT NULL,
  image_url  VARCHAR(500) DEFAULT NULL,
  read_at    DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_cm_sender (sender_id),
  KEY idx_cm_thread_created (thread_id, created_at),
  CONSTRAINT fk_cm_thread  FOREIGN KEY (thread_id) REFERENCES chat_threads (id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_sender  FOREIGN KEY (sender_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─── Pharmacy operations ──────────────────────────────────────────────────
-- medicine_purchases: pharmacy purchase order ledger. Tracks supplier
-- invoices feeding stock into medicine_catalog.stock_grams.
CREATE TABLE medicine_purchases (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  medicine_id         BIGINT UNSIGNED NOT NULL,
  invoice_no          VARCHAR(80) DEFAULT NULL,
  supplier_name       VARCHAR(160) NOT NULL,
  purchase_date       DATE NOT NULL,
  quantity_grams      DECIMAL(12,2) NOT NULL,
  pack_grams          DECIMAL(10,2) DEFAULT NULL,
  pack_count          DECIMAL(10,2) DEFAULT NULL,
  total_cost          DECIMAL(12,2) DEFAULT NULL,
  unit_cost_per_gram  DECIMAL(12,4) DEFAULT NULL,
  notes               TEXT,
  created_by          BIGINT UNSIGNED DEFAULT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mp_med (medicine_id, purchase_date),
  KEY idx_mp_inv (invoice_no),
  KEY idx_mp_sup (supplier_name),
  CONSTRAINT fk_mp_med FOREIGN KEY (medicine_id) REFERENCES medicine_catalog (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- pos_sales: pharmacy point-of-sale walk-in / OTC / prescription
-- counter sales. items is a JSON array of line-items (drug_name,
-- quantity, unit_price). Separate from `orders` which handles online
-- order flow; pos_sales is for physical-counter transactions.
CREATE TABLE pos_sales (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_no         VARCHAR(40) NOT NULL,
  pharmacy_id     BIGINT UNSIGNED NOT NULL,
  cashier_id      BIGINT UNSIGNED NOT NULL,
  patient_name    VARCHAR(120) DEFAULT NULL,
  patient_id      BIGINT UNSIGNED DEFAULT NULL,
  prescription_id BIGINT UNSIGNED DEFAULT NULL,
  sale_type       ENUM('walk_in','otc','prescription') NOT NULL DEFAULT 'walk_in',
  payment_method  ENUM('cash','card','ewallet_tng','ewallet_grab','ewallet_shopee','fpx') NOT NULL,
  subtotal        DECIMAL(10,2) NOT NULL,
  tax             DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  total           DECIMAL(10,2) NOT NULL,
  amount_received DECIMAL(10,2) NOT NULL,
  change_amount   DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  notes           VARCHAR(500) DEFAULT NULL,
  items           JSON NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY sale_no (sale_no),
  KEY idx_pos_pharm_date (pharmacy_id, created_at),
  CONSTRAINT fk_pos_pharm FOREIGN KEY (pharmacy_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─── Marketing / promotions ───────────────────────────────────────────────
-- vouchers: discount codes. applies_to limits the eligible context;
-- max_redemptions / per_user_limit cap usage. valid_until enforces
-- expiry.
CREATE TABLE vouchers (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(40) NOT NULL,
  description       VARCHAR(255) DEFAULT NULL,
  discount_pct      DECIMAL(5,2) NOT NULL,
  max_redemptions   INT UNSIGNED DEFAULT NULL,
  per_user_limit    SMALLINT UNSIGNED DEFAULT '1',
  redemption_count  INT UNSIGNED NOT NULL DEFAULT '0',
  valid_from        DATE DEFAULT NULL,
  valid_until       DATE DEFAULT NULL,
  applies_to        ENUM('all','appointment','order') NOT NULL DEFAULT 'all',
  is_active         TINYINT(1) NOT NULL DEFAULT '1',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY idx_v_code (code),
  KEY idx_v_active (is_active, valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- voucher_redemptions: audit row per redemption. ref_type / ref_id
-- point at the appointment or order the discount was applied to.
CREATE TABLE voucher_redemptions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_id      BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  ref_type        VARCHAR(32) DEFAULT NULL,
  ref_id          BIGINT UNSIGNED DEFAULT NULL,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  redeemed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY fk_vr_user (user_id),
  KEY idx_vr_voucher_user (voucher_id, user_id),
  KEY idx_vr_voucher_when (voucher_id, redeemed_at),
  CONSTRAINT fk_vr_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (id) ON DELETE CASCADE,
  CONSTRAINT fk_vr_user    FOREIGN KEY (user_id)    REFERENCES users    (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─── Clinical workflow (Phase 9.5) ────────────────────────────────────────
-- pre_assessments: structured pre-consultation intake. The patient
-- (or the AI assist) populates Western history + TCM screening JSON
-- blobs; the doctor reviews and either confirms / amends / overrides.
-- Migration-created table — uses utf8mb4_unicode_ci collation per
-- Laravel default.
CREATE TABLE pre_assessments (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  appointment_id           BIGINT UNSIGNED DEFAULT NULL,
  patient_id               BIGINT UNSIGNED NOT NULL,
  tongue_assessment_id     BIGINT UNSIGNED DEFAULT NULL,
  chief_complaint          TEXT COLLATE utf8mb4_unicode_ci NOT NULL,
  symptom_timeline         TEXT COLLATE utf8mb4_unicode_ci,
  western_history_answers  JSON DEFAULT NULL,
  clinical_assist_output   JSON DEFAULT NULL,
  vitals                   JSON DEFAULT NULL,
  tcm_top_patterns         JSON DEFAULT NULL,
  tcm_selected_questions   JSON DEFAULT NULL,
  tcm_answers              JSON DEFAULT NULL,
  safety_screen_answers    JSON DEFAULT NULL,
  red_flags_detected       JSON DEFAULT NULL,
  suggested_treatments     JSON DEFAULT NULL,
  doctor_decision          ENUM('pending','confirmed','amended','overridden') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  doctor_decision_notes    TEXT COLLATE utf8mb4_unicode_ci,
  doctor_decided_by        BIGINT UNSIGNED DEFAULT NULL,
  doctor_decided_at        DATETIME DEFAULT NULL,
  status                   ENUM('in_progress','complete','abandoned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress',
  completed_at             DATETIME DEFAULT NULL,
  current_stage            TINYINT UNSIGNED NOT NULL DEFAULT '1',
  created_at               TIMESTAMP NULL DEFAULT NULL,
  updated_at               TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_pa_patient_status (patient_id, status),
  KEY idx_pa_appointment (appointment_id),
  KEY pre_assessments_tongue_assessment_id_foreign (tongue_assessment_id),
  KEY pre_assessments_doctor_decided_by_foreign (doctor_decided_by),
  CONSTRAINT pre_assessments_appointment_id_foreign        FOREIGN KEY (appointment_id)       REFERENCES appointments       (id) ON DELETE SET NULL,
  CONSTRAINT pre_assessments_doctor_decided_by_foreign     FOREIGN KEY (doctor_decided_by)    REFERENCES users              (id) ON DELETE SET NULL,
  CONSTRAINT pre_assessments_patient_id_foreign            FOREIGN KEY (patient_id)           REFERENCES users              (id) ON DELETE CASCADE,
  CONSTRAINT pre_assessments_tongue_assessment_id_foreign  FOREIGN KEY (tongue_assessment_id) REFERENCES tongue_assessments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Audit / observability ────────────────────────────────────────────────
-- notification_dispatch_log: audit row per outbound notification email.
-- Created by the 2026_05_17 Day 3 i18n migration; refined by the
-- 2026_05_18 audit-compliance fix migration. Tracks who dispatched,
-- how, success/failure, and a SHA-256 digest of the rendered payload
-- for tamper detection. Migration-created — utf8mb4_unicode_ci.
CREATE TABLE notification_dispatch_log (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_kind        VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  user_id                  BIGINT UNSIGNED DEFAULT NULL,
  recipient_email_at_send  VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  status                   VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  locale                   VARCHAR(8) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'en',
  mailer_message_id        VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  dispatched_at            TIMESTAMP NULL DEFAULT NULL,
  payload_digest           CHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  failure_reason           TEXT COLLATE utf8mb4_unicode_ci,
  triggered_by_user_id     BIGINT UNSIGNED DEFAULT NULL,
  triggered_by_os_user     VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  triggered_via            VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'artisan',
  created_at               TIMESTAMP NULL DEFAULT NULL,
  updated_at               TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_per_user (notification_kind, user_id),
  KEY notification_dispatch_log_triggered_by_user_id_foreign (triggered_by_user_id),
  KEY notification_dispatch_log_notification_kind_status_index (notification_kind, status),
  KEY notification_dispatch_log_dispatched_at_index (dispatched_at),
  KEY notification_dispatch_log_notification_kind_index (notification_kind),
  KEY notification_dispatch_log_user_id_foreign (user_id),
  CONSTRAINT notification_dispatch_log_triggered_by_user_id_foreign FOREIGN KEY (triggered_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT notification_dispatch_log_user_id_foreign              FOREIGN KEY (user_id)              REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
