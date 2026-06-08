CREATE TABLE `expenses` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`category` enum('rent','utilities','maintenance','equipment','salary','marketing','transportation','other') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`date` timestamp NOT NULL DEFAULT (now()),
	`description` text,
	`payment_method` enum('cash','visa','bank_transfer') NOT NULL DEFAULT 'cash',
	`receipt_url` text,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`status` text,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`sku` varchar(100),
	`category` text NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`min_quantity` int NOT NULL DEFAULT 0,
	`unit_price` decimal(10,2),
	`location` text,
	`status` enum('active','inactive','discontinued') NOT NULL DEFAULT 'active',
	`image_url` text,
	`created_by` varchar(36),
	`updated_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_items_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`item_id` varchar(36) NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`transaction_date` timestamp NOT NULL DEFAULT (now()),
	`reference` text,
	`notes` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_history` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`player_id` varchar(36) NOT NULL,
	`subscription_fee` decimal(10,2) NOT NULL,
	`amount_paid` decimal(10,2) NOT NULL,
	`remaining_balance` decimal(10,2) NOT NULL DEFAULT '0',
	`payment_method` enum('cash','visa','bank_transfer') NOT NULL,
	`payment_status` varchar(30) NOT NULL DEFAULT 'completed',
	`payment_date` timestamp NOT NULL DEFAULT (now()),
	`description` text,
	`receipt_number` text NOT NULL DEFAULT (''),
	`subscription_period_start` datetime NOT NULL,
	`subscription_period_end` datetime NOT NULL,
	`archived_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_refunds` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`payment_id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`refund_amount` decimal(10,2) NOT NULL,
	`refund_method` varchar(30) NOT NULL DEFAULT 'cash',
	`reason` text,
	`refunded_by` varchar(36),
	`refund_date` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`player_id` varchar(36) NOT NULL,
	`subscription_fee` decimal(10,2) NOT NULL,
	`amount_paid` decimal(10,2) NOT NULL,
	`remaining_balance` decimal(10,2) NOT NULL DEFAULT '0',
	`payment_method` enum('cash','visa','bank_transfer') NOT NULL,
	`payment_status` varchar(30) NOT NULL DEFAULT 'completed',
	`payment_date` timestamp NOT NULL DEFAULT (now()),
	`description` text,
	`receipt_number` text NOT NULL DEFAULT (''),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_documents` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`player_id` varchar(36) NOT NULL,
	`document_type` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` text NOT NULL,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`full_name` text NOT NULL,
	`date_of_birth` date NOT NULL,
	`phone_number` text,
	`email` text,
	`activity` enum('karate','kickboxing','football','swimming','zumba','aerobics','crossfit','gymnastics','quran_memorization','kindergarten') NOT NULL,
	`subscription_date` timestamp NOT NULL DEFAULT (now()),
	`subscription_end_date` datetime,
	`renewal_date` datetime NOT NULL,
	`subscription_status` enum('active','paused','expired','renewal_due','cancelled') NOT NULL DEFAULT 'active',
	`paused_date` datetime,
	`pause_reason` text,
	`total_sessions_allowed` int NOT NULL DEFAULT 8,
	`sessions_attended` int NOT NULL DEFAULT 0,
	`monthly_subscription_fee` decimal(10,2) NOT NULL DEFAULT '100',
	`discount_percentage` decimal(5,2) DEFAULT '0',
	`special_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`player_id` varchar(36) NOT NULL,
	`session_date` datetime NOT NULL,
	`scheduled_start_time` datetime NOT NULL,
	`scheduled_end_time` datetime NOT NULL,
	`actual_start_time` datetime,
	`actual_end_time` datetime,
	`attendance_status` enum('present','absent','late','excused') NOT NULL DEFAULT 'present',
	`session_status` enum('scheduled','attended','missed','cancelled') NOT NULL DEFAULT 'scheduled',
	`instructor_name` text,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_advances` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`trainer_id` varchar(36) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','deducted','repaid') NOT NULL DEFAULT 'pending',
	`deducted_at` timestamp,
	`salary_payment_id` varchar(36),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_advances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_bonuses` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`trainer_id` varchar(36) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`month` varchar(7) NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_bonuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_payrolls` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`trainer_id` varchar(36) NOT NULL,
	`month` varchar(7) NOT NULL,
	`base_salary` decimal(10,2) NOT NULL DEFAULT '0',
	`carry_forward` decimal(10,2) NOT NULL DEFAULT '0',
	`total_bonuses` decimal(10,2) NOT NULL DEFAULT '0',
	`total_advances` decimal(10,2) NOT NULL DEFAULT '0',
	`total_paid` decimal(10,2) NOT NULL DEFAULT '0',
	`net_payable` decimal(10,2) NOT NULL DEFAULT '0',
	`status` enum('unpaid','partial','paid','over_advanced') NOT NULL DEFAULT 'unpaid',
	`is_locked` boolean NOT NULL DEFAULT false,
	CONSTRAINT `trainer_payrolls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainer_salary_payments` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`trainer_id` varchar(36) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`month` varchar(7) NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainer_salary_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainers` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`name` text NOT NULL,
	`activity` enum('karate','kickboxing','football','swimming','zumba','aerobics','crossfit','gymnastics','quran_memorization','kindergarten') NOT NULL,
	`base_salary` decimal(10,2) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL DEFAULT (UUID()),
	`username` varchar(255) NOT NULL,
	`password` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_item_id_inventory_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_history` ADD CONSTRAINT `payment_history_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_refunds` ADD CONSTRAINT `payment_refunds_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_documents` ADD CONSTRAINT `player_documents_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_advances` ADD CONSTRAINT `trainer_advances_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_bonuses` ADD CONSTRAINT `trainer_bonuses_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_payrolls` ADD CONSTRAINT `trainer_payrolls_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trainer_salary_payments` ADD CONSTRAINT `trainer_salary_payments_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE cascade ON UPDATE no action;