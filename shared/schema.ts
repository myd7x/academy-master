import { sql, relations } from "drizzle-orm";
import { 
  mysqlTable, 
  text, 
  varchar, 
  timestamp, 
  datetime,
  int as integer, 
  decimal, 
  boolean,
  date,
  mysqlEnum
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Payment status as string literals (not MySQL ENUM) to allow ALTER-free migration
export const PAYMENT_STATUS_ALL = [
  'pending', 'completed', 'overdue', 'cancelled', 'refunded', 'partially_refunded'
] as const;
export type PaymentStatusValue = typeof PAYMENT_STATUS_ALL[number];

// Enum Values
export const ACTIVITY_VALUES = [
  'karate', 'kickboxing', 'football', 'swimming', 'zumba', 'aerobics', 'crossfit', 'gymnastics', 'quran_memorization', 'kindergarten'
] as const;

export const PAYMENT_METHOD_VALUES = [
  'cash', 'visa', 'bank_transfer'
] as const;

// Keep legacy constant for backward compat, but status column is now VARCHAR
export const PAYMENT_STATUS_VALUES = [
  'pending', 'completed', 'overdue', 'cancelled', 'refunded', 'partially_refunded'
] as const;

export const SUBSCRIPTION_STATUS_VALUES = [
  'active', 'paused', 'expired', 'renewal_due', 'cancelled'
] as const;

export const SESSION_STATUS_VALUES = [
  'scheduled', 'attended', 'missed', 'cancelled'
] as const;

export const ATTENDANCE_STATUS_VALUES = [
  'present', 'absent', 'late', 'excused'
] as const;

export const EXPENSE_CATEGORY_VALUES = [
  'rent', 'utilities', 'maintenance', 'equipment', 'salary', 'marketing', 'transportation', 'other'
] as const;

export const INVENTORY_STATUS_VALUES = [
  'active', 'low_stock', 'out_of_stock', 'inactive', 'discontinued'
] as const;

export const INVENTORY_CONDITION_VALUES = [
  'new', 'good', 'damaged', 'expired'
] as const;

export const EXPENSE_STATUS_VALUES = [
  'pending', 'approved', 'rejected', 'paid'
] as const;

export const ACTIVITY_LOG_ACTION_VALUES = [
  'created', 'updated', 'deleted', 'stock_in', 'stock_out', 'adjustment', 'status_change'
] as const;

export const INVENTORY_TRANSACTION_TYPE_VALUES = [
  'in', 'out', 'adjustment'
] as const;

// Users table for admin authentication
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(), // Hashed password
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Players table
export const players = mysqlTable("players", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  fullName: text("full_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  activity: mysqlEnum("activity", ACTIVITY_VALUES).notNull(),
  subscriptionDate: timestamp("subscription_date").notNull().defaultNow(),
  subscriptionEndDate: datetime("subscription_end_date", { mode: 'date' }),
  renewalDate: datetime("renewal_date", { mode: 'date' }).notNull(),
  subscriptionStatus: mysqlEnum("subscription_status", SUBSCRIPTION_STATUS_VALUES).notNull().default('active'),
  pausedDate: datetime("paused_date", { mode: 'date' }),
  pauseReason: text("pause_reason"),
  totalSessionsAllowed: integer("total_sessions_allowed").notNull().default(8),
  sessionsAttended: integer("sessions_attended").notNull().default(0),
  monthlySubscriptionFee: decimal("monthly_subscription_fee", { precision: 10, scale: 2 }).notNull().default('100'),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }).default('0'),
  specialNotes: text("special_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Player documents table
export const playerDocuments = mysqlTable("player_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  playerId: varchar("player_id", { length: 36 }).notNull().references(() => players.id, { onDelete: 'cascade' }),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Payments table — paymentStatus is VARCHAR(30) so we can add new statuses without ALTER TABLE ENUM
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  playerId: varchar("player_id", { length: 36 }).notNull().references(() => players.id, { onDelete: 'cascade' }),
  subscriptionFee: decimal("subscription_fee", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }).notNull().default('0'),
  paymentMethod: mysqlEnum("payment_method", PAYMENT_METHOD_VALUES).notNull(),
  paymentStatus: varchar("payment_status", { length: 30 }).notNull().default('completed'),
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  description: text("description"),
  receiptNumber: text("receipt_number").notNull().default(''),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payment Refunds table — each row is an individual reversal record, never modifies original payment amounts
export const paymentRefunds = mysqlTable("payment_refunds", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  paymentId: varchar("payment_id", { length: 36 }).notNull().references(() => payments.id, { onDelete: 'cascade' }),
  playerId: varchar("player_id", { length: 36 }).notNull().references(() => players.id, { onDelete: 'cascade' }),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).notNull(),
  refundMethod: varchar("refund_method", { length: 30 }).notNull().default('cash'),
  reason: text("reason"),
  // refunded_by is always populated server-side from the authenticated session — never from request body
  refundedBy: varchar("refunded_by", { length: 36 }),
  refundDate: timestamp("refund_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Payment History/Archive table for old payment records
export const paymentHistory = mysqlTable("payment_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  playerId: varchar("player_id", { length: 36 }).notNull().references(() => players.id, { onDelete: 'cascade' }),
  subscriptionFee: decimal("subscription_fee", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }).notNull().default('0'),
  paymentMethod: mysqlEnum("payment_method", PAYMENT_METHOD_VALUES).notNull(),
  paymentStatus: varchar("payment_status", { length: 30 }).notNull().default('completed'),
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  description: text("description"),
  receiptNumber: text("receipt_number").notNull().default(''),
  subscriptionPeriodStart: datetime("subscription_period_start", { mode: 'date' }).notNull(),
  subscriptionPeriodEnd: datetime("subscription_period_end", { mode: 'date' }).notNull(),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sessions table
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  playerId: varchar("player_id", { length: 36 }).notNull().references(() => players.id, { onDelete: 'cascade' }),
  sessionDate: datetime("session_date", { mode: 'date' }).notNull(),
  scheduledStartTime: datetime("scheduled_start_time", { mode: 'date' }).notNull(),
  scheduledEndTime: datetime("scheduled_end_time", { mode: 'date' }).notNull(),
  actualStartTime: datetime("actual_start_time", { mode: 'date' }),
  actualEndTime: datetime("actual_end_time", { mode: 'date' }),
  attendanceStatus: mysqlEnum("attendance_status", ATTENDANCE_STATUS_VALUES).notNull().default('present'),
  sessionStatus: mysqlEnum("session_status", SESSION_STATUS_VALUES).notNull().default('scheduled'),
  instructorName: text("instructor_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const playersRelations = relations(players, ({ many }) => ({
  documents: many(playerDocuments),
  payments: many(payments),
  paymentHistory: many(paymentHistory),
  paymentRefunds: many(paymentRefunds),
  sessions: many(sessions),
}));

export const playerDocumentsRelations = relations(playerDocuments, ({ one }) => ({
  player: one(players, {
    fields: [playerDocuments.playerId],
    references: [players.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  player: one(players, {
    fields: [payments.playerId],
    references: [players.id],
  }),
  refunds: many(paymentRefunds),
}));

export const paymentRefundsRelations = relations(paymentRefunds, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentRefunds.paymentId],
    references: [payments.id],
  }),
  player: one(players, {
    fields: [paymentRefunds.playerId],
    references: [players.id],
  }),
}));

