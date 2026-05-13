CREATE TABLE IF NOT EXISTS trainer_bonuses (
  id varchar(36) NOT NULL DEFAULT (UUID()),
  trainer_id varchar(36) NOT NULL,
  amount decimal(10,2) NOT NULL,
  month varchar(7) NOT NULL,
  note text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS trainer_payrolls (
  id varchar(36) NOT NULL DEFAULT (UUID()),
  trainer_id varchar(36) NOT NULL,
  month varchar(7) NOT NULL,
  base_salary decimal(10,2) NOT NULL DEFAULT '0.00',
  carry_forward decimal(10,2) NOT NULL DEFAULT '0.00',
  total_bonuses decimal(10,2) NOT NULL DEFAULT '0.00',
  total_advances decimal(10,2) NOT NULL DEFAULT '0.00',
  total_paid decimal(10,2) NOT NULL DEFAULT '0.00',
  net_payable decimal(10,2) NOT NULL DEFAULT '0.00',
  status enum('unpaid', 'partial', 'paid', 'over_advanced') NOT NULL DEFAULT 'unpaid',
  is_locked boolean NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
);
