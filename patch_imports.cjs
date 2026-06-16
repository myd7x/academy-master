const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routes = fs.readFileSync(routesPath, 'utf8');

if (!routes.includes('import { db } from "./db";')) {
  routes = routes.replace(
    `import { insertPlayerSchema, insertPaymentSchema, insertSessionSchema, ALLOWED_REFUND_METHODS } from "@shared/schema";`,
    `import { insertPlayerSchema, insertPaymentSchema, insertSessionSchema, ALLOWED_REFUND_METHODS, subscriptions } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";`
  );
}

// Fix currentPlayer.activity
routes = routes.replace(
  `activity: currentPlayer.activity || 'football',`,
  `activity: (currentPlayer as any).activity || 'football',`
);

fs.writeFileSync(routesPath, routes, 'utf8');
console.log('Imports and types patched');