export const paymentHistoryRelations = relations(paymentHistory, ({ one }) => ({
  player: one(players, {
    fields: [paymentHistory.playerId],
    references: [players.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  player: one(players, {
    fields: [sessions.playerId],
    references: [players.id],
  }),
}));

// ─── Trainer tables ──────────────────────────────────────────────────────────

export const TRAINER_ADVANCE_STATUS_VALUES = ['pending', 'deducted', 'repaid'] as const;

export const trainers = mysqlTable("trainers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  activity: mysqlEnum("activity", ACTIVITY_VALUES).notNull(),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainerSalaryPayments = mysqlTable("trainer_salary_payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainerAdvances = mysqlTable("trainer_advances", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", TRAINER_ADVANCE_STATUS_VALUES).notNull().default('pending'),
  deductedAt: timestamp("deducted_at"),
  salaryPaymentId: varchar("salary_payment_id", { length: 36 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainerBonuses = mysqlTable("trainer_bonuses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const TRAINER_PAYROLL_STATUS_VALUES = ['unpaid', 'partial', 'paid', 'over_advanced'] as const;

export const trainerPayrolls = mysqlTable("trainer_payrolls", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  trainerId: varchar("trainer_id", { length: 36 }).notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull().default('0'),
  carryForward: decimal("carry_forward", { precision: 10, scale: 2 }).notNull().default('0'),
  totalBonuses: decimal("total_bonuses", { precision: 10, scale: 2 }).notNull().default('0'),
  totalAdvances: decimal("total_advances", { precision: 10, scale: 2 }).notNull().default('0'),
  totalPaid: decimal("total_paid", { precision: 10, scale: 2 }).notNull().default('0'),
  netPayable: decimal("net_payable", { precision: 10, scale: 2 }).notNull().default('0'),
  status: mysqlEnum("status", TRAINER_PAYROLL_STATUS_VALUES).notNull().default('unpaid'),
  isLocked: boolean("is_locked").notNull().default(false),
});

// ─── Expenses ─────────────────────────────────────────────────────────────

export const expenses = mysqlTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  category: mysqlEnum("category", EXPENSE_CATEGORY_VALUES).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull().defaultNow(),
  description: text("description"),
  paymentMethod: mysqlEnum("payment_method", PAYMENT_METHOD_VALUES).notNull().default('cash'),
  receiptUrl: text("receipt_url"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Soft delete
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  deletedReason: text("deleted_reason"),
});

// ─── Inventory ────────────────────────────────────────────────────────────

export const inventoryItems = mysqlTable("inventory_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  name: text("name").notNull(),
  sku: varchar("sku", { length: 100 }).unique(),
  category: text("category").notNull(), // tools, apparel, consumables, equipment
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").notNull().default(0),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  location: text("location"),
  status: mysqlEnum("status", INVENTORY_STATUS_VALUES).notNull().default('active'),
  condition: varchar("item_condition", { length: 20 }).notNull().default('new'),
  imageUrl: text("image_url"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Soft delete
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  deletedReason: text("deleted_reason"),
});

export const inventoryTransactions = mysqlTable("inventory_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  itemId: varchar("item_id", { length: 36 }).notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  type: mysqlEnum("type", INVENTORY_TRANSACTION_TYPE_VALUES).notNull(),
  quantity: integer("quantity").notNull(),
  balanceAfter: integer("balance_after").notNull().default(0),
  unitCostAtTransaction: decimal("unit_cost_at_transaction", { precision: 10, scale: 2 }),
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Soft delete
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by", { length: 36 }),
  deletedReason: text("deleted_reason"),
});

// ─── Activity Logs ────────────────────────────────────────────────────────

export const activityLogs = mysqlTable("activity_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  action: varchar("action", { length: 30 }).notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string
  performedBy: varchar("performed_by", { length: 36 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────

export const inventoryItemsRelations = relations(inventoryItems, ({ many }) => ({
  transactions: many(inventoryTransactions),
}));

export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [inventoryTransactions.itemId],
    references: [inventoryItems.id],
  }),
}));

// Trainer relations
export const trainersRelations = relations(trainers, ({ many }) => ({
  salaryPayments: many(trainerSalaryPayments),
  advances: many(trainerAdvances),
  bonuses: many(trainerBonuses),
  payrolls: many(trainerPayrolls),
}));

export const trainerSalaryPaymentsRelations = relations(trainerSalaryPayments, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerSalaryPayments.trainerId],
    references: [trainers.id],
  }),
}));

