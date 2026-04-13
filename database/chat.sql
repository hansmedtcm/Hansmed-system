CREATE TABLE chat_threads (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id   BIGINT UNSIGNED NOT NULL,
  doctor_id    BIGINT UNSIGNED NOT NULL,
  appointment_id BIGINT UNSIGNED NULL,
  status       ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ct_patient FOREIGN KEY (patient_id) REFERENCES users(id),
  CONSTRAINT fk_ct_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  KEY idx_ct_patient (patient_id),
  KEY idx_ct_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id   BIGINT UNSIGNED NOT NULL,
  sender_id   BIGINT UNSIGNED NOT NULL,
  message     TEXT NOT NULL,
  image_url   VARCHAR(500) NULL,
  read_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cm_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  KEY idx_cm_thread_created (thread_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
