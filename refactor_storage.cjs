const fs = require('fs');
const path = require('path');

const storagePath = path.join(__dirname, 'server', 'storage.ts');
let storage = fs.readFileSync(storagePath, 'utf8');

// 1. imports
storage = storage.replace(
  `  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";`,
  `  type ActivityLog,
  type InsertActivityLog,
  subscriptions,
  type Subscription,
  type InsertSubscription,
  accountingPeriods,
  auditLogs,
  trainerAdvanceRepayments,
} from "@shared/schema";`
);

// 2. createPlayer
storage = storage.replace(
  `  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = nanoid();
    await db.insert(players).values({
      ...insertPlayer,
      id,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    } as any);`,
  `  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = nanoid();
    await db.insert(players).values({
      ...insertPlayer,
      id,
    } as any);`
);

// 3. getPayments
storage = storage.replace(
  `        createdAt: payments.createdAt,
        playerName: players.fullName,
        activity: players.activity,
      })
      .from(payments)
      .leftJoin(players, eq(payments.playerId, players.id))`,
  `        createdAt: payments.createdAt,
        playerName: players.fullName,
        activity: sql<string>\`(SELECT activity FROM subscriptions WHERE player_id = \${players.id} ORDER BY created_at DESC LIMIT 1)\`,
      })
      .from(payments)
      .leftJoin(players, eq(payments.playerId, players.id))`
);

// 4. getAllSessions
storage = storage.replace(
  `        createdAt: sessions.createdAt,
        playerName: players.fullName,
        activity: players.activity,
      })
      .from(sessions)
      .leftJoin(players, eq(sessions.playerId, players.id))`,
  `        createdAt: sessions.createdAt,
        playerName: players.fullName,
        activity: subscriptions.activity,
      })
      .from(sessions)
      .leftJoin(players, eq(sessions.playerId, players.id))
      .leftJoin(subscriptions, eq(sessions.subscriptionId, subscriptions.id))`
);

// 5. sessionsAttended in createSession
storage = storage.replace(
  `    if (sess && (attendanceStatus === 'present' || attendanceStatus === 'late')) {
      await db
        .update(players)
        .set({ 
          sessionsAttended: sql\`\${players.sessionsAttended} + 1\`,
          updatedAt: new Date()
        })
        .where(eq(players.id, sess.playerId));
    }`,
  `    if (sess && (attendanceStatus === 'present' || attendanceStatus === 'late')) {
      await db
        .update(subscriptions)
        .set({ 
          sessionsUsed: sql\`\${subscriptions.sessionsUsed} + 1\`,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, sess.subscriptionId));
    }`
);

// 6. updateSession
storage = storage.replace(
  `      if (!wasAttended && isAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql\`\${players.sessionsAttended} + 1\`, updatedAt: new Date() })
          .where(eq(players.id, existingSession.playerId));
      } else if (wasAttended && !isAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql\`GREATEST(0, \${players.sessionsAttended} - 1)\`, updatedAt: new Date() })
          .where(eq(players.id, existingSession.playerId));
      }`,
  `      if (!wasAttended && isAttended) {
        await db.update(subscriptions)
          .set({ sessionsUsed: sql\`\${subscriptions.sessionsUsed} + 1\`, updatedAt: new Date() })
          .where(eq(subscriptions.id, existingSession.subscriptionId));
      } else if (wasAttended && !isAttended) {
        await db.update(subscriptions)
          .set({ sessionsUsed: sql\`GREATEST(0, \${subscriptions.sessionsUsed} - 1)\`, updatedAt: new Date() })
          .where(eq(subscriptions.id, existingSession.subscriptionId));
      }`
);

// 7. markAttendance
storage = storage.replace(
  `      if (!wasAttended && nowAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql\`\${players.sessionsAttended} + 1\`, updatedAt: new Date() })
          .where(eq(players.id, session.playerId));
      } else if (wasAttended && !nowAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql\`GREATEST(0, \${players.sessionsAttended} - 1)\`, updatedAt: new Date() })
          .where(eq(players.id, session.playerId));
      }`,
  `      if (!wasAttended && nowAttended) {
        await db.update(subscriptions)
          .set({ sessionsUsed: sql\`\${subscriptions.sessionsUsed} + 1\`, updatedAt: new Date() })
          .where(eq(subscriptions.id, session.subscriptionId));
      } else if (wasAttended && !nowAttended) {
        await db.update(subscriptions)
          .set({ sessionsUsed: sql\`GREATEST(0, \${subscriptions.sessionsUsed} - 1)\`, updatedAt: new Date() })
          .where(eq(subscriptions.id, session.subscriptionId));
      }`
);

