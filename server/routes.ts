import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, ALLOWED_REFUND_METHODS } from "./storage";
import { insertPlayerSchema, insertPaymentSchema, insertSessionSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'client/public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg, .jpeg and .pdf format allowed!'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication middleware for API routes
  app.use('/api', (req, res, next) => {
    // Allow authentication endpoints to go through without check
    const publicPaths = ['/login', '/logout', '/user'];
    if (publicPaths.includes(req.path)) {
      return next();
    }
    
    // Check if user is authenticated for all other API routes
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    next();
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
    }
  });

  app.get("/api/dashboard/upcoming-renewals", async (req, res) => {
    try {
      const renewals = await storage.getUpcomingRenewals();
      res.json(renewals);
    } catch (error) {
      console.error("Error fetching upcoming renewals:", error);
      res.status(500).json({ message: "Failed to fetch upcoming renewals" });
    }
  });

  app.get("/api/dashboard/recent-activities", async (req, res) => {
    try {
      const activities = await storage.getRecentActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  app.get("/api/dashboard/renewal-notifications", async (req, res) => {
    try {
      const notifications = await storage.getRenewalNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching renewal notifications:", error);
      res.status(500).json({ message: "Failed to fetch renewal notifications" });
    }
  });

  // Player routes
  app.get("/api/players", async (req, res) => {
    try {
      const { activity } = req.query;
      let players;
      
      if (activity && typeof activity === 'string') {
        players = await storage.getPlayersByActivity(activity);
      } else {
        players = await storage.getPlayers();
      }
      
      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  app.get("/api/players/:id", async (req, res) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Get player documents and payments
      const documents = await storage.getPlayerDocuments(player.id);
      const payments = await storage.getPlayerPayments(player.id);
      const sessions = await storage.getPlayerSessions(player.id);
      
      res.json({
        ...player,
        documents,
        payments,
        sessions
      });
    } catch (error) {
      console.error("Error fetching player:", error);
      res.status(500).json({ message: "Failed to fetch player details" });
    }
  });

  app.post("/api/players", upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'medicalForm', maxCount: 1 }
  ]), async (req, res) => {
    try {
      // Parse subscription date and end date
      const subscriptionDate = new Date(req.body.subscriptionDate);
      
      // Use provided end date or calculate renewal date (subscription date + 1 month)
      let renewalDate: Date;
      let subscriptionEndDate: Date;
      
      if (req.body.subscriptionEndDate && req.body.subscriptionEndDate.trim() !== '') {
        subscriptionEndDate = new Date(req.body.subscriptionEndDate);
        renewalDate = new Date(req.body.subscriptionEndDate);
      } else {
        renewalDate = new Date(subscriptionDate);
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        subscriptionEndDate = new Date(renewalDate);
      }

      // Validate player data
      const playerData = insertPlayerSchema.parse({
        fullName: req.body.fullName,
        dateOfBirth: new Date(req.body.dateOfBirth),
        phoneNumber: req.body.phoneNumber || null,
        email: req.body.email || null,
        activity: req.body.activity,
        subscriptionDate: subscriptionDate,
        renewalDate: renewalDate,
        subscriptionEndDate: subscriptionEndDate,
        totalSessionsAllowed: parseInt(req.body.totalSessionsAllowed) || 8,
        monthlySubscriptionFee: Array.isArray(req.body.subscriptionFee) ? req.body.subscriptionFee[0] : (req.body.subscriptionFee || "200"),
        discountPercentage: Array.isArray(req.body.discountPercentage) ? req.body.discountPercentage[0] : (req.body.discountPercentage || "0"),
        specialNotes: req.body.specialNotes || null,
      });

      const player = await storage.createPlayer(playerData);

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.idDocument) {
        const file = files.idDocument[0];
        await storage.createPlayerDocument({
          playerId: player.id,
          documentType: 'id',
          fileName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      }

      if (files.medicalForm) {
        const file = files.medicalForm[0];
        await storage.createPlayerDocument({
          playerId: player.id,
          documentType: 'medical_form',
          fileName: file.originalname,
          filePath: `/uploads/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      }

      // Create initial payment record if amount paid is provided and > 0
      const subscriptionFee = Array.isArray(req.body.subscriptionFee) ? req.body.subscriptionFee[0] : (req.body.subscriptionFee || "200");
      const amountPaidInput = Array.isArray(req.body.amountPaid) ? req.body.amountPaid[0] : (req.body.amountPaid || '0');
      const amountPaid = parseFloat(amountPaidInput);
      
      if (subscriptionFee && amountPaid > 0) {
        const paymentData = {
          playerId: player.id,
          subscriptionFee: subscriptionFee,
          amountPaid: amountPaid.toString(),
          remainingBalance: (parseFloat(subscriptionFee) - amountPaid).toString(),
          paymentMethod: Array.isArray(req.body.paymentMethod) ? req.body.paymentMethod[0] : (req.body.paymentMethod || 'cash'),
          description: 'Initial subscription payment',
        };

        await storage.createPayment(paymentData);
      }

      res.status(201).json(player);
    } catch (error) {
      console.error("Error creating player:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create player" });
    }
  });

  app.put("/api/players/:id", async (req, res) => {
    try {
      // Convert date strings to Date objects and calculate renewal date if subscription date is provided
      let updateData = { ...req.body };
      
      // Convert dateOfBirth string to Date object if present
      if (req.body.dateOfBirth) {
        updateData.dateOfBirth = new Date(req.body.dateOfBirth);
      }
      
      if (req.body.subscriptionDate) {
        updateData.subscriptionDate = new Date(req.body.subscriptionDate);
        // Update renewalDate when subscriptionDate changes
        if (req.body.subscriptionEndDate) {
          updateData.renewalDate = new Date(req.body.subscriptionEndDate);
        } else {
          const renewalDate = new Date(updateData.subscriptionDate);
          renewalDate.setMonth(renewalDate.getMonth() + 1);
          updateData.renewalDate = renewalDate;
        }
      }
      
      if (req.body.subscriptionEndDate) {
        updateData.subscriptionEndDate = new Date(req.body.subscriptionEndDate);
        // Also update renewalDate to match subscriptionEndDate
        updateData.renewalDate = new Date(req.body.subscriptionEndDate);
      }
      
      if (req.body.pausedDate) {
        updateData.pausedDate = new Date(req.body.pausedDate);
      }

      const playerData = insertPlayerSchema.partial().parse(updateData);
      const player = await storage.updatePlayer(req.params.id, playerData);
      
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      res.json(player);
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update player" });
    }
  });

  // Player renewal route
  app.post("/api/players/:id/renew", async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        subscriptionFee, 
        totalSessionsAllowed, 
        subscriptionStartDate,
        subscriptionEndDate,
        amountPaid = 0, 
        paymentMethod = 'cash', 
        description = 'Subscription renewal' 
      } = req.body;
      
      // Get current player
      const currentPlayer = await storage.getPlayer(id);
      if (!currentPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }
      
      // Use provided dates or calculate new dates
      const newSubscriptionDate = subscriptionStartDate ? new Date(subscriptionStartDate) : new Date();
      const newRenewalDate = subscriptionEndDate ? new Date(subscriptionEndDate) : (() => {
        const calculated = new Date(newSubscriptionDate);
        calculated.setMonth(calculated.getMonth() + 1);
        return calculated;
      })();
      
      // Archive all current payments before renewal
      const currentSubscriptionStart = currentPlayer.subscriptionDate ? new Date(currentPlayer.subscriptionDate) : new Date();
      const currentSubscriptionEnd = currentPlayer.subscriptionEndDate ? new Date(currentPlayer.subscriptionEndDate) : new Date();
      
      await storage.archivePlayerPayments(id, currentSubscriptionStart, currentSubscriptionEnd);
      await storage.clearPlayerCurrentPayments(id);
      
      // Reset player data for renewal
      const renewalData = {
        subscriptionDate: newSubscriptionDate,
        renewalDate: newRenewalDate,
        subscriptionEndDate: newRenewalDate, // Use the renewal date as end date
        subscriptionStatus: 'active' as any,
        sessionsAttended: 0,
        totalSessionsAllowed: totalSessionsAllowed || currentPlayer.totalSessionsAllowed,
        monthlySubscriptionFee: subscriptionFee || currentPlayer.monthlySubscriptionFee,
        pausedDate: null,
        pauseReason: null,
        updatedAt: new Date()
      };
      
      // Update player
      const updatedPlayer = await storage.updatePlayer(id, renewalData);
      
      // Create new payment record for the new subscription period if amount paid is provided
      if (amountPaid > 0) {
        const newSubscriptionFee = parseFloat(subscriptionFee) || parseFloat(currentPlayer.monthlySubscriptionFee);
        const paymentAmount = parseFloat(amountPaid);
        const remainingBalance = Math.max(0, newSubscriptionFee - paymentAmount);
        
        const paymentData = {
          playerId: id,
          subscriptionFee: newSubscriptionFee.toString(),
          amountPaid: paymentAmount.toString(),
          remainingBalance: remainingBalance.toString(),
          paymentMethod: paymentMethod,
          description: description || "Payment for new subscription period",
        };
        await storage.createPayment(paymentData);
      }
      
      res.json(updatedPlayer);
    } catch (error) {
      console.error("Error renewing player subscription:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to renew subscription" });
    }
  });

  app.delete("/api/players/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // First get player to check if exists
      const player = await storage.getPlayer(id);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Get player documents to clean up files
      const documents = await storage.getPlayerDocuments(id);
      
      // Delete the player (this should cascade delete related records)
      const deleted = await storage.deletePlayer(id);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete player" });
      }

      // Clean up document files
      documents.forEach(doc => {
        try {
          const filePath = path.join(process.cwd(), 'client/public', doc.filePath);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn("Could not delete document file:", fileError);
        }
      });

      res.json({ message: "Player deleted successfully" });
    } catch (error) {
      console.error("Error deleting player:", error);
      res.status(500).json({ message: "Failed to delete player" });
    }
  });

  // Payment routes
  app.get("/api/payments", async (req, res) => {
    try {
      const playerId = req.query.playerId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (playerId && playerId !== "all") {
        // Fetch payments for specific player with date filtering
        let payments = await storage.getPlayerPayments(playerId);
        
        // Apply date filtering if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          payments = payments.filter((payment: any) => {
            const paymentDate = new Date(payment.paymentDate);
            return paymentDate >= start && paymentDate <= end;
          });
        }
        
        res.json(payments);
      } else {
        // Fetch all payments with date filtering
        let payments = await storage.getPayments();
        
        // Apply date filtering if provided
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          payments = payments.filter((payment: any) => {
            const paymentDate = new Date(payment.paymentDate);
            return paymentDate >= start && paymentDate <= end;
          });
        }
        
        res.json(payments);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/payments/history/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const paymentHistory = await storage.getPlayerPaymentHistory(playerId);
      res.json(paymentHistory);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      
      // Setting player to active status because they made a payment
      await storage.updatePlayer((paymentData as any).playerId, {
        subscriptionStatus: 'active'
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create payment" });
    }
  });

  app.post("/api/payments/additional", async (req, res) => {
    try {
      const { playerId, amountPaid, paymentMethod, description } = req.body;

      // Get player to access subscription fee
      const player = await storage.getPlayerById(playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Get all payments for this player to calculate total paid
      const playerPayments = await storage.getPlayerPayments(playerId);
      
      // Use player's monthly subscription fee as the baseline
      const subscriptionFee = parseFloat(player.monthlySubscriptionFee);
      
      // Calculate total paid so far
      const totalPaidSoFar = playerPayments.reduce((sum: number, payment: any) => {
        return sum + parseFloat(payment.amountPaid);
      }, 0);
      
      const newAmountPaid = parseFloat(amountPaid);
      const newTotalPaid = totalPaidSoFar + newAmountPaid;
      const newRemainingBalance = Math.max(0, subscriptionFee - newTotalPaid);

      // Validate that the new payment doesn't exceed subscription fee
      if (newTotalPaid > subscriptionFee) {
        return res.status(400).json({ 
          message: `Payment amount exceeds subscription fee. Maximum payment allowed: $${(subscriptionFee - totalPaidSoFar).toFixed(2)}` 
        });
      }

      // Generate receipt number
      const receiptNumber = `RCT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const paymentData = {
        playerId: playerId,
        subscriptionFee: subscriptionFee.toString(),
        amountPaid: newAmountPaid.toString(),
        remainingBalance: newRemainingBalance.toString(),
        paymentMethod: paymentMethod,
        description: description || 'Additional subscription payment',
        receiptNumber: receiptNumber,
      };

      const payment = await storage.createPayment(paymentData);

      // Setting player to active status because they made a payment
      await storage.updatePlayer(playerId, {
        subscriptionStatus: 'active'
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating additional payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create payment" });
    }
  });

  // ─── Payment Refund routes ──────────────────────────────────────────────────

  app.post("/api/payments/:paymentId/refund", async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { refundAmount, refundMethod, reason } = req.body;

      // ── 1. Extract authenticated admin from session (NEVER from body) ────────
      // Passport.js populates req.user from the session after successful login.
      // Accepting refundedBy from the request body would allow spoofing.
      const refundedBy: string | undefined = (req.user as any)?.id;

      // ── 2. Validate refund method against strict allowlist ─────────────────
      const normalizedMethod = (refundMethod ?? 'cash').toString().toLowerCase().trim();
      if (!(ALLOWED_REFUND_METHODS as readonly string[]).includes(normalizedMethod)) {
        return res.status(400).json({
          message: `Invalid refund method '${normalizedMethod}'. Allowed values: ${ALLOWED_REFUND_METHODS.join(', ')}`,
        });
      }

      // ── 3. Validate amount ─────────────────────────────────────────────────
      if (!refundAmount || isNaN(parseFloat(refundAmount)) || parseFloat(refundAmount) <= 0) {
        return res.status(400).json({ message: "refundAmount must be a positive number" });
      }

      // ── 4. Validate reason ─────────────────────────────────────────────────
      if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ message: "Refund reason is required (min 3 characters)" });
      }

      // ── 5. Verify payment exists ───────────────────────────────────────────
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // ── 6. Delegate to storage — playerId is derived from payment, NOT from body
      const refund = await storage.createPaymentRefund(
        {
          paymentId,
          playerId: payment.playerId,   // always server-side, never body
          refundAmount: String(parseFloat(refundAmount)),
          refundMethod: normalizedMethod,
          reason: reason.trim(),
        },
        refundedBy,
      );

      // Return updated payment state and summary for the UI to sync
      const updatedPayment = await storage.getPayment(paymentId);
      const summary = await storage.getRefundSummary(paymentId);

      res.status(201).json({ refund, payment: updatedPayment, summary });
    } catch (error) {
      console.error("Error creating refund:", error);
      const msg = error instanceof Error ? error.message : "Failed to process refund";
      const status = msg.includes('not found') ? 404
                   : msg.includes('Cannot refund') || msg.includes('exceeds') ? 422
                   : 400;
      res.status(status).json({ message: msg });
    }
  });

  app.get("/api/payments/:paymentId/refunds", async (req, res) => {
    try {
      const { paymentId } = req.params;
      const refunds = await storage.getPaymentRefunds(paymentId);
      const summary = await storage.getRefundSummary(paymentId);
      res.json({ refunds, summary });
    } catch (error) {
      console.error("Error fetching refunds:", error);
      res.status(500).json({ message: "Failed to fetch refunds" });
    }
  });

  app.get("/api/players/:playerId/refunds", async (req, res) => {
    try {
      const { playerId } = req.params;
      const refunds = await storage.getPlayerRefunds(playerId);
      res.json(refunds);
    } catch (error) {
      console.error("Error fetching player refunds:", error);
      res.status(500).json({ message: "Failed to fetch player refunds" });
    }
  });

  // Document Management Routes
  app.post("/api/players/:playerId/documents", upload.any(), async (req, res) => {
    try {
      const { playerId } = req.params;
      const { documentType } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const file = files[0];

      const document = await storage.createPlayerDocument({
        playerId,
        documentType,
        fileName: file.originalname,
        filePath: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to upload document" });
    }
  });

  app.delete("/api/players/documents/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;

      // Get document info before deletion to remove file
      const document = await storage.getPlayerDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const deleted = await storage.deletePlayerDocument(documentId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete document from database" });
      }

      // Try to delete the physical file
      try {
        const filePath = path.join(process.cwd(), 'client/public', document.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.warn("Could not delete physical file:", fileError);
      }

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Session routes
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      // Convert date strings to Date objects before validation
      const sessionData = {
        playerId: req.body.playerId,
        sessionDate: new Date(req.body.sessionDate),
        scheduledStartTime: new Date(req.body.scheduledStartTime), 
        scheduledEndTime: new Date(req.body.scheduledEndTime),
        instructorName: req.body.instructorName || null,
        notes: req.body.notes || null,
        attendanceStatus: req.body.attendanceStatus || 'present',
        sessionStatus: req.body.sessionStatus || 'scheduled',
        actualStartTime: req.body.actualStartTime ? new Date(req.body.actualStartTime) : null,
        actualEndTime: req.body.actualEndTime ? new Date(req.body.actualEndTime) : null,
      };
      
      const session = await storage.createSession(sessionData);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.post("/api/sessions/:sessionId/attendance", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { playerId, status, notes } = req.body;
      
      const session = await storage.markAttendance(sessionId, status, notes);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error marking attendance:", error);
      res.status(500).json({ message: "Failed to mark attendance" });
    }
  });

  app.get("/api/sessions/player/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const sessions = await storage.getPlayerSessions(playerId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching player sessions:", error);
      res.status(500).json({ message: "Failed to fetch player sessions" });
    }
  });

  app.get("/api/payments/player/:playerId", async (req, res) => {
    try {
      const payments = await storage.getPlayerPayments(req.params.playerId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching player payments:", error);
      res.status(500).json({ message: "Failed to fetch player payments" });
    }
  });

  // Dashboard API routes
  app.get("/api/dashboard/renewal-notifications", async (req, res) => {
    try {
      const notifications = await storage.getRenewalNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching renewal notifications:", error);
      res.status(500).json({ message: "Failed to fetch renewal notifications" });
    }
  });

  app.get("/api/dashboard/upcoming-renewals", async (req, res) => {
    try {
      const renewals = await storage.getUpcomingRenewals();
      res.json(renewals);
    } catch (error) {
      console.error("Error fetching upcoming renewals:", error);
      res.status(500).json({ message: "Failed to fetch upcoming renewals" });
    }
  });

  app.get("/api/dashboard/recent-activities", async (req, res) => {
    try {
      const activities = await storage.getRecentActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Failed to fetch recent activities" });
    }
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });





  app.put("/api/sessions/:id", async (req, res) => {
    try {
      const sessionData = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, sessionData);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update session" });
    }
  });

  // ─── Trainer routes ────────────────────────────────────────────────────────

  app.get("/api/trainers", async (req, res) => {
    try {
      const trainerList = await storage.getTrainers();
      res.json(trainerList);
    } catch (error) {
      console.error("Error fetching trainers:", error);
      res.status(500).json({ message: "Failed to fetch trainers" });
    }
  });

  app.post("/api/trainers", async (req, res) => {
    try {
      const { name, activity, baseSalary } = req.body;
      if (!name || !activity || baseSalary === undefined) {
        return res.status(400).json({ message: "name, activity, and baseSalary are required" });
      }
      const trainer = await storage.createTrainer({ name, activity, baseSalary: String(baseSalary) });
      res.status(201).json(trainer);
    } catch (error) {
      console.error("Error creating trainer:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create trainer" });
    }
  });

  app.put("/api/trainers/:id", async (req, res) => {
    try {
      const update: any = {};
      if (req.body.name !== undefined) update.name = req.body.name;
      if (req.body.activity !== undefined) update.activity = req.body.activity;
      if (req.body.baseSalary !== undefined) update.baseSalary = String(req.body.baseSalary);
      const trainer = await storage.updateTrainer(req.params.id, update);
      if (!trainer) return res.status(404).json({ message: "Trainer not found" });
      res.json(trainer);
    } catch (error) {
      console.error("Error updating trainer:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update trainer" });
    }
  });

  app.delete("/api/trainers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTrainer(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Trainer not found" });
      res.json({ message: "Trainer deleted successfully" });
    } catch (error) {
      console.error("Error deleting trainer:", error);
      res.status(500).json({ message: "Failed to delete trainer" });
    }
  });

  // Trainer salary payments
  app.get("/api/trainers/:id/salary-payments", async (req, res) => {
    try {
      const month = req.query.month as string | undefined;
      const payments = await storage.getTrainerSalaryPayments(req.params.id, month);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching trainer salary payments:", error);
      res.status(500).json({ message: "Failed to fetch salary payments" });
    }
  });

  app.post("/api/trainers/:id/salary-payments", async (req, res) => {
    try {
      const { amount, month, notes, advanceIdsToDeduct = [] } = req.body;
      if (!amount || !month) {
        return res.status(400).json({ message: "amount and month are required" });
      }
      const payment = await storage.createTrainerSalaryPayment(
        { trainerId: req.params.id, amount: String(amount), month, notes: notes || null },
        advanceIdsToDeduct
      );
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating salary payment:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create salary payment" });
    }
  });

  // Trainer advances
  app.get("/api/trainers/:id/advances", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const advances = await storage.getTrainerAdvances(req.params.id, status);
      res.json(advances);
    } catch (error) {
      console.error("Error fetching trainer advances:", error);
      res.status(500).json({ message: "Failed to fetch advances" });
    }
  });

  app.post("/api/trainers/:id/advances", async (req, res) => {
    try {
      const { amount, notes } = req.body;
      if (!amount) {
        return res.status(400).json({ message: "amount is required" });
      }
      const advance = await storage.createTrainerAdvance({
        trainerId: req.params.id,
        amount: String(amount),
        notes: notes || null,
      });
      res.status(201).json(advance);
    } catch (error) {
      console.error("Error creating advance:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create advance" });
    }
  });

  app.post("/api/trainers/:id/advances/:advanceId/repay", async (req, res) => {
    try {
      // repaid_note is optional — stored alongside timestamp in notes field
      const { repaid_note } = req.body;
      const advance = await storage.repayTrainerAdvance(req.params.advanceId, repaid_note);
      if (!advance) {
        return res.status(404).json({ message: "Advance not found or not pending" });
      }
      res.json(advance);
    } catch (error) {
      console.error("Error repaying advance:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to repay advance" });
    }
  });

  // Trainer bonuses
  app.get("/api/trainers/:id/bonuses", async (req, res) => {
    try {
      const month = req.query.month as string | undefined;
      const bonuses = await storage.getTrainerBonuses(req.params.id, month);
      res.json(bonuses);
    } catch (error) {
      console.error("Error fetching trainer bonuses:", error);
      res.status(500).json({ message: "Failed to fetch bonuses" });
    }
  });

  app.post("/api/trainers/:id/bonuses", async (req, res) => {
    try {
      const { amount, month, note } = req.body;
      if (!amount || !month) {
        return res.status(400).json({ message: "amount and month are required" });
      }
      const bonus = await storage.createTrainerBonus({
        trainerId: req.params.id,
        amount: String(amount),
        month,
        note: note || null,
      });
      res.status(201).json(bonus);
    } catch (error) {
      console.error("Error creating bonus:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create bonus" });
    }
  });

  // Trainer payroll locking
  app.post("/api/trainers/:id/payrolls/lock", async (req, res) => {
    try {
      const { month } = req.body;
      if (!month) {
        return res.status(400).json({ message: "month is required" });
      }
      const payroll = await storage.lockTrainerPayroll(req.params.id, month);
      res.status(200).json(payroll);
    } catch (error) {
      console.error("Error locking payroll:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to lock payroll" });
    }
  });

  // Trainer ledger
  app.get("/api/trainers/:id/ledger", async (req, res) => {
    try {
      const month = (req.query.month as string) || 
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const ledger = await storage.getTrainerLedger(req.params.id, month);
      res.json(ledger);
    } catch (error) {
      console.error("Error fetching trainer ledger:", error);
      res.status(500).json({ message: "Failed to fetch trainer ledger" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
