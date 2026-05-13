ALTER TABLE trainer_advances MODIFY COLUMN status ENUM('pending', 'deducted', 'repaid') NOT NULL DEFAULT 'pending';
