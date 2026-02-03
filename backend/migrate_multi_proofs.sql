-- Create submission_proofs table
CREATE TABLE IF NOT EXISTS submission_proofs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  proof_url VARCHAR(255) NOT NULL,
  proof_type ENUM('image','video') NOT NULL,
  proof_mime VARCHAR(80) NULL,
  proof_size INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proofs_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Migrate existing proofs to the new table
INSERT INTO submission_proofs (submission_id, proof_url, proof_type, proof_mime, proof_size, created_at)
SELECT id, proof_url, proof_type, proof_mime, proof_size, submitted_at
FROM submissions;

-- Optionally, make the old columns NULLABLE so we can stop using them
ALTER TABLE submissions 
MODIFY COLUMN proof_url VARCHAR(255) NULL,
MODIFY COLUMN proof_type ENUM('image','video') NULL;