export const trainerAdvancesRelations = relations(trainerAdvances, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerAdvances.trainerId],
    references: [trainers.id],
  }),
}));

export const trainerBonusesRelations = relations(trainerBonuses, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerBonuses.trainerId],
    references: [trainers.id],
  }),
}));

export const trainerPayrollsRelations = relations(trainerPayrolls, ({ one }) => ({
  trainer: one(trainers, {
    fields: [trainerPayrolls.trainerId],
    references: [trainers.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Player = typeof players.$inferSelect;
export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sessionsAttended: true,
  subscriptionStatus: true,
});
export type InsertPlayer = Omit<typeof players.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'sessionsAttended' | 'subscriptionStatus'>;

export type PlayerDocument = typeof playerDocuments.$inferSelect;
export const insertPlayerDocumentSchema = createInsertSchema(playerDocuments);
export type InsertPlayerDocument = z.infer<typeof insertPlayerDocumentSchema>;

export type Payment = typeof payments.$inferSelect;
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  receiptNumber: true,
});
export type InsertPayment = Omit<typeof payments.$inferInsert, 'id' | 'createdAt' | 'receiptNumber'>;

export type PaymentRefund = typeof paymentRefunds.$inferSelect;
export const insertPaymentRefundSchema = createInsertSchema(paymentRefunds).omit({
  id: true,
  createdAt: true,
  refundDate: true,
});
export type InsertPaymentRefund = Omit<typeof paymentRefunds.$inferInsert, 'id' | 'createdAt' | 'refundDate'>;

export type PaymentHistory = typeof paymentHistory.$inferSelect;
export const insertPaymentHistorySchema = createInsertSchema(paymentHistory).omit({
  id: true,
  createdAt: true,
  archivedAt: true,
});
export type InsertPaymentHistory = Omit<typeof paymentHistory.$inferInsert, 'id' | 'createdAt' | 'archivedAt'>;

export type Session = typeof sessions.$inferSelect;
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});
export type InsertSession = Omit<typeof sessions.$inferInsert, 'id' | 'createdAt'>;

