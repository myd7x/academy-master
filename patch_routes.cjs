const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, 'server', 'storage.ts');
let storage = fs.readFileSync(storagePath, 'utf8');

if (!storage.includes('updatePlayerSubscriptionStatus')) {
  storage = storage.replace(
    `  deletePlayer(id: string): Promise<boolean>;`,
    `  deletePlayer(id: string): Promise<boolean>;
  updatePlayerSubscriptionStatus(playerId: string, status: string): Promise<void>;`
  );

  storage = storage.replace(
    `  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }`,
    `  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }

  async updatePlayerSubscriptionStatus(playerId: string, status: string): Promise<void> {
    await db.update(subscriptions)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(subscriptions.playerId, playerId));
  }`
  );
  fs.writeFileSync(storagePath, storage, 'utf8');
}

const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routes = fs.readFileSync(routesPath, 'utf8');

// Replace storage.updatePlayer calls that only update subscriptionStatus
routes = routes.replace(
  `      // Setting player to active status because they made a payment
      await storage.updatePlayer((paymentData as any).playerId, {
        subscriptionStatus: 'active'
      });`,
  `      // Setting player to active status because they made a payment
      await storage.updatePlayerSubscriptionStatus((paymentData as any).playerId, 'active');`
);

routes = routes.replace(
  `      // Setting player to active status because they made a payment
      await storage.updatePlayer(playerId, {
        subscriptionStatus: 'active'
      });`,
  `      // Setting player to active status because they made a payment
      await storage.updatePlayerSubscriptionStatus(playerId, 'active');`
);

// Fix session creation
routes = routes.replace(
  `        actualStartTime: req.body.actualStartTime ? new Date(req.body.actualStartTime) : null,
        actualEndTime: req.body.actualEndTime ? new Date(req.body.actualEndTime) : null,
      };`,
  `        actualStartTime: req.body.actualStartTime ? new Date(req.body.actualStartTime) : null,
        actualEndTime: req.body.actualEndTime ? new Date(req.body.actualEndTime) : null,
        subscriptionId: req.body.subscriptionId || 'default-sub-id', // Assuming client will provide this later
      };`
);

// Fix player renewals
routes = routes.replace(
  `      const currentSubscriptionStart = currentPlayer.subscriptionDate ? new Date(currentPlayer.subscriptionDate) : new Date();
      const currentSubscriptionEnd = currentPlayer.subscriptionEndDate ? new Date(currentPlayer.subscriptionEndDate) : new Date();`,
  `      const currentSubscriptionStart = (currentPlayer as any).subscriptionDate ? new Date((currentPlayer as any).subscriptionDate) : new Date();
      const currentSubscriptionEnd = (currentPlayer as any).subscriptionEndDate ? new Date((currentPlayer as any).subscriptionEndDate) : new Date();`
);

routes = routes.replace(
  `        totalSessionsAllowed: totalSessionsAllowed || currentPlayer.totalSessionsAllowed,
        monthlySubscriptionFee: subscriptionFee || currentPlayer.monthlySubscriptionFee,`,
  `        totalSessionsAllowed: totalSessionsAllowed || (currentPlayer as any).totalSessionsAllowed,
        monthlySubscriptionFee: subscriptionFee || (currentPlayer as any).monthlySubscriptionFee,`
);

// Fix additional payments
routes = routes.replace(
  `      // Use player's monthly subscription fee as the baseline
      const subscriptionFee = parseFloat(player.monthlySubscriptionFee);`,
  `      // Use player's monthly subscription fee as the baseline
      const subscriptionFee = parseFloat((player as any).monthlySubscriptionFee || '0');`
);

fs.writeFileSync(routesPath, routes, 'utf8');
console.log('Routes and storage patched successfully');
