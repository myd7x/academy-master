const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, 'server', 'storage.ts');
let storage = fs.readFileSync(storagePath, 'utf8');

// Fix getPlayersByActivity
storage = storage.replace(
  `  async getPlayersByActivity(activity: string): Promise<Player[]> {
    await this.updateExpiredSubscriptions();
    return await db.select().from(players).where(eq(players.activity, activity as any));
  }`,
  `  async getPlayersByActivity(activity: string): Promise<Player[]> {
    await this.updateExpiredSubscriptions();
    const records = await db.select({ player: players })
      .from(subscriptions)
      .innerJoin(players, eq(players.id, subscriptions.playerId))
      .where(and(eq(subscriptions.activity, activity as any), eq(subscriptions.status, 'active')));
    // Deduplicate players if they have multiple active subscriptions of same activity
    const uniquePlayers = [];
    const seen = new Set();
    for (const r of records) {
      if (!seen.has(r.player.id)) {
        seen.add(r.player.id);
        uniquePlayers.push(r.player);
      }
    }
    return uniquePlayers;
  }`
);

// Fix getPayments missing totalRefunded
storage = storage.replace(
  `        paymentDate: payments.paymentDate,
        receiptNumber: payments.receiptNumber,
        description: payments.description,
        createdAt: payments.createdAt,`,
  `        paymentDate: payments.paymentDate,
        receiptNumber: payments.receiptNumber,
        description: payments.description,
        totalRefunded: payments.totalRefunded,
        createdAt: payments.createdAt,`
);

// Fix getAllSessions missing subscriptionId
storage = storage.replace(
  `        actualStartTime: sessions.actualStartTime,
        actualEndTime: sessions.actualEndTime,
        attendanceStatus: sessions.attendanceStatus,`,
  `        actualStartTime: sessions.actualStartTime,
        actualEndTime: sessions.actualEndTime,
        subscriptionId: sessions.subscriptionId,
        attendanceStatus: sessions.attendanceStatus,`
);

fs.writeFileSync(storagePath, storage, 'utf8');

// Now fixing routes.ts
const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routes = fs.readFileSync(routesPath, 'utf8');

// Fix createTrainerAdvance missing remainingBalance
routes = routes.replace(
  `const insertAdvance = {
        ...req.body,
        trainerId: req.params.id,
      };`,
  `const insertAdvance = {
        ...req.body,
        remainingBalance: req.body.amount, // Set remaining balance to total amount on creation
        trainerId: req.params.id,
      };`
);

fs.writeFileSync(routesPath, routes, 'utf8');
console.log('Successfully applied fixes');