// Trainer types
export type Trainer = typeof trainers.$inferSelect;
export const insertTrainerSchema = createInsertSchema(trainers).omit({ id: true, createdAt: true });
export type InsertTrainer = Omit<typeof trainers.$inferInsert, 'id' | 'createdAt'>;

export type TrainerSalaryPayment = typeof trainerSalaryPayments.$inferSelect;
export const insertTrainerSalaryPaymentSchema = createInsertSchema(trainerSalaryPayments).omit({ id: true, createdAt: true });
export type InsertTrainerSalaryPayment = Omit<typeof trainerSalaryPayments.$inferInsert, 'id' | 'createdAt'>;

export type TrainerAdvance = typeof trainerAdvances.$inferSelect;
export const insertTrainerAdvanceSchema = createInsertSchema(trainerAdvances).omit({ id: true, createdAt: true, deductedAt: true, salaryPaymentId: true, status: true });
export type InsertTrainerAdvance = Omit<typeof trainerAdvances.$inferInsert, 'id' | 'createdAt' | 'deductedAt' | 'salaryPaymentId' | 'status'>;

export type TrainerBonus = typeof trainerBonuses.$inferSelect;
export const insertTrainerBonusSchema = createInsertSchema(trainerBonuses).omit({ id: true, createdAt: true });
export type InsertTrainerBonus = Omit<typeof trainerBonuses.$inferInsert, 'id' | 'createdAt'>;

export type TrainerPayroll = typeof trainerPayrolls.$inferSelect;
export const insertTrainerPayrollSchema = createInsertSchema(trainerPayrolls).omit({ id: true });
export type InsertTrainerPayroll = Omit<typeof trainerPayrolls.$inferInsert, 'id'>;

// Expenses types
export type Expense = typeof expenses.$inferSelect;
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true, deletedReason: true });
export type InsertExpense = Omit<typeof expenses.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deletedBy' | 'deletedReason'>;

// Inventory types
export type InventoryItem = typeof inventoryItems.$inferSelect;
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, deletedBy: true, deletedReason: true });
export type InsertInventoryItem = Omit<typeof inventoryItems.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deletedBy' | 'deletedReason'>;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true, balanceAfter: true, unitCostAtTransaction: true, deletedAt: true, deletedBy: true, deletedReason: true });
export type InsertInventoryTransaction = Omit<typeof inventoryTransactions.$inferInsert, 'id' | 'createdAt' | 'balanceAfter' | 'unitCostAtTransaction' | 'deletedAt' | 'deletedBy' | 'deletedReason'>;

// Activity Log types
export type ActivityLog = typeof activityLogs.$inferSelect;
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = Omit<typeof activityLogs.$inferInsert, 'id' | 'createdAt'>;

// Activity display mapping
export const ACTIVITY_DISPLAY = {
  karate: { emoji: '🥋', label: 'Karate' },
  kickboxing: { emoji: '🥊', label: 'Kickboxing' },
  football: { emoji: '⚽', label: 'Football' },
  swimming: { emoji: '🏊🏼', label: 'Swimming' },
  zumba: { emoji: '💃', label: 'Zumba' },
  aerobics: { emoji: '🏋🏻‍♂️', label: 'Aerobics' },
  crossfit: { emoji: '🏋🏻‍♂️', label: 'CrossFit' },
  gymnastics: { emoji: '👯‍♀️', label: 'Gymnastics' },
  quran_memorization: { emoji: '📖', label: 'Quran Memorization' },
  kindergarten: { emoji: '🎒', label: 'Kindergarten' },
} as const;
