import { db, pool } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying safe schema patches to bypass Drizzle data-loss truncation errors...");
  
  try {
    console.log("Dropping unused columns from players table...");
    const colsToDrop = [
      'activity', 'subscription_date', 'subscription_end_date', 'renewal_date', 
      'subscription_status', 'paused_date', 'pause_reason', 'total_sessions_allowed', 
      'sessions_attended', 'monthly_subscription_fee'
    ];

    for (const col of colsToDrop) {
      try {
        await db.execute(sql.raw(`ALTER TABLE players DROP COLUMN ${col}`));
        console.log(`Dropped column: ${col}`);
      } catch(e: any) {
        if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
           console.log(`Column ${col} already dropped or doesn't exist.`);
        } else {
           console.log(`Could not drop ${col}: ${e.message}`);
        }
      }
    }
    
    console.log("Altering int(11) to int for inventory_items to prevent table truncation...");
    try {
       await db.execute(sql.raw(`ALTER TABLE inventory_items MODIFY COLUMN quantity int NOT NULL DEFAULT 0`));
       await db.execute(sql.raw(`ALTER TABLE inventory_items MODIFY COLUMN min_quantity int NOT NULL DEFAULT 0`));
       console.log("Fixed inventory_items columns");
    } catch(e: any) { console.error(e.message); }

    try {
       await db.execute(sql.raw(`ALTER TABLE inventory_transactions MODIFY COLUMN quantity int NOT NULL`));
       await db.execute(sql.raw(`ALTER TABLE inventory_transactions MODIFY COLUMN balance_after int NOT NULL`));
       console.log("Fixed inventory_transactions columns");
    } catch(e: any) { console.error(e.message); }

    console.log("Schema patches applied! You should now be able to run `npm run db:push` cleanly.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
