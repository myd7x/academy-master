import { nanoid } from "nanoid";
import { 
  players, 
  playerDocuments, 
  payments, 
  paymentRefunds,
  paymentHistory,
  sessions,
  users,
  trainers,
  trainerSalaryPayments,
  trainerAdvances,
  trainerBonuses,
  trainerPayrolls,
  type Player, 
  type InsertPlayer,
  type PlayerDocument,
  type InsertPlayerDocument,
  type Payment,
  type InsertPayment,
  type PaymentRefund,
  type InsertPaymentRefund,
  type PaymentHistory,
  type InsertPaymentHistory,
  type Session,
  type InsertSession,
  type User,
  type InsertUser,
  type Trainer,
  type InsertTrainer,
  type TrainerSalaryPayment,
  type InsertTrainerSalaryPayment,
  type TrainerAdvance,
  type InsertTrainerAdvance,
  type TrainerBonus,
  type InsertTrainerBonus,
  type TrainerPayroll,
  type InsertTrainerPayroll,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, and, gte, lte, count, sum } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────
// Allowed refund methods — any other value is rejected at the storage layer
export const ALLOWED_REFUND_METHODS = [
  'cash', 'bank_transfer', 'card_reversal', 'wallet', 'adjustment'
] as const;
export type RefundMethod = typeof ALLOWED_REFUND_METHODS[number];

// ─────────────────────────────────────────────────────────────────
// Structured audit logger — emits JSON to stdout for log aggregation
type RefundEventType = 
  | 'REFUND_SUCCESS'
  | 'REFUND_FAILED_VALIDATION'
  | 'REFUND_FAILED_OVER_LIMIT'
  | 'REFUND_FAILED_CANCELLED'
  | 'REFUND_FAILED_FULLY_REFUNDED'
  | 'REFUND_FAILED_INVALID_METHOD'
  | 'REFUND_TRANSACTION_ERROR';

function logRefundEvent(event: RefundEventType, details: {
  adminId?: string;
  paymentId: string;
  playerId?: string;
  amount?: number;
  error?: string;
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  // Use stderr for error events, stdout for success
  if (event === 'REFUND_SUCCESS') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}

// ─────────────────────────────────────────────────────────────────
// Safe integer-cent arithmetic for money — avoids JS float precision issues.
// All DB values are stored as DECIMAL(10,2) strings; convert once to cents,
// do integer arithmetic, convert back to string with .toFixed(2) for storage.
function toCents(decimalStr: string | number): number {
  return Math.round(parseFloat(String(decimalStr)) * 100);
}
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}


