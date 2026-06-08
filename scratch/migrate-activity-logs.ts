import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const connection = await createConnection(process.env.DATABASE_URL!);
  try {
    console.log("Checking for ip_address column...");
    await connection.query('ALTER TABLE activity_logs ADD COLUMN ip_address VARCHAR(45);');
    console.log("Added ip_address column successfully.");
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Column ip_address already exists.");
    } else {
      console.error(e);
    }
  }

  try {
    console.log("Checking for user_agent column...");
    await connection.query('ALTER TABLE activity_logs ADD COLUMN user_agent TEXT;');
    console.log("Added user_agent column successfully.");
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Column user_agent already exists.");
    } else {
      console.error(e);
    }
  }

  await connection.end();
  console.log("Migration complete!");
}

runMigration();
