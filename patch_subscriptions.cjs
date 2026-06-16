const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routes = fs.readFileSync(routesPath, 'utf8');

// FIX CREATE PLAYER
// Current code just calls storage.createPlayer(playerData) and ignores the rest
// We need to inject the subscription insertion.

const createPlayerRegex = /const player = await storage\.createPlayer\(playerData\);/;
if (createPlayerRegex.test(routes) && !routes.includes('db.insert(subscriptions)')) {
  routes = routes.replace(
    /const player = await storage\.createPlayer\(playerData\);/,
    `const player = await storage.createPlayer(playerData);

      // Create the initial subscription
      const { nanoid } = require('nanoid');
      await db.insert(subscriptions).values({
        id: nanoid(),
        playerId: player.id,
        activity: req.body.activity || 'football',
        status: 'active',
        startDate: subscriptionDate,
        endDate: subscriptionEndDate,
        sessionsAllowed: parseInt(req.body.totalSessionsAllowed) || 8,
        sessionsUsed: 0,
        monthlyFee: Array.isArray(req.body.subscriptionFee) ? req.body.subscriptionFee[0] : (req.body.subscriptionFee || "200"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });`
  );
}

// FIX RENEW PLAYER
// Around line 327:
// const updatedPlayer = await storage.updatePlayer(id, renewalData);
if (!routes.includes('// Create new subscription record')) {
  routes = routes.replace(
    /const updatedPlayer = await storage\.updatePlayer\(id, renewalData\);/,
    `const updatedPlayer = await storage.updatePlayer(id, renewalData);
      
      // Create new subscription record
      const { nanoid } = require('nanoid');
      await db.insert(subscriptions).values({
        id: nanoid(),
        playerId: id,
        activity: currentPlayer.activity || 'football',
        status: 'active',
        startDate: newSubscriptionDate,
        endDate: newRenewalDate,
        sessionsAllowed: totalSessionsAllowed || (currentPlayer as any).totalSessionsAllowed || 8,
        sessionsUsed: 0,
        monthlyFee: subscriptionFee || (currentPlayer as any).monthlySubscriptionFee || "200",
        createdAt: new Date(),
        updatedAt: new Date(),
      });`
  );
}

// FIX UPDATE PLAYER
// We need to intercept updateData and update subscriptions if it contains subscription fields.
if (!routes.includes('// Also update the active subscription')) {
  routes = routes.replace(
    /const player = await storage\.updatePlayer\(req\.params\.id, playerData\);/,
    `const player = await storage.updatePlayer(req.params.id, playerData);
      
      // Also update the active subscription if relevant fields are passed
      if (req.body.activity || req.body.subscriptionEndDate || req.body.subscriptionDate) {
        const updateSubData: any = { updatedAt: new Date() };
        if (req.body.activity) updateSubData.activity = req.body.activity;
        if (req.body.subscriptionDate) updateSubData.startDate = new Date(req.body.subscriptionDate);
        if (req.body.subscriptionEndDate) updateSubData.endDate = new Date(req.body.subscriptionEndDate);
        
        await db.update(subscriptions)
          .set(updateSubData)
          .where(and(eq(subscriptions.playerId, req.params.id), eq(subscriptions.status, 'active')));
      }`
  );
}

fs.writeFileSync(routesPath, routes, 'utf8');
console.log('Routes patched for subscription inserts successfully');

