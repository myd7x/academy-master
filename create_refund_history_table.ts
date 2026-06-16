import { db, pool } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Creating payment_refund_history table safely...");
  
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`payment_refund_history\` (
        \`id\` varchar(36) NOT NULL DEFAULT (UUID()),
        \`original_refund_id\` varchar(36) NOT NULL,
        \`payment_history_id\` varchar(36) NOT NULL,
        \`player_id\` varchar(36) NOT NULL,
        \`refund_amount\` decimal(10,2) NOT NULL,
        \`refund_method\` varchar(30) NOT NULL DEFAULT 'cash',
        \`reason\` text,
        \`refunded_by\` varchar(36),
        \`refund_date\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`archived_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`payment_refund_history_payment_history_id_fk\` FOREIGN KEY (\`payment_history_id\`) REFERENCES \`payment_history\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`payment_refund_history_player_id_fk\` FOREIGN KEY (\`player_id\`) REFERENCES \`players\` (\`id\`) ON DELETE CASCADE
      );
    `);
    console.log("Table payment_refund_history created successfully!");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    process.exit(0);
  }
}

main();
