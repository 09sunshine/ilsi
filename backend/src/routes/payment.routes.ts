import { Router, Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/PaymentService.js";
import { PaymentProviderRegistry } from "../services/payments/PaymentProvider.js";
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
  "/verify-provider",
  "/webhook",
  "/paypal/webhook",
  "/paym/webhook",
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
 * GET /api/payments/methods
 * Safe, server-generated list of currently active payment methods.
 * Omits disabled providers (e.g. Stripe when STRIPE_ENABLED=false).
 * Never exposes secrets, merchant credentials, or private configuration.
 */
router.get("/methods", (_req: Request, res: Response) => {
  const methods = PaymentProviderRegistry.getAvailableMethods();
  res.json({
    success: true,
    data: {
      methods,
    },
  });
});

/**
 * POST /api/payments/create-intent
 * Calculates price strictly from database and creates payment intent
 * Supports both authenticated participants and accepted applicants
 */
router.post(
  "/create-intent",
  validateRequest({ body: paymentSchemas.createIntent }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { cohortId, enrollmentId, applicationId, currency, provider, paymMethod, phoneNumber } = req.body;

      let effectiveUserId = req.user?.id;

      // IDOR defense: If enrollmentId is provided, ensure caller owns it or is admin
      if (enrollmentId) {
        if (!req.user) {
          throw new AppError(401, ErrorCodes.AUTH_REQUIRED, "Authentication required to pay for an existing enrollment");
        }
        const enCheck = await pool.query(
          `SELECT user_id FROM enrollments WHERE id = $1`,
          [enrollmentId]
        );
        if (enCheck.rows.length === 0) {
          throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
        }
        if (
          req.user.role !== "ADMIN" &&
          req.user.role !== "SUPER_ADMIN" &&
          enCheck.rows[0].user_id !== req.user.id
        ) {
          throw new AppError(
            403,
            ErrorCodes.FORBIDDEN,
            "Access denied: You cannot initiate payment for another user's enrollment"
          );
        }
        effectiveUserId = req.user.id;
      } else if (applicationId) {
        // Applicant check: ensure application exists and is accepted
        const appCheck = await pool.query(
          `SELECT id, status, cohort_id FROM applications WHERE id = $1`,
          [applicationId]
        );
        if (appCheck.rows.length === 0) {
          throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Application not found");
        }
        const app = appCheck.rows[0];
        if (app.status !== "ACCEPTED" && app.status !== "SELECTED" && app.status !== "ENROLLED") {
          throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Application is not yet approved for enrollment payment");
        }
        if (!cohortId && app.cohort_id) {
          cohortId = app.cohort_id;
        }
      } else if (!effectiveUserId) {
        throw new AppError(401, ErrorCodes.AUTH_REQUIRED, "Authentication or valid applicationId is required");
      }

      const result = await PaymentService.createPaymentIntent({
        cohortId,
        enrollmentId,
        userId: effectiveUserId,
        applicationId,
        currency,
        provider,
        paymMethod,
        phoneNumber,
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

      const { currency, provider, paymMethod, phoneNumber } = req.body;
      const result = await PaymentService.createPaymentIntent({
        enrollmentId,
        userId: req.user!.id,
        currency,
        provider,
        paymMethod,
        phoneNumber,
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
 * POST /api/payments/verify-provider
 * Authoritative verification for PayPal, Pay'm, and Stripe
 */
router.post(
  "/verify-provider",
  validateRequest({ body: paymentSchemas.verifyProvider }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider, paymentId, orderId, referenceId, transactionId } = req.body;
      const result = await PaymentService.verifyProviderPayment({
        provider,
        paymentId,
        orderId,
        referenceId,
        transactionId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/payments/verify-session
 * Cryptographically verifies checkout session directly with Stripe API.
 * Preserved for historical/legacy Stripe transactions.
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
 * POST /api/payments/paypal/webhook
 * PayPal webhook handler with cryptographic signature verification and idempotency protection
 */
router.post("/paypal/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPayload = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
    const provider = PaymentService.getProvider("PAYPAL");

    const webhookResult = await provider.handleWebhook(rawPayload, undefined, req.headers);

    const result = await PaymentService.handleWebhookEvent({
      provider: "PAYPAL",
      eventId: webhookResult.eventId,
      eventType: webhookResult.eventType,
      payload: webhookResult.rawPayload,
    });

    if (webhookResult.status === "PAID" && webhookResult.paymentId && !result.alreadyProcessed) {
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

/**
 * POST /api/payments/paym/webhook
 * Pay'm webhook handler with constant-time HMAC-SHA256 signature verification and idempotency protection
 */
router.post("/paym/webhook", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = (req.headers["x-webhook-signature"] || req.headers["X-Webhook-Signature"]) as string | undefined;
    const rawPayload = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
    const provider = PaymentService.getProvider("PAYM");

    const webhookResult = await provider.handleWebhook(req.body, signature, {
      rawBody: (req as any).rawBody || rawPayload,
      "x-webhook-signature": signature,
    });

    const result = await PaymentService.handleWebhookEvent({
      provider: "PAYM",
      eventId: webhookResult.eventId,
      eventType: webhookResult.eventType,
      payload: webhookResult.rawPayload,
    });

    if (webhookResult.status === "PAID" && webhookResult.paymentId && !result.alreadyProcessed) {
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

/**
 * POST /api/payments/webhook
 * Cryptographically signed Stripe webhook handler with idempotency protection.
 * Preserved for Stripe webhook reconciliation.
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
