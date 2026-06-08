import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Creating expenses table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`expenses\` (
      \`id\` varchar(36) NOT NULL DEFAULT (UUID()),
      \`category\` enum('rent','utilities','maintenance','equipment','salary','marketing','transportation','other') NOT NULL,
      \`amount\` decimal(10,2) NOT NULL,
      \`date\` timestamp NOT NULL DEFAULT (now()),
      \`description\` text,
      \`payment_method\` enum('cash','visa','bank_transfer') NOT NULL DEFAULT 'cash',
      \`receipt_url\` text,
      \`created_by\` varchar(36),
      \`updated_by\` varchar(36),
      \`status\` text,
      \`notes\` text,
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`expenses_id\` PRIMARY KEY(\`id\`)
    );
  `);

  console.log("Creating inventory_items table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`inventory_items\` (
      \`id\` varchar(36) NOT NULL DEFAULT (UUID()),
      \`name\` text NOT NULL,
      \`sku\` varchar(100),
      \`category\` text NOT NULL,
      \`quantity\` int NOT NULL DEFAULT 0,
      \`min_quantity\` int NOT NULL DEFAULT 0,
      \`unit_price\` decimal(10,2),
      \`location\` text,
      \`status\` enum('active','inactive','discontinued') NOT NULL DEFAULT 'active',
      \`image_url\` text,
      \`created_by\` varchar(36),
      \`updated_by\` varchar(36),
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      \`updated_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`inventory_items_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`inventory_items_sku_unique\` UNIQUE(\`sku\`)
    );
  `);

  console.log("Creating inventory_transactions table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS \`inventory_transactions\` (
      \`id\` varchar(36) NOT NULL DEFAULT (UUID()),
      \`item_id\` varchar(36) NOT NULL,
      \`type\` enum('in','out','adjustment') NOT NULL,
      \`quantity\` int NOT NULL,
      \`transaction_date\` timestamp NOT NULL DEFAULT (now()),
      \`reference\` text,
      \`notes\` text,
      \`created_by\` varchar(36),
      \`created_at\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`inventory_transactions_id\` PRIMARY KEY(\`id\`)
    );
  `);

  console.log("Adding foreign keys...");
  try {
    await db.execute(sql`ALTER TABLE \`expenses\` ADD CONSTRAINT \`expenses_created_by_users_id_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }
  
  try {
    await db.execute(sql`ALTER TABLE \`expenses\` ADD CONSTRAINT \`expenses_updated_by_users_id_fk\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }

  try {
    await db.execute(sql`ALTER TABLE \`inventory_items\` ADD CONSTRAINT \`inventory_items_created_by_users_id_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }

  try {
    await db.execute(sql`ALTER TABLE \`inventory_items\` ADD CONSTRAINT \`inventory_items_updated_by_users_id_fk\` FOREIGN KEY (\`updated_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }

  try {
    await db.execute(sql`ALTER TABLE \`inventory_transactions\` ADD CONSTRAINT \`inventory_transactions_item_id_inventory_items_id_fk\` FOREIGN KEY (\`item_id\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE cascade ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }

  try {
    await db.execute(sql`ALTER TABLE \`inventory_transactions\` ADD CONSTRAINT \`inventory_transactions_created_by_users_id_fk\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE no action ON UPDATE no action;`);
  } catch (e: any) { if (!e.message.includes("Duplicate foreign key constraint")) console.error(e.message); }

  console.log("Migration complete.");
  process.exit(0);
}

run().catch(console.error);
