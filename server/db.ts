// Local database configuration

import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Default to XAMPP local MySQL instance if DATABASE_URL is not set
const databaseUrl = process.env.DATABASE_URL || "mysql://root:@localhost:3306/academy_flow";

if (!databaseUrl.startsWith('mysql://')) {
  throw new Error("unsupported database type. Please use mysql:// in your DATABASE_URL");
}

// Use a connection POOL (not a single connection) so that db.transaction() can
// acquire a dedicated connection per transaction and release it on commit/rollback.
// A single shared connection cannot safely handle concurrent transactions.
const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: 'default' });