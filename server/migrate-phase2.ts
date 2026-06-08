/**
 * Phase 2 Migration: ERP-Lite Improvements
 * 
 * Adds soft-delete columns, inventory condition, expense status,
 * transaction audit fields, and the activity_logs table.
 * 
 * Run: npx tsx server/migrate-phase2.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function migrate() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  });

  console.log('Connected to database. Running Phase 2 migration...\n');

  const migrations: { label: string; sql: string }[] = [
    // ─── Expenses: soft delete columns ───────────────────────────────
    {
      label: 'expenses.deleted_at',
      sql: `ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`,
    },
    {
      label: 'expenses.deleted_by',
      sql: `ALTER TABLE expenses ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL`,
    },
    {
      label: 'expenses.deleted_reason',
      sql: `ALTER TABLE expenses ADD COLUMN deleted_reason TEXT NULL`,
    },
    // ─── Expenses: status column (text → varchar with default) ───────
    {
      label: 'expenses.status → VARCHAR(20) DEFAULT pending',
      sql: `ALTER TABLE expenses MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'`,
    },

    // ─── Inventory Items: soft delete columns ────────────────────────
    {
      label: 'inventory_items.deleted_at',
      sql: `ALTER TABLE inventory_items ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`,
    },
    {
      label: 'inventory_items.deleted_by',
      sql: `ALTER TABLE inventory_items ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL`,
    },
    {
      label: 'inventory_items.deleted_reason',
      sql: `ALTER TABLE inventory_items ADD COLUMN deleted_reason TEXT NULL`,
    },
    // ─── Inventory Items: condition column ────────────────────────────
    {
      label: 'inventory_items.item_condition',
      sql: `ALTER TABLE inventory_items ADD COLUMN item_condition VARCHAR(20) NOT NULL DEFAULT 'new'`,
    },
    // ─── Inventory Items: expand status ENUM ─────────────────────────
    {
      label: 'inventory_items.status → expanded ENUM',
      sql: `ALTER TABLE inventory_items MODIFY COLUMN status ENUM('active','low_stock','out_of_stock','inactive','discontinued') NOT NULL DEFAULT 'active'`,
    },

    // ─── Inventory Transactions: audit columns ───────────────────────
    {
      label: 'inventory_transactions.balance_after',
      sql: `ALTER TABLE inventory_transactions ADD COLUMN balance_after INT NOT NULL DEFAULT 0`,
    },
    {
      label: 'inventory_transactions.unit_cost_at_transaction',
      sql: `ALTER TABLE inventory_transactions ADD COLUMN unit_cost_at_transaction DECIMAL(10,2) NULL`,
    },
    // ─── Inventory Transactions: soft delete columns ─────────────────
    {
      label: 'inventory_transactions.deleted_at',
      sql: `ALTER TABLE inventory_transactions ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`,
    },
    {
      label: 'inventory_transactions.deleted_by',
      sql: `ALTER TABLE inventory_transactions ADD COLUMN deleted_by VARCHAR(36) NULL DEFAULT NULL`,
    },
    {
      label: 'inventory_transactions.deleted_reason',
      sql: `ALTER TABLE inventory_transactions ADD COLUMN deleted_reason TEXT NULL`,
    },

    // ─── Activity Logs table ─────────────────────────────────────────
    {
      label: 'CREATE activity_logs',
      sql: `CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        action VARCHAR(30) NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT NULL,
        performed_by VARCHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      )`,
    },
  ];

  let success = 0;
  let skipped = 0;

  for (const m of migrations) {
    try {
      await connection.execute(m.sql);
      console.log(`  ✅ ${m.label}`);
      success++;
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log(`  ⏭️  ${m.label} (already exists)`);
        skipped++;
      } else {
        console.error(`  ❌ ${m.label}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Migration complete: ${success} applied, ${skipped} skipped.`);
  await connection.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
