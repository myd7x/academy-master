import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Fixing int(11) columns on players table to avoid Drizzle truncate error...");
  
  try {
    await db.execute(sql`ALTER TABLE players MODIFY COLUMN total_sessions_allowed INT NOT NULL DEFAULT 8;`);
    console.log("Fixed total_sessions_allowed");
  } catch (err: any) {
    console.error("Error fixing total_sessions_allowed:", err.message);
  }

  try {
    await db.execute(sql`ALTER TABLE players MODIFY COLUMN sessions_attended INT NOT NULL DEFAULT 0;`);
    console.log("Fixed sessions_attended");
  } catch (err: any) {
    console.error("Error fixing sessions_attended:", err.message);
  }
  
  try {
    await db.execute(sql`ALTER TABLE player_documents MODIFY COLUMN file_size INT NOT NULL;`);
    console.log("Fixed file_size");
  } catch (err: any) {
    console.error("Error fixing file_size:", err.message);
  }

  console.log("Fix complete.");
  process.exit(0);
}

run().catch(console.error);