// 8. updateExpiredSubscriptions
storage = storage.replace(
  `    // Mark as expired: subscriptionEndDate has passed and still active
    await db
      .update(players)
      .set({ subscriptionStatus: 'expired' as any, updatedAt: new Date() })
      .where(
        and(
          sql\`\${players.subscriptionEndDate} < \${now}\`,
          sql\`\${players.subscriptionEndDate} IS NOT NULL\`,
          sql\`\${players.subscriptionStatus} IN ('active', 'renewal_due')\`
        )
      );

    // Mark as renewal_due: subscriptionEndDate is within 3 days and still active
    await db
      .update(players)
      .set({ subscriptionStatus: 'renewal_due' as any, updatedAt: new Date() })
      .where(
        and(
          sql\`\${players.subscriptionEndDate} >= \${now}\`,
          sql\`\${players.subscriptionEndDate} <= \${threeDaysFromNow}\`,
          sql\`\${players.subscriptionEndDate} IS NOT NULL\`,
          eq(players.subscriptionStatus, 'active')
        )
      );`,
  `    // Mark as expired: subscriptionEndDate has passed and still active
    await db
      .update(subscriptions)
      .set({ status: 'expired' as any, updatedAt: new Date() })
      .where(
        and(
          sql\`\${subscriptions.endDate} < \${now}\`,
          sql\`\${subscriptions.endDate} IS NOT NULL\`,
          sql\`\${subscriptions.status} IN ('active', 'renewal_due')\`
        )
      );

    // Mark as renewal_due: subscriptionEndDate is within 3 days and still active
    await db
      .update(subscriptions)
      .set({ status: 'renewal_due' as any, updatedAt: new Date() })
      .where(
        and(
          sql\`\${subscriptions.endDate} >= \${now}\`,
          sql\`\${subscriptions.endDate} <= \${threeDaysFromNow}\`,
          sql\`\${subscriptions.endDate} IS NOT NULL\`,
          eq(subscriptions.status, 'active')
        )
      );`
);

// 9. getDashboardStats
storage = storage.replace(
  `    const activeSubscriptionsResult = await db
      .select({ count: count() })
      .from(players)
      .where(eq(players.subscriptionStatus, 'active'));`,
  `    const activeSubscriptionsResult = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));`
);

storage = storage.replace(
  `    // ── Player Activity Breakdown ─────────────────────────────────────────────
    const playersByActivityResult = await db
      .select({ activity: players.activity, count: count() })
      .from(players)
      .groupBy(players.activity);`,
  `    // ── Player Activity Breakdown ─────────────────────────────────────────────
    const playersByActivityResult = await db
      .select({ activity: subscriptions.activity, count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.activity);`
);

storage = storage.replace(
  `    const overduePaymentsResult = await db
      .select({ total: sql<string>\`COALESCE(CAST(SUM(\${payments.remainingBalance}) AS CHAR), '0')\` })
      .from(payments)
      .leftJoin(players, eq(payments.playerId, players.id))
      .where(
        and(
          sql\`\${payments.remainingBalance} > 0\`,
          sql\`\${players.subscriptionStatus} IN ('expired', 'cancelled')\`
        )
      );`,
  `    const overduePaymentsResult = await db
      .select({ total: sql<string>\`COALESCE(CAST(SUM(\${payments.remainingBalance}) AS CHAR), '0')\` })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.playerId, subscriptions.playerId))
      .where(
        and(
          sql\`\${payments.remainingBalance} > 0\`,
          sql\`\${subscriptions.status} IN ('expired', 'cancelled')\`
        )
      );`
);

// 10. getUpcomingRenewals
storage = storage.replace(
  `    const upcomingRenewals = await db
      .select()
      .from(players)
      .where(
        and(
          lte(players.renewalDate, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // Within 7 days
          sql\`\${players.subscriptionStatus} IN ('active', 'renewal_due')\`
        )
      )
      .orderBy(asc(players.renewalDate));

    return upcomingRenewals.map((player: any) => ({
      ...player,
      sessionsLeft: Math.max(0, player.totalSessionsAllowed - player.sessionsAttended)
    }));`,
  `    const upcomingRenewals = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        phoneNumber: players.phoneNumber,
        subscription: subscriptions
      })
      .from(players)
      .innerJoin(subscriptions, eq(players.id, subscriptions.playerId))
      .where(
        and(
          lte(subscriptions.endDate, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // Within 7 days
          sql\`\${subscriptions.status} IN ('active', 'renewal_due')\`
        )
      )
      .orderBy(asc(subscriptions.endDate));

    return upcomingRenewals.map((record: any) => ({
      ...record,
      sessionsLeft: Math.max(0, record.subscription.sessionsAllowed - record.subscription.sessionsUsed)
    }));`
);

