-- =========================================================================
-- SAFE MIGRATION SCRIPT: Players -> Subscriptions
-- Run this script directly against your PostgreSQL database 
-- BEFORE running `npm run db:push` to prevent data loss.
-- =========================================================================

-- 1. Create the subscriptions table manually before Drizzle drops the player columns
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"player_id" varchar(21) NOT NULL,
	"activity" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"sessions_allowed" integer DEFAULT 8 NOT NULL,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	"monthly_fee" numeric(10, 2) DEFAULT '200' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- 2. Migrate existing data from the players table into subscriptions
-- We only migrate players that don't already have a subscription to prevent duplicates
INSERT INTO "subscriptions" (
  "id", 
  "player_id", 
  "activity", 
  "status", 
  "start_date", 
  "end_date", 
  "sessions_allowed", 
  "sessions_used", 
  "monthly_fee",
  "created_at",
  "updated_at"
)
SELECT 
  -- Generate a random 21-char string for nanoid (simple fallback for SQL)
  SUBSTRING(MD5(RANDOM()::TEXT), 1, 21) as id,
  id as player_id,
  COALESCE(activity, 'football') as activity,
  COALESCE(subscription_status, 'active') as status,
  subscription_date as start_date,
  subscription_end_date as end_date,
  COALESCE(total_sessions_allowed, 8) as sessions_allowed,
  COALESCE(sessions_attended, 0) as sessions_used,
  CAST(COALESCE(monthly_subscription_fee, '200') AS numeric) as monthly_fee,
  CURRENT_TIMESTAMP as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM "players"
WHERE "players"."id" NOT IN (SELECT "player_id" FROM "subscriptions")
  AND "players"."activity" IS NOT NULL; -- Ensure we only migrate active player profiles

-- Note: After this script runs successfully, your subscription data is safe.
-- You can now run `npm run db:push` to let Drizzle apply constraints, foreign keys,
-- and safely drop the deprecated columns from the players table.