export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Players
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayerById(id: string): Promise<Player | undefined>;
  getPlayers(): Promise<Player[]>;
  getPlayersByActivity(activity: string): Promise<Player[]>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, player: Partial<InsertPlayer>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<boolean>;
  
  // Player Documents
  getPlayerDocuments(playerId: string): Promise<PlayerDocument[]>;
  createPlayerDocument(document: InsertPlayerDocument): Promise<PlayerDocument>;
  deletePlayerDocument(id: string): Promise<boolean>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPayments(): Promise<Payment[]>;
  getPlayerPayments(playerId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;

  // Payment Refunds
  createPaymentRefund(refund: InsertPaymentRefund, refundedBy?: string): Promise<PaymentRefund>;
  getPaymentRefunds(paymentId: string): Promise<PaymentRefund[]>;
  getPlayerRefunds(playerId: string): Promise<PaymentRefund[]>;
  getRefundSummary(paymentId: string): Promise<{ totalRefunded: number; remainingRefundable: number }>;
  
  // Payment History
  getPlayerPaymentHistory(playerId: string): Promise<PaymentHistory[]>;
  archivePlayerPayments(playerId: string, subscriptionPeriodStart: Date, subscriptionPeriodEnd: Date): Promise<void>;
  clearPlayerCurrentPayments(playerId: string): Promise<void>;
  
  // Sessions
  getPlayerSessions(playerId: string): Promise<Session[]>;
  getAllSessions(): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session | undefined>;
  markAttendance(sessionId: string, attendanceStatus: string, notes?: string): Promise<Session | undefined>;
  
  // Dashboard Statistics
  getDashboardStats(): Promise<{
    totalPlayers: number;
    activeSubscriptions: number;
    pendingPayments: string;
    playersByActivity: Array<{ activity: string; count: number }>;
    outstandingSalaries: string;
    totalAdvancesOutstanding: string;
    // Cash-flow monthly
    monthlyIncome: string;
    monthlyExpenses: string;
    monthlyProfit: string;
    // Cash-flow monthly breakdown
    monthlyPlayerRevenue: string;
    monthlyAdvanceRepayments: string;
    monthlyTrainerCashPayments: string;
    monthlyAdvancesCreated: string;
    monthlyRefunds: string;
    // Cash-flow annual
    annualIncome: string;
    annualExpenses: string;
    annualNetProfit: string;
    annualRefunds: string;
    // Legacy (keep for backward compat)
    monthlyRevenue: string;
    totalSalaryExpenses: string;
    totalBonuses: string;
  }>;
  
  // Trainer CRUD
  getTrainers(): Promise<Trainer[]>;
  getTrainer(id: string): Promise<Trainer | undefined>;
  createTrainer(trainer: InsertTrainer): Promise<Trainer>;
  updateTrainer(id: string, trainer: Partial<InsertTrainer>): Promise<Trainer | undefined>;
  deleteTrainer(id: string): Promise<boolean>;

  // Trainer Salary Payments
  getTrainerSalaryPayments(trainerId?: string, month?: string): Promise<TrainerSalaryPayment[]>;
  createTrainerSalaryPayment(
    payment: InsertTrainerSalaryPayment,
    advanceIdsToDeduct?: string[]
  ): Promise<TrainerSalaryPayment>;

  // Trainer Advances
  getTrainerAdvances(trainerId?: string, status?: string): Promise<TrainerAdvance[]>;
  createTrainerAdvance(advance: InsertTrainerAdvance): Promise<TrainerAdvance>;
  repayTrainerAdvance(advanceId: string): Promise<TrainerAdvance | undefined>;

  // Trainer Bonuses
  getTrainerBonuses(trainerId?: string, month?: string): Promise<TrainerBonus[]>;
  createTrainerBonus(bonus: InsertTrainerBonus): Promise<TrainerBonus>;

  // Trainer Payroll / Ledger
  getTrainerPayroll(trainerId: string, month: string): Promise<TrainerPayroll | undefined>;
  lockTrainerPayroll(trainerId: string, month: string): Promise<TrainerPayroll>;

  getTrainerLedger(trainerId: string, month: string): Promise<{
    baseSalary: string;
    carryForward: string;
    totalBonuses: string;
    totalPendingAdvances: string;
    totalPaid: string;
    netPayable: string;
    status: "unpaid" | "partial" | "paid" | "over_advanced";
    isLocked: boolean;
    advances: TrainerAdvance[];
    payments: TrainerSalaryPayment[];
    bonuses: TrainerBonus[];
  }>;
  
  // Reports
  getUpcomingRenewals(): Promise<Array<Player & { sessionsLeft: number }>>;
  getRecentActivities(): Promise<Array<{
    type: string;
    description: string;
    timestamp: Date;
    playerId?: string;
    playerName?: string;
  }>>;
  getRenewalNotifications(): Promise<Array<{
    playerId: string;
    playerName: string;
    activity: string;
    renewalDate: Date;
    daysUntilRenewal: number;
    sessionsLeft: number;
    subscriptionStatus: string;
    reason: 'sessions_low' | 'renewal_due';
  }>>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = nanoid();
    await db.insert(users).values({ ...insertUser, id });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getPlayerById(id: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getPlayers(): Promise<Player[]> {
    await this.updateExpiredSubscriptions();
    return await db.select().from(players).orderBy(desc(players.createdAt));
  }

  async getPlayersByActivity(activity: string): Promise<Player[]> {
    await this.updateExpiredSubscriptions();
    return await db.select().from(players).where(eq(players.activity, activity as any));
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = nanoid();
    await db.insert(players).values({
      ...insertPlayer,
      id,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    } as any);
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async updatePlayer(id: string, playerUpdate: Partial<InsertPlayer>): Promise<Player | undefined> {
    await db
      .update(players)
      .set({ ...playerUpdate, updatedAt: new Date() })
      .where(eq(players.id, id));
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async deletePlayer(id: string): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }

  async getPlayerDocuments(playerId: string): Promise<PlayerDocument[]> {
    return await db.select().from(playerDocuments).where(eq(playerDocuments.playerId, playerId));
  }

  async getPlayerDocument(id: string): Promise<PlayerDocument | null> {
    const [doc] = await db.select().from(playerDocuments).where(eq(playerDocuments.id, id));
    return doc || null;
  }

  async createPlayerDocument(document: InsertPlayerDocument): Promise<PlayerDocument> {
    const id = nanoid();
    await db.insert(playerDocuments).values({ ...document, id } as any);
    const [doc] = await db.select().from(playerDocuments).where(eq(playerDocuments.id, id));
    return doc;
  }

  async deletePlayerDocument(id: string): Promise<boolean> {
    const result = await db.delete(playerDocuments).where(eq(playerDocuments.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPayments(): Promise<Payment[]> {
    return await db
      .select({
        id: payments.id,
        playerId: payments.playerId,
        subscriptionFee: payments.subscriptionFee,
        amountPaid: payments.amountPaid,
        remainingBalance: payments.remainingBalance,
        paymentMethod: payments.paymentMethod,
        paymentStatus: payments.paymentStatus,
        paymentDate: payments.paymentDate,
        receiptNumber: payments.receiptNumber,
        description: payments.description,
        createdAt: payments.createdAt,
        playerName: players.fullName,
        activity: players.activity,
      })
      .from(payments)
      .leftJoin(players, eq(payments.playerId, players.id))
      .orderBy(desc(payments.createdAt));
  }

  async getPlayerPayments(playerId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.playerId, playerId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = nanoid();
    const receiptNumber = `E1-${new Date().getFullYear()}-${Date.now()}`;
    await db.insert(payments).values({
      ...insertPayment,
      id,
      receiptNumber,
    } as any);
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async updatePayment(id: string, paymentUpdate: Partial<InsertPayment>): Promise<Payment | undefined> {
    await db
      .update(payments)
      .set(paymentUpdate)
      .where(eq(payments.id, id));
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  // ─── Payment Refund methods ────────────────────────────────────────────────

  async getRefundSummary(paymentId: string): Promise<{ totalRefunded: number; remainingRefundable: number }> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    if (!payment) return { totalRefunded: 0, remainingRefundable: 0 };

    const refunds = await db.select().from(paymentRefunds).where(eq(paymentRefunds.paymentId, paymentId));
    // Use integer cent arithmetic to avoid floating-point drift
    const amountPaidCents = toCents(payment.amountPaid);
    const totalRefundedCents = refunds.reduce((s, r) => s + toCents(r.refundAmount), 0);
    const remainingCents = Math.max(0, amountPaidCents - totalRefundedCents);

    return {
      totalRefunded: totalRefundedCents / 100,
      remainingRefundable: remainingCents / 100,
    };
  }

  async createPaymentRefund(
    insertRefund: InsertPaymentRefund,
    refundedBy?: string,
  ): Promise<PaymentRefund> {
    const paymentId = insertRefund.paymentId;

    // Pre-flight: validate refund method before acquiring any lock
    const method = (insertRefund.refundMethod ?? 'cash') as string;
    if (!(ALLOWED_REFUND_METHODS as readonly string[]).includes(method)) {
      logRefundEvent('REFUND_FAILED_INVALID_METHOD', { paymentId, adminId: refundedBy, amount: parseFloat(String(insertRefund.refundAmount)) });
      throw new Error(`Invalid refund method '${method}'. Allowed: ${ALLOWED_REFUND_METHODS.join(', ')}`);
    }
    if (!insertRefund.reason || insertRefund.reason.trim() === '') {
      logRefundEvent('REFUND_FAILED_VALIDATION', { paymentId, adminId: refundedBy });
      throw new Error('Refund reason is required');
    }
    const refundAmtCents = toCents(insertRefund.refundAmount);
    if (refundAmtCents <= 0) {
      logRefundEvent('REFUND_FAILED_VALIDATION', { paymentId, adminId: refundedBy, amount: refundAmtCents });
      throw new Error('Refund amount must be greater than zero');
    }

    // ── All critical work runs inside a DB transaction with row-level lock ──────
    let createdRefundId: string;
    try {
      await db.transaction(async (tx) => {
        // ── 1. Lock the payment row to prevent concurrent over-refund ─────────────
        // SELECT ... FOR UPDATE acquires an exclusive row lock that is held
        // until the transaction commits or rolls back. Any concurrent transaction
        // attempting to lock the same row will block here until we finish.
        const [lockedPayment] = await tx.execute(
          sql`SELECT * FROM payments WHERE id = ${paymentId} FOR UPDATE`
        ) as any;
        const payment = (lockedPayment as any[])[0] as any;

        if (!payment) {
          throw new Error('Payment not found');
        }

        // ── 2. Validate payment status ───────────────────────────────────────────
        if (payment.payment_status === 'cancelled') {
          logRefundEvent('REFUND_FAILED_CANCELLED', { paymentId, adminId: refundedBy, playerId: payment.player_id });
          throw new Error('Cannot refund a cancelled payment');
        }
        if (payment.payment_status === 'refunded') {
          logRefundEvent('REFUND_FAILED_FULLY_REFUNDED', { paymentId, adminId: refundedBy, playerId: payment.player_id });
          throw new Error('Payment has already been fully refunded');
        }

        // ── 3. Calculate remaining refundable using integer cents ────────────────
        // Read all existing refunds inside the same transaction to prevent
        // concurrent reads from seeing a stale (pre-refund) total.
        const existingRefunds = await tx
          .select({ refundAmount: paymentRefunds.refundAmount })
          .from(paymentRefunds)
          .where(eq(paymentRefunds.paymentId, paymentId));

        const amountPaidCents = toCents(payment.amount_paid);
        const totalAlreadyRefundedCents = existingRefunds.reduce(
          (s, r) => s + toCents(r.refundAmount),
          0
        );
        const remainingCents = amountPaidCents - totalAlreadyRefundedCents;

        // ── 4. Strict over-refund guard (no float tolerance) ─────────────────
        if (refundAmtCents > remainingCents) {
          logRefundEvent('REFUND_FAILED_OVER_LIMIT', {
            adminId: refundedBy,
            paymentId,
            playerId: payment.player_id,
            amount: refundAmtCents / 100,
            error: `Remaining refundable: AED ${fromCents(remainingCents)}`,
          });
          throw new Error(
            `Refund AED ${fromCents(refundAmtCents)} exceeds remaining refundable AED ${fromCents(remainingCents)}`
          );
        }

        // ── 5. Insert refund record ────────────────────────────────────────────────
        createdRefundId = nanoid();
        await tx.insert(paymentRefunds).values({
          id: createdRefundId,
          paymentId,
          playerId: payment.player_id,          // always from payment row, never from request
          refundAmount: fromCents(refundAmtCents), // stored as DECIMAL-safe string
          refundMethod: method,
          reason: insertRefund.reason!.trim(),
          refundedBy: refundedBy ?? null,
        } as any);

        // ── 6. Recalculate and update payment status ────────────────────────────
        const newTotalCents = totalAlreadyRefundedCents + refundAmtCents;
        let newStatus: string;
        if (newTotalCents >= amountPaidCents) {
          newStatus = 'refunded';
        } else if (newTotalCents > 0) {
          newStatus = 'partially_refunded';
        } else {
          newStatus = 'completed';
        }

        await tx
          .update(payments)
          .set({ paymentStatus: newStatus } as any)
          .where(eq(payments.id, paymentId));

        // Audit success inside transaction scope (will still log even if outer try catches)
        logRefundEvent('REFUND_SUCCESS', {
          adminId: refundedBy,
          paymentId,
          playerId: payment.player_id,
          amount: refundAmtCents / 100,
        });
      }); // ── transaction auto-commits here, or auto-rolls back on throw ────────
    } catch (err) {
      // If it wasn't already logged (e.g. unexpected DB error), log it now
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('Cannot refund') && !msg.includes('Refund') && !msg.includes('Payment not found')) {
        logRefundEvent('REFUND_TRANSACTION_ERROR', { paymentId, adminId: refundedBy, error: msg });
      }
      throw err; // re-throw so the route handler returns the correct HTTP error
    }

    const [refund] = await db.select().from(paymentRefunds).where(eq(paymentRefunds.id, createdRefundId!));
    return refund;
  }

  async getPaymentRefunds(paymentId: string): Promise<PaymentRefund[]> {
    return await db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, paymentId))
      .orderBy(desc(paymentRefunds.createdAt));
  }

  async getPlayerRefunds(playerId: string): Promise<PaymentRefund[]> {
    return await db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.playerId, playerId))
      .orderBy(desc(paymentRefunds.createdAt));
  }

  async getPlayerSessions(playerId: string): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.playerId, playerId)).orderBy(desc(sessions.sessionDate));
  }

  async getAllSessions(): Promise<Session[]> {
    return await db
      .select({
        id: sessions.id,
        playerId: sessions.playerId,
        sessionDate: sessions.sessionDate,
        scheduledStartTime: sessions.scheduledStartTime,
        scheduledEndTime: sessions.scheduledEndTime,
        actualStartTime: sessions.actualStartTime,
        actualEndTime: sessions.actualEndTime,
        attendanceStatus: sessions.attendanceStatus,
        sessionStatus: sessions.sessionStatus,
        instructorName: sessions.instructorName,
        notes: sessions.notes,
        createdAt: sessions.createdAt,
        playerName: players.fullName,
        activity: players.activity,
      })
      .from(sessions)
      .leftJoin(players, eq(sessions.playerId, players.id))
      .orderBy(desc(sessions.sessionDate));
  }

  async createSession(session: InsertSession): Promise<Session> {
    const id = nanoid();
    await db.insert(sessions).values({ ...session, id } as any);
    const [sess] = await db.select().from(sessions).where(eq(sessions.id, id));
    
    // Update player's sessions attended count if attendance is marked as present OR late
    const attendanceStatus = (session as any).attendanceStatus;
    if (sess && (attendanceStatus === 'present' || attendanceStatus === 'late')) {
      await db
        .update(players)
        .set({ 
          sessionsAttended: sql`${players.sessionsAttended} + 1`,
          updatedAt: new Date()
        })
        .where(eq(players.id, sess.playerId));
    }
    
    return sess;
  }

  async updateSession(id: string, sessionUpdate: Partial<InsertSession>): Promise<Session | undefined> {
    const [existingSession] = await db.select().from(sessions).where(eq(sessions.id, id));
    
    await db
      .update(sessions)
      .set(sessionUpdate)
      .where(eq(sessions.id, id));
      
    const [selectedSession] = await db.select().from(sessions).where(eq(sessions.id, id));

    if (existingSession && selectedSession) {
      const oldStatus = existingSession.attendanceStatus;
      const newStatus = selectedSession.attendanceStatus;
      // Both 'present' and 'late' count as attended
      const wasAttended = oldStatus === 'present' || oldStatus === 'late';
      const isAttended = newStatus === 'present' || newStatus === 'late';

      if (!wasAttended && isAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql`${players.sessionsAttended} + 1`, updatedAt: new Date() })
          .where(eq(players.id, existingSession.playerId));
      } else if (wasAttended && !isAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql`GREATEST(0, ${players.sessionsAttended} - 1)`, updatedAt: new Date() })
          .where(eq(players.id, existingSession.playerId));
      }
    }

    return selectedSession || undefined;
  }

  async markAttendance(sessionId: string, attendanceStatus: string, notes?: string): Promise<Session | undefined> {
    const [existingSession] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    // 'present' and 'late' both mark the session as attended
    const isAttendedStatus = attendanceStatus === 'present' || attendanceStatus === 'late';

    await db
      .update(sessions)
      .set({ 
        attendanceStatus: attendanceStatus as any,
        sessionStatus: isAttendedStatus ? 'attended' : 'missed' as any,
        notes: notes,
      })
      .where(eq(sessions.id, sessionId));
      
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));

    if (existingSession && session) {
      const oldStatus = existingSession.attendanceStatus;
      const newStatus = session.attendanceStatus;
      // Both 'present' and 'late' count as attended
      const wasAttended = oldStatus === 'present' || oldStatus === 'late';
      const nowAttended = newStatus === 'present' || newStatus === 'late';

      if (!wasAttended && nowAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql`${players.sessionsAttended} + 1`, updatedAt: new Date() })
          .where(eq(players.id, session.playerId));
      } else if (wasAttended && !nowAttended) {
        await db.update(players)
          .set({ sessionsAttended: sql`GREATEST(0, ${players.sessionsAttended} - 1)`, updatedAt: new Date() })
          .where(eq(players.id, session.playerId));
      }
    }

    return session || undefined;
  }

  // Auto-update subscription statuses based on end dates
  private async updateExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Mark as expired: subscriptionEndDate has passed and still active
    await db
      .update(players)
      .set({ subscriptionStatus: 'expired' as any, updatedAt: new Date() })
      .where(
        and(
          sql`${players.subscriptionEndDate} < ${now}`,
          sql`${players.subscriptionEndDate} IS NOT NULL`,
          sql`${players.subscriptionStatus} IN ('active', 'renewal_due')`
        )
      );

    // Mark as renewal_due: subscriptionEndDate is within 3 days and still active
    await db
      .update(players)
      .set({ subscriptionStatus: 'renewal_due' as any, updatedAt: new Date() })
      .where(
        and(
          sql`${players.subscriptionEndDate} >= ${now}`,
          sql`${players.subscriptionEndDate} <= ${threeDaysFromNow}`,
          sql`${players.subscriptionEndDate} IS NOT NULL`,
          eq(players.subscriptionStatus, 'active')
        )
      );
  }

  async getDashboardStats() {
    // Auto-update subscription statuses before computing stats
    await this.updateExpiredSubscriptions();

    // ── Date Boundaries ──────────────────────────────────────────────────────
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 1);   // exclusive upper bound
    const yearStart = new Date(currentYear, 0, 1);

    // ── Player Counts ────────────────────────────────────────────────────────
    const totalPlayersResult = await db.select({ count: count() }).from(players);
    const totalPlayers = totalPlayersResult[0].count;

    const activeSubscriptionsResult = await db
      .select({ count: count() })
      .from(players)
      .where(eq(players.subscriptionStatus, 'active'));
    const activeSubscriptions = activeSubscriptionsResult[0].count;

    // ── Pending Player Payments (outstanding debt) ────────────────────────────
    const pendingPaymentsResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${payments.remainingBalance}) AS CHAR), '0')` })
      .from(payments)
      .where(sql`${payments.remainingBalance} > 0`);
    const pendingPayments = pendingPaymentsResult[0].total || '0';

    // ── Player Activity Breakdown ─────────────────────────────────────────────
    const playersByActivityResult = await db
      .select({ activity: players.activity, count: count() })
      .from(players)
      .groupBy(players.activity);

    // ── CASH FLOW: INCOME ─────────────────────────────────────────────────────
    // Income = real cash entering the academy.
    // Sources: (1) player subscription payments  (2) advance repayments by trainers
    // Excluded: CarryForward, NetPayable, PendingAdvances — these are ledger states, not cash.

    // (1) Monthly player payments (gross)
    const monthlyPlayerRevenueResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${payments.amountPaid}) AS CHAR), '0')` })
      .from(payments)
      .where(and(gte(payments.paymentDate, monthStart), lte(payments.paymentDate, monthEnd)));
    const monthlyPlayerRevenue = monthlyPlayerRevenueResult[0].total || '0';

    // (2) Monthly advance repayments (advances the trainer paid BACK in cash this month)
    //     Status = 'repaid', deductedAt is used as the repayment timestamp
    const monthlyAdvanceRepaymentsResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerAdvances.amount}) AS CHAR), '0')` })
      .from(trainerAdvances)
      .where(and(
        eq(trainerAdvances.status, 'repaid'),
        gte(trainerAdvances.deductedAt, monthStart),
        lte(trainerAdvances.deductedAt, monthEnd)
      ));
    const monthlyAdvanceRepayments = monthlyAdvanceRepaymentsResult[0].total || '0';

    // (3) Monthly refunds issued — these reduce net income (cash left the academy)
    const monthlyRefundsResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${paymentRefunds.refundAmount}) AS CHAR), '0')` })
      .from(paymentRefunds)
      .where(and(gte(paymentRefunds.refundDate, monthStart), lte(paymentRefunds.refundDate, monthEnd)));
    const monthlyRefunds = monthlyRefundsResult[0].total || '0';

    const monthlyIncomeNum =
      parseFloat(monthlyPlayerRevenue) +
      parseFloat(monthlyAdvanceRepayments) -
      parseFloat(monthlyRefunds);  // refunds reduce net income
    const monthlyIncome = monthlyIncomeNum.toFixed(2);

    // ── CASH FLOW: EXPENSES ───────────────────────────────────────────────────
    // Expenses = real cash leaving the academy.
    // Sources: (1) trainer cash salary payments  (2) advances created this month
    // Excluded: deducted advances (status-only change, no new cash), CarryForward, NetPayable.

    // (1) Monthly trainer cash payments (amount = cash only, per our payroll logic)
    const monthlyTrainerCashResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerSalaryPayments.amount}) AS CHAR), '0')` })
      .from(trainerSalaryPayments)
      .where(eq(trainerSalaryPayments.month, currentMonthStr));
    const monthlyTrainerCashPayments = monthlyTrainerCashResult[0].total || '0';

    // (2) Advances CREATED this month — cash left the academy when the advance was issued
    //     Counted regardless of current status (pending/deducted/repaid already accounted for)
    const monthlyAdvancesCreatedResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerAdvances.amount}) AS CHAR), '0')` })
      .from(trainerAdvances)
      .where(and(
        gte(trainerAdvances.createdAt, monthStart),
        lte(trainerAdvances.createdAt, monthEnd)
      ));
    const monthlyAdvancesCreated = monthlyAdvancesCreatedResult[0].total || '0';

    const monthlyExpensesNum = parseFloat(monthlyTrainerCashPayments) + parseFloat(monthlyAdvancesCreated);
    const monthlyExpenses = monthlyExpensesNum.toFixed(2);

    // Monthly Profit
    const monthlyProfit = (monthlyIncomeNum - monthlyExpensesNum).toFixed(2);

    // ── ANNUAL CASH FLOW ──────────────────────────────────────────────────────
    // Annual Income: player payments YTD + advance repayments YTD - refunds YTD
    const annualPlayerRevenueResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${payments.amountPaid}) AS CHAR), '0')` })
      .from(payments)
      .where(gte(payments.paymentDate, yearStart));
    const annualPlayerRevenue = parseFloat(annualPlayerRevenueResult[0].total || '0');

    const annualAdvanceRepaymentsResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerAdvances.amount}) AS CHAR), '0')` })
      .from(trainerAdvances)
      .where(and(
        eq(trainerAdvances.status, 'repaid'),
        gte(trainerAdvances.deductedAt, yearStart)
      ));
    const annualAdvanceRepayments = parseFloat(annualAdvanceRepaymentsResult[0].total || '0');

    // Annual refunds YTD
    const annualRefundsResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${paymentRefunds.refundAmount}) AS CHAR), '0')` })
      .from(paymentRefunds)
      .where(gte(paymentRefunds.refundDate, yearStart));
    const annualRefunds = parseFloat(annualRefundsResult[0].total || '0');

    const annualIncomeNum = annualPlayerRevenue + annualAdvanceRepayments - annualRefunds;

    // Annual Expenses: trainer cash payments YTD + advances created YTD
    const annualTrainerCashResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerSalaryPayments.amount}) AS CHAR), '0')` })
      .from(trainerSalaryPayments)
      .where(sql`${trainerSalaryPayments.month} LIKE ${currentYear + '-%'}`);
    const annualTrainerCash = parseFloat(annualTrainerCashResult[0].total || '0');

    const annualAdvancesCreatedResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerAdvances.amount}) AS CHAR), '0')` })
      .from(trainerAdvances)
      .where(gte(trainerAdvances.createdAt, yearStart));
    const annualAdvancesCreated = parseFloat(annualAdvancesCreatedResult[0].total || '0');
    const annualExpensesNum = annualTrainerCash + annualAdvancesCreated;

    // ── LEDGER STATES (not cash flow) ─────────────────────────────────────────
    // Outstanding (pending) advances — a liability, not an expense
    const advancesOutstandingResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerAdvances.amount}) AS CHAR), '0')` })
      .from(trainerAdvances)
      .where(eq(trainerAdvances.status, 'pending'));
    const totalAdvancesOutstanding = advancesOutstandingResult[0].total || '0';

    // Total Bonuses for current month (for display reference)
    const bonusesResult = await db
      .select({ total: sql<string>`COALESCE(CAST(SUM(${trainerBonuses.amount}) AS CHAR), '0')` })
      .from(trainerBonuses)
      .where(eq(trainerBonuses.month, currentMonthStr));
    const totalBonuses = bonusesResult[0].total || '0';

    // Outstanding Salaries = sum of positive NetPayable across all trainers this month
    const trainersList = await this.getTrainers();
    let outstandingSalariesNum = 0;
    for (const t of trainersList) {
      const ledger = await this.getTrainerLedger(t.id, currentMonthStr);
      const netPay = parseFloat(ledger.netPayable);
      if (netPay > 0) outstandingSalariesNum += netPay;
    }
    const outstandingSalaries = outstandingSalariesNum.toFixed(2);

    return {
      totalPlayers,
      activeSubscriptions,
      pendingPayments,
      playersByActivity: playersByActivityResult,
      outstandingSalaries,
      totalAdvancesOutstanding,
      // Cash-flow monthly
      monthlyIncome,
      monthlyExpenses,
      monthlyProfit,
      // Monthly breakdown (for tooltip / drill-down)
      monthlyPlayerRevenue,
      monthlyAdvanceRepayments,
      monthlyTrainerCashPayments,
      monthlyAdvancesCreated,
      monthlyRefunds,
      // Cash-flow annual
      annualIncome: annualIncomeNum.toFixed(2),
      annualExpenses: annualExpensesNum.toFixed(2),
      annualNetProfit: (annualIncomeNum - annualExpensesNum).toFixed(2),
      annualRefunds: annualRefunds.toFixed(2),
      // Legacy fields — kept for backward compatibility
      monthlyRevenue: monthlyPlayerRevenue,
      totalSalaryExpenses: monthlyTrainerCashPayments,
      totalBonuses,
    };
  }

  async getUpcomingRenewals(): Promise<Array<Player & { sessionsLeft: number }>> {
    // Auto-update statuses first
    await this.updateExpiredSubscriptions();

    const upcomingRenewals = await db
      .select()
      .from(players)
      .where(
        and(
          lte(players.renewalDate, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // Within 7 days
          sql`${players.subscriptionStatus} IN ('active', 'renewal_due')`
        )
      )
      .orderBy(asc(players.renewalDate));

    return upcomingRenewals.map((player: any) => ({
      ...player,
      sessionsLeft: Math.max(0, player.totalSessionsAllowed - player.sessionsAttended)
    }));
  }

  async getRecentActivities() {
    // Get recent player registrations
    const recentPlayers = await db
      .select({
        id: players.id,
        fullName: players.fullName,
        activity: players.activity,
        createdAt: players.createdAt
      })
      .from(players)
      .orderBy(desc(players.createdAt))
      .limit(5);

    // Get recent payments
    const recentPayments = await db
      .select({
        id: payments.id,
        playerId: payments.playerId,
        amountPaid: payments.amountPaid,
        createdAt: payments.createdAt
      })
      .from(payments)
      .innerJoin(players, eq(payments.playerId, players.id))
      .orderBy(desc(payments.createdAt))
      .limit(5);

    const activities = [
      ...recentPlayers.map((player: any) => ({
        type: 'registration',
        description: `New player registration: ${player.fullName}`,
        timestamp: player.createdAt,
        playerId: player.id,
        playerName: player.fullName
      })),
      ...recentPayments.map((payment: any) => ({
        type: 'payment',
        description: `Payment received: $${payment.amountPaid}`,
        timestamp: payment.createdAt,
        playerId: payment.playerId,
        playerName: ''
      }))
    ];

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }

  async getRenewalNotifications() {
    // Auto-update statuses first
    await this.updateExpiredSubscriptions();

    // Get all active + renewal_due + expired players that need attention
    const allActivePlayers = await db
      .select()
      .from(players)
      .where(sql`${players.subscriptionStatus} IN ('active', 'renewal_due', 'expired')`)
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
    }

    // Sort by urgency: renewal_due first, then by days/sessions
    notifications.sort((a, b) => {
      if (a.reason === 'renewal_due' && b.reason !== 'renewal_due') return -1;
      if (b.reason === 'renewal_due' && a.reason !== 'renewal_due') return 1;
      
      if (a.reason === 'renewal_due') {
        return a.daysUntilRenewal - b.daysUntilRenewal;
      } else {
        return a.sessionsLeft - b.sessionsLeft;
      }
    });

    return notifications;
  }

  // Payment History methods
  async getPlayerPaymentHistory(playerId: string): Promise<PaymentHistory[]> {
    return await db
      .select()
      .from(paymentHistory)
      .where(eq(paymentHistory.playerId, playerId))
      .orderBy(desc(paymentHistory.archivedAt));
  }

  async archivePlayerPayments(playerId: string, subscriptionPeriodStart: Date, subscriptionPeriodEnd: Date): Promise<void> {
    // Get all current payments for the player
    const currentPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.playerId, playerId));

    // Archive each payment
    for (const payment of currentPayments) {
      const id = nanoid();
      await db.insert(paymentHistory).values({
        id,
        playerId: payment.playerId,
        subscriptionFee: payment.subscriptionFee,
        amountPaid: payment.amountPaid,
        remainingBalance: payment.remainingBalance,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        paymentDate: payment.paymentDate,
        description: payment.description,
        receiptNumber: payment.receiptNumber,
        subscriptionPeriodStart,
        subscriptionPeriodEnd,
        createdAt: payment.createdAt,
      });
    }
  }

  async clearPlayerCurrentPayments(playerId: string): Promise<void> {
    await db
      .delete(payments)
      .where(eq(payments.playerId, playerId));
  }

  // ─── Trainer methods ──────────────────────────────────────────────────────

  async getTrainers(): Promise<Trainer[]> {
    return await db.select().from(trainers).orderBy(desc(trainers.createdAt));
  }

  async getTrainer(id: string): Promise<Trainer | undefined> {
    const [trainer] = await db.select().from(trainers).where(eq(trainers.id, id));
    return trainer || undefined;
  }

  async createTrainer(insertTrainer: InsertTrainer): Promise<Trainer> {
    const id = nanoid();
    await db.insert(trainers).values({ ...insertTrainer, id } as any);
    const [trainer] = await db.select().from(trainers).where(eq(trainers.id, id));
    return trainer;
  }

  async updateTrainer(id: string, trainerUpdate: Partial<InsertTrainer>): Promise<Trainer | undefined> {
    await db.update(trainers).set(trainerUpdate as any).where(eq(trainers.id, id));
    const [trainer] = await db.select().from(trainers).where(eq(trainers.id, id));
    return trainer || undefined;
  }

  async deleteTrainer(id: string): Promise<boolean> {
    const result = await db.delete(trainers).where(eq(trainers.id, id));
    return (result[0]?.affectedRows ?? 0) > 0;
  }

  async getTrainerSalaryPayments(trainerId?: string, month?: string): Promise<TrainerSalaryPayment[]> {
    let query = db.select().from(trainerSalaryPayments).$dynamic();
    const conditions: any[] = [];
    if (trainerId) conditions.push(eq(trainerSalaryPayments.trainerId, trainerId));
    if (month) conditions.push(eq(trainerSalaryPayments.month, month));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return await query.orderBy(desc(trainerSalaryPayments.createdAt));
  }

  async createTrainerSalaryPayment(
    insertPayment: InsertTrainerSalaryPayment,
    advanceIdsToDeduct: string[] = []
  ): Promise<TrainerSalaryPayment> {
    // Block if month is locked
    const payroll = await this.getTrainerPayroll(insertPayment.trainerId, insertPayment.month);
    if (payroll?.isLocked) {
      throw new Error(`Month ${insertPayment.month} is locked for this trainer.`);
    }

    // Validate: cash amount must not exceed current net payable
    // netPayable = BaseSalary + CarryForward + Bonuses - PendingAdvances - CashPayments
    const ledgerBefore = await this.getTrainerLedger(insertPayment.trainerId, insertPayment.month);
    const cashAmount = parseFloat(insertPayment.amount);

    if (cashAmount > parseFloat(ledgerBefore.netPayable) + 0.01) {
      throw new Error("Payment exceeds net payable");
    }

    // Insert the salary payment — amount = CASH ONLY (never includes advance amounts)
    const id = nanoid();
    await db.insert(trainerSalaryPayments).values({ ...insertPayment, id } as any);

    // FIFO advance deduction: process explicitly requested advance IDs first,
    // then auto-apply remaining oldest pending advances up to the cash amount.
    // Deducted advances only change their status; they are NOT added to the cash amount.
    const allPendingAdvances = await db
      .select()
      .from(trainerAdvances)
      .where(and(eq(trainerAdvances.trainerId, insertPayment.trainerId), eq(trainerAdvances.status, 'pending')))
      .orderBy(asc(trainerAdvances.createdAt));

    // Determine which advances to deduct (explicit list from caller takes priority, then FIFO auto)
    const toDeduct = advanceIdsToDeduct.length > 0
      ? allPendingAdvances.filter(a => advanceIdsToDeduct.includes(a.id))
      : allPendingAdvances; // auto-FIFO: deduct oldest first

    for (const advance of toDeduct) {
      await db
        .update(trainerAdvances)
        .set({
          status: 'deducted' as any,
          deductedAt: new Date(),
          salaryPaymentId: id,
        })
        .where(and(eq(trainerAdvances.id, advance.id), eq(trainerAdvances.status, 'pending')));
    }

    const [payment] = await db.select().from(trainerSalaryPayments).where(eq(trainerSalaryPayments.id, id));
    return payment;
  }

  async getTrainerAdvances(trainerId?: string, status?: string): Promise<TrainerAdvance[]> {
    let query = db.select().from(trainerAdvances).$dynamic();
    const conditions: any[] = [];
    if (trainerId) conditions.push(eq(trainerAdvances.trainerId, trainerId));
    if (status) conditions.push(eq(trainerAdvances.status, status as any));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return await query.orderBy(desc(trainerAdvances.createdAt));
  }

  async createTrainerAdvance(insertAdvance: InsertTrainerAdvance): Promise<TrainerAdvance> {
    // Block if the CURRENT calendar month is locked for this trainer
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const payroll = await this.getTrainerPayroll(insertAdvance.trainerId, currentMonth);
    if (payroll?.isLocked) {
      throw new Error(`Month ${currentMonth} is locked — new advances cannot be created.`);
    }
    const id = nanoid();
    await db.insert(trainerAdvances).values({ ...insertAdvance, id, status: 'pending' } as any);
    const [advance] = await db.select().from(trainerAdvances).where(eq(trainerAdvances.id, id));
    return advance;
  }

  async repayTrainerAdvance(advanceId: string, repaidNote?: string): Promise<TrainerAdvance | undefined> {
    // NOTE: repay is a cash repayment — completely separate from salary payments.
    // It immediately removes the advance from NetPayable (status → 'repaid').
    // Lock does NOT block repaying old advances (per spec: lock only blocks new advances/payments/bonuses).
    const [existing] = await db
      .select()
      .from(trainerAdvances)
      .where(and(eq(trainerAdvances.id, advanceId), eq(trainerAdvances.status, 'pending')));
      
    if (existing) {
      const repaidAt = new Date();
      const noteText = repaidNote
        ? `${repaidNote} (Repaid in Cash ${repaidAt.toLocaleDateString()})`
        : existing.notes
          ? `${existing.notes} | Repaid in Cash on ${repaidAt.toLocaleDateString()}`
          : `Repaid in Cash on ${repaidAt.toLocaleDateString()}`;

      await db
        .update(trainerAdvances)
        .set({
          status: 'repaid' as any,
          // Store repaid_at timestamp in deductedAt field (no schema change needed)
          deductedAt: repaidAt,
          notes: noteText,
        })
        .where(eq(trainerAdvances.id, advanceId));
        
      const [updated] = await db.select().from(trainerAdvances).where(eq(trainerAdvances.id, advanceId));
      return updated;
    }
    return undefined;
  }

  async getTrainerBonuses(trainerId?: string, month?: string): Promise<TrainerBonus[]> {
    let query = db.select().from(trainerBonuses).$dynamic();
    const conditions: any[] = [];
    if (trainerId) conditions.push(eq(trainerBonuses.trainerId, trainerId));
    if (month) conditions.push(eq(trainerBonuses.month, month));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return await query.orderBy(desc(trainerBonuses.createdAt));
  }

  async createTrainerBonus(insertBonus: InsertTrainerBonus): Promise<TrainerBonus> {
    const payroll = await this.getTrainerPayroll(insertBonus.trainerId, insertBonus.month);
    if (payroll?.isLocked) {
      throw new Error(`Month ${insertBonus.month} is locked for this trainer.`);
    }
    const id = nanoid();
    await db.insert(trainerBonuses).values({ ...insertBonus, id } as any);
    const [bonus] = await db.select().from(trainerBonuses).where(eq(trainerBonuses.id, id));
    return bonus;
  }

  async getTrainerPayroll(trainerId: string, month: string): Promise<TrainerPayroll | undefined> {
    const [payroll] = await db.select().from(trainerPayrolls)
      .where(and(eq(trainerPayrolls.trainerId, trainerId), eq(trainerPayrolls.month, month)));
    return payroll || undefined;
  }

  async lockTrainerPayroll(trainerId: string, month: string): Promise<TrainerPayroll> {
    const ledger = await this.getTrainerLedger(trainerId, month);
    const existing = await this.getTrainerPayroll(trainerId, month);
    
    if (existing) {
      await db.update(trainerPayrolls).set({ 
        isLocked: true,
        baseSalary: ledger.baseSalary,
        carryForward: ledger.carryForward,
        totalBonuses: ledger.totalBonuses,
        totalAdvances: ledger.totalPendingAdvances,
        totalPaid: ledger.totalPaid,
        netPayable: ledger.netPayable,
        status: ledger.status as any,
      }).where(eq(trainerPayrolls.id, existing.id));
      return (await this.getTrainerPayroll(trainerId, month))!;
    } else {
      const id = nanoid();
      await db.insert(trainerPayrolls).values({
        id,
        trainerId,
        month,
        baseSalary: ledger.baseSalary,
        carryForward: ledger.carryForward,
        totalBonuses: ledger.totalBonuses,
        totalAdvances: ledger.totalPendingAdvances,
        totalPaid: ledger.totalPaid,
        netPayable: ledger.netPayable,
        status: ledger.status as any,
        isLocked: true,
      });
      return (await this.getTrainerPayroll(trainerId, month))!;
    }
  }

  // (duplicate definitions removed — see implementations above)

  async getTrainerLedger(trainerId: string, month: string) {
    const trainer = await this.getTrainer(trainerId);
    if (!trainer) throw new Error('Trainer not found');

    const baseSalary = parseFloat(trainer.baseSalary);
    const targetMonth = month;

    // Fetch all historical data for this trainer
    const allBonuses = await db.select().from(trainerBonuses).where(eq(trainerBonuses.trainerId, trainerId));
    const allPayments = await db.select().from(trainerSalaryPayments).where(eq(trainerSalaryPayments.trainerId, trainerId));
    const allAdvances = await db
      .select()
      .from(trainerAdvances)
      .where(eq(trainerAdvances.trainerId, trainerId))
      .orderBy(asc(trainerAdvances.createdAt)); // oldest first for FIFO reference

    // ── Carry Forward Calculation ────────────────────────────────────────────
    // For each past month:
    //   earned   = baseSalary + bonuses
    //   settled  = cashPaid ONLY (actual cash handed to trainer)
    //   carry    += earned - settled
    //
    // IMPORTANT: Advances are intentionally excluded from CarryForward.
    // CarryForward represents only "unpaid earnings from previous months".
    // Advance debt is handled globally via PendingAdvances in the main formula:
    //   NetPayable = BaseSalary + CarryForward + Bonuses - PendingAdvances - CashPayments
    // Including advances here would cause double-deduction across months.
    const pastMonths: string[] = [];
    const startD = new Date(trainer.createdAt);
    let currYear = startD.getFullYear();
    let currMonth = startD.getMonth() + 1;

    const [targetY, targetM] = targetMonth.split('-').map(Number);

    while (currYear < targetY || (currYear === targetY && currMonth < targetM)) {
      pastMonths.push(`${currYear}-${String(currMonth).padStart(2, '0')}`);
      currMonth++;
      if (currMonth > 12) { currMonth = 1; currYear++; }
    }

    let carryForward = 0;
    for (const m of pastMonths) {
      const mBonuses = allBonuses
        .filter(b => b.month === m)
        .reduce((s, b) => s + parseFloat(b.amount), 0);

      // Cash paid in that month (cash only — advances never participate here)
      const mCashPaid = allPayments
        .filter(p => p.month === m)
        .reduce((s, p) => s + parseFloat(p.amount), 0);

      // CarryForward = unpaid earnings only. NO advances, no deductions, no repayments.
      carryForward += (baseSalary + mBonuses) - mCashPaid;
    }

    // ── Current Month ─────────────────────────────────────────────────────────
    const currentBonusesList = allBonuses.filter(b => b.month === targetMonth);
    const totalBonuses = currentBonusesList.reduce((s, b) => s + parseFloat(b.amount), 0);

    const currentPaymentsList = allPayments
      .filter(p => p.month === targetMonth)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // FIX: totalCashPaid = SUM(trainer_salary_payments.amount) for this month ONLY.
    // amount stored = cash handed to trainer (does NOT include deducted advances).
    const totalCashPaid = currentPaymentsList.reduce((s, p) => s + parseFloat(p.amount), 0);

    // FIX: pendingAdvances = only advances with status = 'pending' (global pool, all months).
    // 'deducted' and 'repaid' advances do NOT affect NetPayable.
    const pendingAdvancesList = allAdvances.filter(a => a.status === 'pending');
    const totalPendingAdvances = pendingAdvancesList.reduce((s, a) => s + parseFloat(a.amount), 0);

    // ── Net Payable Formula ──────────────────────────────────────────────────
    // NetPayable = BaseSalary + CarryForward + Bonuses - PendingAdvances - CashPayments
    // CashPayments = SUM(trainer_salary_payments.amount) for current month
    // PendingAdvances = only status='pending' advances (global)
    const netPayable = (baseSalary + carryForward + totalBonuses) - totalPendingAdvances - totalCashPaid;

    // totalPaid exposed to UI = cash paid this month + deducted advances this month (for display)
    const currentPaymentIds = currentPaymentsList.map(p => p.id);
    const totalAdvancesDeductedCurrent = allAdvances
      .filter(a => a.status === 'deducted' && a.salaryPaymentId && currentPaymentIds.includes(a.salaryPaymentId))
      .reduce((s, a) => s + parseFloat(a.amount), 0);
    const totalPaid = totalCashPaid + totalAdvancesDeductedCurrent;

    let status: "unpaid" | "partial" | "paid" | "over_advanced" = "unpaid";
    if (netPayable < -0.01) {
      status = "over_advanced";
    } else if (netPayable <= 0.01) {
      status = "paid";
    } else if (totalCashPaid > 0 || totalAdvancesDeductedCurrent > 0) {
      status = "partial";
    } else {
      status = "unpaid";
    }

    const payrollRecord = await this.getTrainerPayroll(trainerId, month);
    const isLocked = payrollRecord?.isLocked ?? false;

    return {
      baseSalary: baseSalary.toFixed(2),
      carryForward: carryForward.toFixed(2),
      totalBonuses: totalBonuses.toFixed(2),
      totalPendingAdvances: totalPendingAdvances.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      netPayable: netPayable.toFixed(2),
      status,
      isLocked,
      advances: allAdvances,
      payments: currentPaymentsList,
      bonuses: currentBonusesList,
    };
  }
}

export const storage = new DatabaseStorage();
