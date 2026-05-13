import { storage } from "./server/storage.js";

async function dump() {
  const playerId = "18NCzkFU4jGRjEp2S7SwI";
  console.log("Dumping documents for player:", playerId);
  const docs = await storage.getPlayerDocuments(playerId);
  console.log(JSON.stringify(docs, null, 2));
  process.exit(0);
}

dump();
