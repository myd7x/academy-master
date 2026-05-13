-- ============================================================
-- Refund Management System — Full Migration Script (v2)
-- Includes hardening additions from the security audit.
-- Run this against your MySQL database ONCE.
-- ============================================================

-- Step 1: Migrate payment_status from ENUM to VARCHAR(30)
-- This lets us add new statuses (refunded, partially_refunded)
-- without another ALTER TABLE on an ENUM column.
ALTER TABLE payments
  MODIFY COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'completed';

ALTER TABLE payment_history
  MODIFY COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'completed';

-- Step 2: Create the payment_refunds table
-- Each row is an individual reversal record.
-- Original payment amounts are NEVER modified.
CREATE TABLE IF NOT EXISTS payment_refunds (
  id             VARCHAR(36)     NOT NULL PRIMARY KEY,
  payment_id     VARCHAR(36)     NOT NULL,
  player_id      VARCHAR(36)     NOT NULL,
  refund_amount  DECIMAL(10, 2)  NOT NULL,
  refund_method  VARCHAR(30)     NOT NULL DEFAULT 'cash',
  reason         TEXT,
  refunded_by    VARCHAR(36)     NULL,     -- populated server-side from session; never from frontend
  refund_date    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_refund_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,

  CONSTRAINT fk_refund_player
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Step 3: Indexes for fast lookup and reporting
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id  ON payment_refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_player_id   ON payment_refunds (player_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refunded_by ON payment_refunds (refunded_by);
CREATE INDEX IF NOT EXISTS idx_refunds_refund_date ON payment_refunds (refund_date);

-- Step 4: If you ran the previous migration (v1) and the table already exists,
-- add the refunded_by column separately:
-- ALTER TABLE payment_refunds ADD COLUMN refunded_by VARCHAR(36) NULL AFTER reason;
-- CREATE INDEX idx_refunds_refunded_by ON payment_refunds (refunded_by);

-- Verify
SELECT 'Migration v2 complete. payment_refunds table created with refunded_by audit column.' AS status;
