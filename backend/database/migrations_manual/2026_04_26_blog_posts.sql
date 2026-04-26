-- Blog editor — adds blog_categories + blog_posts tables.
-- Run on Railway MySQL once before deploying the blog feature.
-- Idempotent — IF NOT EXISTS on both tables, plus seed data is
-- INSERT IGNORE so re-runs don't duplicate.

CREATE TABLE IF NOT EXISTS blog_categories (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(80)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  name_zh       VARCHAR(120) NULL,
  display_order INT          NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blog_posts (
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
  thumb_initial    VARCHAR(8)   NULL,
  thumb_label      VARCHAR(60)  NULL,
  author_id        BIGINT UNSIGNED NOT NULL,
  author_name      VARCHAR(160) NOT NULL,
  category_id      BIGINT UNSIGNED NULL,
  reading_time_min SMALLINT NULL,
  status           ENUM('draft','pending_review','published','archived') NOT NULL DEFAULT 'draft',
  published_at     DATETIME NULL,
  view_count       INT UNSIGNED NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bp_author_2026   FOREIGN KEY (author_id)   REFERENCES users(id),
  CONSTRAINT fk_bp_category_2026 FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE SET NULL,
  KEY idx_bp_status_pub (status, published_at),
  KEY idx_bp_author (author_id),
  KEY idx_bp_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default categories. Slug is the API/URL key, name is the
-- display label. INSERT IGNORE means re-running is safe.
INSERT IGNORE INTO blog_categories (slug, name, name_zh, display_order) VALUES
  ('treatments',    'Treatments',         '療法',       10),
  ('wellness',      'Wellness & Lifestyle', '養生',     20),
  ('teleconsult',   'Online Consultation', '線上問診', 30),
  ('tongue',        'Tongue Diagnosis',    '舌診',     40),
  ('herbs',         'Herbs & Formulas',    '中藥方劑', 50),
  ('news',          'Clinic News',         '診所動態', 60);

-- Verification select — safe to leave in
SELECT
  (SELECT COUNT(*) FROM blog_categories) AS categories_count,
  (SELECT COUNT(*) FROM blog_posts)      AS posts_count;
