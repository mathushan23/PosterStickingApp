/*step1 CREATE DATABASE poster_sticking;*/
/*step2  mysql -u root -p poster_sticking < schema.sql */



-- ===============================
-- Database: poster_sticking
-- ===============================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ===============================
-- USERS TABLE
-- ===============================
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ===============================
-- SPOTS TABLE (LOCATIONS)
-- ===============================
CREATE TABLE spots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  address_text VARCHAR(255) NULL,
  last_stuck_at DATETIME NULL,
  last_stuck_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_spots_user
    FOREIGN KEY (last_stuck_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- Index for location & cooldown checks
CREATE INDEX idx_spots_lat_lng ON spots(latitude, longitude);
CREATE INDEX idx_spots_last_stuck ON spots(last_stuck_at);

-- ===============================
-- SUBMISSIONS TABLE
-- ===============================
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  spot_id INT NOT NULL,

  proof_url VARCHAR(255) NOT NULL,
  proof_type ENUM('image','video') NOT NULL,
  proof_mime VARCHAR(80) NULL,
  proof_size INT NULL,

  submitted_latitude DECIMAL(10,7) NOT NULL,
  submitted_longitude DECIMAL(10,7) NOT NULL,
  note TEXT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_submissions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_submissions_spot
    FOREIGN KEY (spot_id) REFERENCES spots(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_submissions_user_date ON submissions(user_id, submitted_at);

-- ===============================
-- DEFAULT ADMIN USER (PASSWORD: admin123)
-- password_hash generated using bcrypt
-- ===============================
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Admin',
  'admin@example.com',
  '$2b$10$Qm9kY5kZySUdkGFUTkOcZOEy9FHn5Vf3L7hIwrKyYVJZZzKzbwQ6G',
  'admin'
);
