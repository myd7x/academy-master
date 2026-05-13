import { storage } from "./server/storage";

async function run() {
  const playerId = "2fs-WK6NLqVXwrD4v_bxF";
  const payments = await storage.getPlayerPayments(playerId);
  console.log(JSON.stringify(payments, null, 2));
  process.exit(0);
}

run().catch(console.error);
