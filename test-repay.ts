import { storage } from "./server/storage.js";

async function test() {
  console.log("Testing repayTrainerAdvance...");
  try {
    const advance = await storage.repayTrainerAdvance("KEnkJXpSUaRcGzemWB6Fv");
    console.log("Result:", advance);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

test();
