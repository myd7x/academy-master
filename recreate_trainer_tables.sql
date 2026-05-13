CREATE TABLE IF NOT EXISTS `trainers` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `name` text NOT NULL,
  `activity` enum('karate','kickboxing','football','swimming','zumba','aerobics','crossfit','gymnastics','quran_memorization','kindergarten') NOT NULL,
  `base_salary` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `trainer_salary_payments` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `trainer_id` varchar(36) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `month` varchar(7) NOT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `trainer_advances` (
  `id` varchar(36) NOT NULL DEFAULT (UUID()),
  `trainer_id` varchar(36) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','deducted') NOT NULL DEFAULT 'pending',
  `deducted_at` timestamp NULL DEFAULT NULL,
  `salary_payment_id` varchar(36) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
);
