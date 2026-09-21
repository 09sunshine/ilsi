import { Router, Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/PaymentService.js";
import { requireAuth, requireRole } from "../middleware/rbac.js";
import { validateRequest } from "../middleware/validate.js";
import { paymentLimiter } from "../middleware/rateLimiters.js";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { paymentSchemas } from "../validators/schemas.js";

const router = Router();

// Apply payment rate limiter
const paymentPrefixes = [
  "/create-intent",
  "/enrollments",
  "/verify-session",
  "/webhook",
  "/applications",
];

router.use((req: Request, res: Response, next: NextFunction) => {
  const isPaymentRoute = paymentPrefixes.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
  );
  if (!isPaymentRoute) {
    return next();
  }
  return paymentLimiter(req, res, next);
});

/**
 * POST /api/payments/create-intent
 * Calculates price strictly from database and creates payment intent
 */
router.post(
  "/create-intent",
  requireAuth,
  validateRequest({ body: paymentSchemas.createIntent }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cohortId, enrollmentId, applicationId, currency, provider } = req.body;

      // IDOR defense: If enrollmentId is provided, ensure caller owns it or is admin
      if (enrollmentId) {
        const enCheck = await pool.query(
          `SELECT user_id FROM enrollments WHERE id = $1`,
          [enrollmentId]
        );
        if (enCheck.rows.length === 0) {
          throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
        }
        if (
          req.user!.role !== "ADMIN" &&
          req.user!.role !== "SUPER_ADMIN" &&
          enCheck.rows[0].user_id !== req.user!.id
        ) {
          throw new AppError(
            403,
            ErrorCodes.FORBIDDEN,
            "Access denied: You cannot initiate payment for another user's enrollment"
          );
        }
      }

      const result = await PaymentService.createPaymentIntent({
        cohortId,
        enrollmentId,
        userId: req.user!.id,
        applicationId,
        currency,
        provider,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/enrollments/:id/payment
 * Creates payment intent specifically for an enrollment with IDOR protection
 */
router.post(
  "/enrollments/:id/payment",
  requireAuth,
  validateRequest({ body: paymentSchemas.enrollmentPayment }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enrollmentId = req.params.id as string;

      // IDOR defense: verify caller owns the enrollment or is an admin
      const enCheck = await pool.query(
        `SELECT user_id FROM enrollments WHERE id = $1`,
        [enrollmentId]
      );
      if (enCheck.rows.length === 0) {
        throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
      }
      if (
        req.user!.role !== "ADMIN" &&
        req.user!.role !== "SUPER_ADMIN" &&
        enCheck.rows[0].user_id !== req.user!.id
      ) {
        throw new AppError(
          403,
          ErrorCodes.FORBIDDEN,
          "Access denied: You cannot initiate payment for another user's enrollment"
        );
      }

      const { currency, provider } = req.body;
      const result = await PaymentService.createPaymentIntent({
        enrollmentId,
        userId: req.user!.id,
        currency,
        provider,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/enrollments/:id/payment-status
 * Queries current payment status for an enrollment
 */
router.get(
  "/enrollments/:id/payment-status",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enrollmentId = req.params.id as string;
      const enrollRes = await pool.query(
        `SELECT e.id, e.user_id, e.cohort_id, e.status, e.payment_status,
                p.id as payment_id, p.amount, p.currency, p.provider, p.paid_at
         FROM enrollments e
         LEFT JOIN payments p ON p.enrollment_id = e.id AND p.status = 'PAID'
         WHERE e.id = $1`,
        [enrollmentId]
      );

      if (enrollRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
      }

      const row = enrollRes.rows[0];

      // Non-admins can only view their own enrollment payment status
      if (req.user!.role !== "ADMIN" && req.user!.role !== "SUPER_ADMIN" && row.user_id !== req.user!.id) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, "Access denied");
      }

      res.json({
        success: true,
        data: {
          enrollmentId: row.id,
          cohortId: row.cohort_id,
          enrollmentStatus: row.status,
          paymentStatus: row.payment_status,
          paymentId: row.payment_id || null,
          amount: row.amount ? Number(row.amount) : null,
          currency: row.currency || null,
          provider: row.provider || null,
          paidAt: row.paid_at ? row.paid_at.toISOString() : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/verify-session
 * Cryptographically verifies checkout session directly with Stripe API.
 * Allows unauthenticated return callbacks from Stripe for applicants.
 * Enforces anti-tampering and anti-replay guarantees.
 */
router.post(
  "/verify-session",
  validateRequest({ body: paymentSchemas.verifySession }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, paymentId } = req.body;
      const result = await PaymentService.verifySessionPayment(sessionId, paymentId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/verify
 * Server-side payment verification (Strictly for authenticated administrative use)
 */
router.post(
  "/verify",
  requireAuth,
  requireRole(["ADMIN", "SUPER_ADMIN"]),
  validateRequest({ body: paymentSchemas.verifyPayment }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId, providerTransactionId } = req.body;
      const result = await PaymentService.verifyPayment(paymentId, providerTransactionId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/webhook
 * Cryptographically signed Stripe webhook handler with idempotency protection.
 */
router.post("/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers["stripe-signature"] as string | undefined;
    const rawPayload = (req as any).rawBody || JSON.stringify(req.body);
    const provider = PaymentService.getProvider("STRIPE");

    const webhookResult = await provider.handleWebhook(rawPayload, signature);

    const result = await PaymentService.handleWebhookEvent({
      provider: "STRIPE",
      eventId: webhookResult.eventId,
      eventType: webhookResult.eventType,
      payload: webhookResult.rawPayload,
    });

    const isDonation =
      webhookResult.rawPayload?.data?.object?.metadata?.type === "DONATION" ||
      Boolean(webhookResult.rawPayload?.data?.object?.metadata?.donationId);

    if (!isDonation && webhookResult.paymentId && !result.alreadyProcessed) {
      await PaymentService.verifyPayment(
        webhookResult.paymentId,
        webhookResult.providerPaymentId
      );
    }

    res.json({ received: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
