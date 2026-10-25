import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../database/pool.js";
import { validateRequest } from "../middleware/validate.js";
import { formSubmissionLimiter } from "../middleware/rateLimiters.js";
import { supportSchemas } from "../validators/schemas.js";
import { DonationService } from "../services/DonationService.js";
import { NotificationService } from "../services/NotificationService.js";
import { z } from "zod";

const router = Router();

const verifyDonationSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  donationId: z.string().optional(),
});

/**
 * POST /api/support/donate
 * Creates a Checkout Session with the requested active provider (PayPal, Pay'm, or Stripe when enabled)
 * Enforces server-side validation, rate limiting, and zero credential exposure
 */
router.post(
  "/donate",
  formSubmissionLimiter,
  validateRequest({ body: supportSchemas.donate }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, amount, currency, frequency, message, provider, paymMethod } = req.body;
      const checkoutResult = await DonationService.createDonationCheckout({
        name,
        email,
        phone,
        amount,
        currency,
        frequency,
        message,
        provider,
        paymMethod,
      });

      res.status(201).json({
        success: true,
        message: "Donation checkout initialized successfully.",
        data: checkoutResult,
      });
    } catch (error: any) {
      console.error("[Donation Error]:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || "DONATION_ERROR",
          message: error.message || "Failed to initialize donation",
        },
      });
    }
  }
);

/**
 * POST /api/support/verify-donation-provider
 * Authoritative verification for completed PayPal, Pay'm, or Stripe donation
 * Enforces that donations NEVER enroll a user in any cohort
 */
router.post(
  "/verify-donation-provider",
  formSubmissionLimiter,
  validateRequest({ body: supportSchemas.verifyDonationProvider }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider, donationId, orderId, referenceId, transactionId, sessionId } = req.body;
      const result = await DonationService.verifyDonationProvider({
        provider,
        donationId,
        orderId,
        referenceId,
        transactionId,
        sessionId,
      });
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/verify-donation-session
 * Server-to-server cryptographic verification of completed Stripe donation session
 * Preserved for Stripe verification.
 */
router.post(
  "/verify-donation-session",
  formSubmissionLimiter,
  validateRequest({ body: verifyDonationSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, donationId } = req.body;
      const result = await DonationService.verifyDonationSession(sessionId, donationId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/support/volunteer
 * Public volunteer application form submission
 */
router.post(
  "/volunteer",
  formSubmissionLimiter,
  validateRequest({ body: supportSchemas.volunteer }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, phone, area, availability, message } = req.body;
      const result = await pool.query(
        `INSERT INTO volunteers (name, email, phone, area, availability, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         RETURNING id, name, email, area, availability, status, created_at`,
        [name, email, phone || null, area, availability, message || null]
      );

      void NotificationService.notifyAdmins({
        type: "APPLICATION",
        titleEn: "New Volunteer Application",
        titleFr: "Nouvelle candidature bénévole",
        bodyEn: `${name} applied to volunteer in ${area}.`,
        bodyFr: `${name} a postulé pour devenir bénévole en ${area}.`,
      });

      res.status(201).json({
        success: true,
        message: "Thank you for volunteering! Admissions will reach out to you before the next cohort.",
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