// 11. getRecentActivities
storage = storage.replace(
  `        activity: players.activity,`,
  `        activity: sql<string>\`(SELECT activity FROM subscriptions WHERE player_id = \${players.id} ORDER BY created_at DESC LIMIT 1)\`,`
);

// 12. getRenewalNotifications
storage = storage.replace(
  `    // Get all active + renewal_due + expired players that need attention
    const allActivePlayers = await db
      .select()
      .from(players)
      .where(sql\`\${players.subscriptionStatus} IN ('active', 'renewal_due', 'expired')\`)
      .orderBy(asc(players.renewalDate));

    const now = new Date();
    const notifications: any[] = [];

    for (const player of allActivePlayers) {
      const renewalDate = player.renewalDate ? new Date(player.renewalDate) : null;
      const endDate = player.subscriptionEndDate ? new Date(player.subscriptionEndDate) : renewalDate;
      const referenceDate = endDate || renewalDate;
      const daysUntilRenewal = referenceDate
        ? Math.ceil((referenceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const sessionsLeft = Math.max(0, player.totalSessionsAllowed - player.sessionsAttended);
      
      // Only show notifications for players who actually need renewal or have low sessions
      let shouldNotify = false;
      let reason: 'sessions_low' | 'renewal_due' = 'sessions_low';

      // Expired subscriptions always show
      if (player.subscriptionStatus === 'expired' || daysUntilRenewal < 0) {
        shouldNotify = true;
        reason = 'renewal_due';
      }
      // Renewal due status or within 3 days
      else if (player.subscriptionStatus === 'renewal_due' || daysUntilRenewal <= 3) {
        shouldNotify = true;
        reason = 'renewal_due';
      }
      // Sessions critically low (3 or fewer)
      else if (sessionsLeft <= 3) {
        shouldNotify = true;
        reason = 'sessions_low';
      }

      if (shouldNotify) {
        notifications.push({
          playerId: player.id,
          playerName: player.fullName,
          activity: player.activity,
          renewalDate: player.renewalDate,
          daysUntilRenewal,
          sessionsLeft,
          subscriptionStatus: player.subscriptionStatus,
          reason
        });
      }
    }`,
  `    // Get all active + renewal_due + expired players that need attention
    const activeSubs = await db
      .select({
        player: players,
        subscription: subscriptions
      })
      .from(subscriptions)
      .innerJoin(players, eq(players.id, subscriptions.playerId))
      .where(sql\`\${subscriptions.status} IN ('active', 'renewal_due', 'expired')\`)
      .orderBy(asc(subscriptions.endDate));

    const now = new Date();
    const notifications: any[] = [];

    for (const record of activeSubs) {
      const player = record.player;
      const sub = record.subscription;
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      const referenceDate = endDate;
      const daysUntilRenewal = referenceDate
        ? Math.ceil((referenceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const sessionsLeft = Math.max(0, sub.sessionsAllowed - sub.sessionsUsed);
      
      let shouldNotify = false;
      let reason: 'sessions_low' | 'renewal_due' = 'sessions_low';

      if (sub.status === 'expired' || daysUntilRenewal < 0) {
        shouldNotify = true;
        reason = 'renewal_due';
      } else if (sub.status === 'renewal_due' || daysUntilRenewal <= 3) {
        shouldNotify = true;
        reason = 'renewal_due';
      } else if (sessionsLeft <= 3) {
        shouldNotify = true;
        reason = 'sessions_low';
      }

      if (shouldNotify) {
        notifications.push({
          playerId: player.id,
          playerName: player.fullName,
          activity: sub.activity,
          renewalDate: sub.endDate,
          daysUntilRenewal,
          sessionsLeft,
          subscriptionStatus: sub.status,
          reason
        });
      }
    }`
);

fs.writeFileSync(storagePath, storage, 'utf8');
console.log('Successfully refactored storage.ts');
