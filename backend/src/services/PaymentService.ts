import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import {
  PaymentProvider,
  StripePaymentProvider,
  ManualPaymentProvider,
} from "./payments/PaymentProvider.js";
import { DonationService } from "./DonationService.js";
import { NotificationService } from "./NotificationService.js";

import { auth } from "../config/auth.js";

export interface PaymentIntentResult {
  paymentId: string;
  enrollmentId?: string;
  amount: number;
  currency: string;
  cohortId: string;
  status: string;
  checkoutUrl?: string;
  sessionId?: string;
}

export class PaymentService {
  private static providers: Record<string, PaymentProvider> = {
    STRIPE: new StripePaymentProvider(),
    MANUAL: new ManualPaymentProvider(),
  };

  /**
   * Register or override a payment provider
   */
  static registerProvider(provider: PaymentProvider) {
    this.providers[provider.name.toUpperCase()] = provider;
  }

  static getProvider(name: string = "STRIPE"): PaymentProvider {
    const p = this.providers[name.toUpperCase()];
    if (!p) {
      return this.providers.STRIPE;
    }
    return p;
  }

  /**
   * Creates a payment intent for a Cohort Enrollment.
   * Pulls price STRICTLY from cohort.fee_amount (fallback to program price if 0).
   * NEVER accepts or trusts client-supplied price.
   */
  static async createPaymentIntent({
    cohortId,
    enrollmentId,
    userId,
    applicationId,
    currency = "USD",
    provider = "STRIPE",
    customerEmail,
    cohortName,
  }: {
    cohortId?: string;
    enrollmentId?: string;
    userId?: string;
    applicationId?: string;
    currency?: "USD" | "EUR" | string;
    provider?: string;
    customerEmail?: string;
    cohortName?: string;
  }): Promise<PaymentIntentResult> {
    const selectedCurrency = currency?.toUpperCase() === "EUR" ? "EUR" : "USD";
    let targetCohortId = cohortId;
    let targetUserId = userId;

    // 1. If enrollmentId provided, derive cohort and user from enrollment
    if (enrollmentId) {
      const enrollRes = await pool.query(
        `SELECT id, user_id, cohort_id, status, payment_status 
         FROM enrollments 
         WHERE id = $1`,
        [enrollmentId]
      );
      if (enrollRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
      }
      const en = enrollRes.rows[0];
      targetCohortId = en.cohort_id;
      targetUserId = targetUserId || en.user_id;

      if (en.payment_status === "PAID") {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "This enrollment is already paid.");
      }
    }

    if (!targetCohortId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Cohort ID is required to create a payment intent.");
    }

    // 2. Fetch exact official price strictly from cohort or program
    const cohortRes = await pool.query(
      `SELECT c.id as cohort_id, c.name_en as cohort_name_en, c.fee_amount, c.fee_currency,
              p.title_en as program_title_en, p.price as program_price, p.price_eur as program_price_eur, p.currency as program_currency
       FROM cohorts c
       JOIN programs p ON p.id = c.program_id
       WHERE c.id = $1`,
      [targetCohortId]
    );

    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Invalid cohort specified for payment");
    }

    const cohortData = cohortRes.rows[0];
    const { fee_amount, program_price, program_price_eur } = cohortData;
    const resolvedCohortName = cohortName || cohortData.cohort_name_en || cohortData.program_title_en || "ILSI Cohort";
    
    // Use cohort fee if set > 0, otherwise fallback to program template price
    let officialAmount: number;
    if (fee_amount && Number(fee_amount) > 0) {
      officialAmount = Number(fee_amount);
      if (selectedCurrency === "EUR" && (!cohortData.fee_currency || cohortData.fee_currency === "USD")) {
        officialAmount = Math.round(officialAmount * 0.92);
      }
    } else {
      officialAmount = selectedCurrency === "EUR"
        ? (program_price_eur ? Number(program_price_eur) : Math.round(Number(program_price) * 0.92))
        : Number(program_price);
    }

    // Resolve customer email if not supplied
    let resolvedEmail = customerEmail;
    if (!resolvedEmail && targetUserId) {
      const uRes = await pool.query(`SELECT email FROM users WHERE id = $1`, [targetUserId]);
      resolvedEmail = uRes.rows[0]?.email;
    }
    if (!resolvedEmail && applicationId) {
      const aRes = await pool.query(`SELECT email FROM applications WHERE id = $1`, [applicationId]);
      resolvedEmail = aRes.rows[0]?.email;
    }

    // 3. Check for existing pending payment to prevent duplicate intents
    let existingPayment = null;
    if (targetUserId) {
      const existingPayRes = await pool.query(
        `SELECT id, enrollment_id, user_id, amount, currency, status 
         FROM payments 
         WHERE user_id = $1 AND cohort_id = $2 AND currency = $3 AND status = 'PENDING'
         ORDER BY created_at DESC LIMIT 1`,
        [targetUserId, targetCohortId, selectedCurrency]
      );
      if (existingPayRes.rows.length > 0) {
        existingPayment = existingPayRes.rows[0];
      }
    }
    if (!existingPayment && applicationId) {
      const existingAppPayRes = await pool.query(
        `SELECT id, enrollment_id, user_id, amount, currency, status 
         FROM payments 
         WHERE application_id = $1 AND status = 'PENDING'
         ORDER BY created_at DESC LIMIT 1`,
        [applicationId]
      );
      if (existingAppPayRes.rows.length > 0) {
        existingPayment = existingAppPayRes.rows[0];
      }
    }

    if (existingPayment) {
      const p = existingPayment;
      const selectedProvider = this.getProvider(provider);
      let session;
      try {
        session = await selectedProvider.createCheckoutSession({
          paymentId: p.id,
          enrollmentId: p.enrollment_id || enrollmentId,
          cohortId: targetCohortId,
          userId: p.user_id || targetUserId,
          applicationId: applicationId,
          customerEmail: resolvedEmail,
          cohortName: resolvedCohortName,
          amount: Number(p.amount),
          currency: p.currency,
        });
      } catch (err: any) {
        console.warn("Could not regenerate session for existing pending payment:", err.message);
      }

      return {
        paymentId: p.id,
        enrollmentId: p.enrollment_id || enrollmentId,
        amount: Number(p.amount),
        currency: p.currency,
        cohortId: targetCohortId,
        status: p.status,
        checkoutUrl: session?.checkoutUrl,
        sessionId: session?.sessionId,
      };
    }

    // 4. Record pending payment with server-enforced price
    const insertRes = await pool.query(
      `INSERT INTO payments (
         user_id, enrollment_id, application_id, cohort_id,
         amount, currency, status, provider, type
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, 'COHORT_FEE')
       RETURNING id, enrollment_id, amount, currency, status`,
      [
        targetUserId || null,
        enrollmentId || null,
        applicationId || null,
        targetCohortId,
        officialAmount,
        selectedCurrency,
        provider.toUpperCase(),
      ]
    );

    const payment = insertRes.rows[0];

    // 5. Generate provider checkout session
    const selectedProvider = this.getProvider(provider);
    let checkoutSession;
    try {
      checkoutSession = await selectedProvider.createCheckoutSession({
        paymentId: payment.id,
        enrollmentId: payment.enrollment_id,
        cohortId: targetCohortId,
        userId: targetUserId,
        applicationId,
        customerEmail: resolvedEmail,
        cohortName: resolvedCohortName,
        amount: officialAmount,
        currency: selectedCurrency,
      });
    } catch (err: any) {
      console.warn("Provider checkout session error:", err.message);
    }

    return {
      paymentId: payment.id,
      enrollmentId: payment.enrollment_id,
      amount: Number(payment.amount),
      currency: payment.currency,
      cohortId: targetCohortId,
      status: payment.status,
      checkoutUrl: checkoutSession?.checkoutUrl,
      sessionId: checkoutSession?.sessionId,
    };
  }

  /**
   * Verifies payment server-side and automatically updates enrollment to ACTIVE & PAID.
   * Includes anti-tampering amount and currency validation.
   */
  static async verifyPayment(
    paymentId: string,
    providerPaymentId?: string,
    options?: { expectedAmount?: number; expectedCurrency?: string }
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch payment
      const payRes = await client.query(
        `SELECT id, user_id, enrollment_id, application_id, cohort_id, amount, currency, status 
         FROM payments 
         WHERE id = $1`,
        [paymentId]
      );

      if (payRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Payment record not found");
      }

      const payment = payRes.rows[0];
      if (payment.status === "PAID") {
        await client.query("COMMIT");
        return { status: "PAID", message: "Payment already verified" };
      }

      // 2. Anti-tampering checks: verify amount and currency match database record
      if (options?.expectedAmount !== undefined && Math.abs(Number(payment.amount) - options.expectedAmount) > 0.01) {
        throw new AppError(
          400,
          "TAMPERED_PAYMENT",
          `Payment amount mismatch: expected ${payment.amount}, received ${options.expectedAmount}`
        );
      }
      if (options?.expectedCurrency && payment.currency.toUpperCase() !== options.expectedCurrency.toUpperCase()) {
        throw new AppError(
          400,
          "TAMPERED_PAYMENT",
          `Payment currency mismatch: expected ${payment.currency}, received ${options.expectedCurrency}`
        );
      }

      const resolvedProviderTx = providerPaymentId || `tx_${Date.now()}`;

      // 3. Update payment record to PAID
      await client.query(
        `UPDATE payments 
         SET status = 'PAID',
             provider_payment_id = $1,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [resolvedProviderTx, paymentId]
      );

      let effectiveUserId = payment.user_id;
      let effectiveEnrollmentId = payment.enrollment_id;

      // 4. Handle Application & Student User Activation
      if (payment.application_id) {
        const appRes = await client.query(
          `SELECT id, cohort_id, email, first_name, last_name, phone, country, city 
           FROM applications WHERE id = $1`,
          [payment.application_id]
        );

        if (appRes.rows.length > 0) {
          const app = appRes.rows[0];
          const targetCohort = payment.cohort_id || app.cohort_id;

          if (!effectiveUserId) {
            const userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [app.email.toLowerCase()]);
            if (userRes.rows.length > 0) {
              effectiveUserId = userRes.rows[0].id;
            } else {
              try {
                const tempPass = `ILSI_${Math.random().toString(36).substring(2, 8)}!`;
                const newUser = await auth.api.signUpEmail({
                  body: {
                    email: app.email.toLowerCase(),
                    password: tempPass,
                    name: `${app.first_name} ${app.last_name}`,
                  },
                });
                if (newUser?.user) {
                  effectiveUserId = newUser.user.id;
                  await client.query(`UPDATE users SET role = 'PARTICIPANT', first_login = TRUE WHERE id = $1`, [effectiveUserId]);
                  await client.query(
                    `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
                     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
                     ON CONFLICT (user_id) DO NOTHING`,
                    [effectiveUserId, app.first_name, app.last_name, app.phone, app.country, app.city]
                  );
                }
              } catch (signupErr: any) {
                console.warn("User auto-creation during payment verification note:", signupErr.message);
              }
            }
          }

          // Link user to payment
          if (effectiveUserId) {
            await client.query(`UPDATE payments SET user_id = $1 WHERE id = $2`, [effectiveUserId, paymentId]);
          }

          // Ensure enrollment exists and is marked ACTIVE and PAID
          if (effectiveUserId && targetCohort) {
            const enrollUpsert = await client.query(
              `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
               VALUES ($1, $2, 'ACTIVE', 'PAID', NOW())
               ON CONFLICT (user_id, cohort_id) DO UPDATE SET
                 status = 'ACTIVE',
                 payment_status = 'PAID',
                 updated_at = NOW()
               RETURNING id`,
              [effectiveUserId, targetCohort]
            );
            if (enrollUpsert.rows.length > 0) {
              effectiveEnrollmentId = enrollUpsert.rows[0].id;
              await client.query(`UPDATE payments SET enrollment_id = $1 WHERE id = $2`, [effectiveEnrollmentId, paymentId]);
            }
          }

          // Update application status
          await client.query(
            `UPDATE applications 
             SET payment_status = 'PAID', status = 'ENROLLED', updated_at = NOW() 
             WHERE id = $1`,
            [payment.application_id]
          );
        }
      }

      // 5. If enrollment is directly linked or user_id + cohort_id exist
      if (effectiveEnrollmentId) {
        await client.query(
          `UPDATE enrollments 
           SET payment_status = 'PAID',
               status = 'ACTIVE',
               updated_at = NOW()
           WHERE id = $1`,
          [effectiveEnrollmentId]
        );
      } else if (effectiveUserId && payment.cohort_id) {
        await client.query(
          `UPDATE enrollments 
           SET payment_status = 'PAID',
               status = 'ACTIVE',
               updated_at = NOW()
           WHERE user_id = $1 AND cohort_id = $2`,
          [effectiveUserId, payment.cohort_id]
        );
      }

      await client.query("COMMIT");

      // Notify Student and Admins
      if (effectiveUserId) {
        void NotificationService.create({
          userId: effectiveUserId,
          type: "PAYMENT",
          titleEn: "Payment Verified",
          titleFr: "Paiement vérifié",
          bodyEn: `Your payment of ${payment.amount} ${payment.currency} has been confirmed. Your cohort access is now active!`,
          bodyFr: `Votre paiement de ${payment.amount} ${payment.currency} a été confirmé. Votre accès à la cohorte est actif !`,
        });
      }

      void NotificationService.notifyAdmins({
        type: "PAYMENT",
        titleEn: "Enrollment Fee Received",
        titleFr: "Frais d'inscription reçus",
        bodyEn: `Received ${payment.amount} ${payment.currency} for cohort enrollment.`,
        bodyFr: `Paiement de ${payment.amount} ${payment.currency} reçu pour une inscription.`,
      });

      return { status: "PAID", message: "Payment verified successfully. Cohort access granted." };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cryptographically verifies Stripe checkout return session directly against Stripe's API.
   * Enforces anti-tampering (matching paymentId, matching amount, matching currency),
   * and anti-replay (guaranteeing one Stripe session cannot be reused for different payments).
   */
  static async verifySessionPayment(sessionId: string, clientPaymentId?: string) {
    const provider = this.getProvider("STRIPE") as StripePaymentProvider;
    if (!provider || typeof provider.retrieveSession !== "function") {
      throw new AppError(500, "PROVIDER_ERROR", "Stripe provider is not configured for session verification.");
    }

    const session = await provider.retrieveSession(sessionId);
    if (!session) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Stripe checkout session not found or invalid.");
    }

    if (session.payment_status !== "paid") {
      return {
        status: "PENDING",
        message: "Payment on Stripe has not been completed.",
      };
    }

    const targetPaymentId =
      session.metadata?.paymentId || session.client_reference_id || clientPaymentId;

    if (!targetPaymentId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Cannot identify payment reference from checkout session.");
    }

    // Anti-tampering: if client supplied paymentId, verify it matches Stripe session metadata
    if (clientPaymentId && session.metadata?.paymentId && clientPaymentId !== session.metadata.paymentId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "Security error: Payment reference mismatch.");
    }

    // Anti-replay: verify this Stripe session or payment_intent has not already been used for another payment record
    const providerTxId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

    const replayCheck = await pool.query(
      `SELECT id FROM payments WHERE provider_payment_id = $1 AND id != $2`,
      [providerTxId, targetPaymentId]
    );
    if (replayCheck.rows.length > 0) {
      throw new AppError(409, "REPLAY_DETECTED", "This Stripe payment was already attributed to another transaction.");
    }

    // Call verifyPayment with amount & currency check
    const expectedAmount = session.amount_total ? session.amount_total / 100 : undefined;
    const expectedCurrency = session.currency ? session.currency.toUpperCase() : undefined;

    return await this.verifyPayment(targetPaymentId, providerTxId, {
      expectedAmount,
      expectedCurrency,
    });
  }


  /**
   * Records a manual payment for a participant (Special case: First cohort or offline payments)
   */
  static async recordManualPayment({
    enrollmentId,
    amount,
    currency = "USD",
    notes,
  }: {
    enrollmentId: string;
    amount?: number;
    currency?: string;
    notes?: string;
  }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch enrollment
      const enrollRes = await client.query(
        `SELECT e.id, e.user_id, e.cohort_id, c.fee_amount, c.fee_currency
         FROM enrollments e
         JOIN cohorts c ON c.id = e.cohort_id
         WHERE e.id = $1`,
        [enrollmentId]
      );

      if (enrollRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
      }

      const en = enrollRes.rows[0];
      const finalAmount = amount !== undefined ? amount : (Number(en.fee_amount) || 0);
      const finalCurrency = currency || en.fee_currency || "USD";

      // 2. Insert or update payment record as PAID
      const payRes = await client.query(
        `INSERT INTO payments (
           user_id, enrollment_id, cohort_id, amount, currency,
           provider, provider_payment_id, status, type, paid_at, metadata
         )
         VALUES ($1, $2, $3, $4, $5, 'MANUAL', $6, 'PAID', 'COHORT_FEE', NOW(), $7)
         RETURNING *`,
        [
          en.user_id,
          en.id,
          en.cohort_id,
          finalAmount,
          finalCurrency,
          `manual_${Date.now()}`,
          JSON.stringify({ notes: notes || "First-cohort manual payment", manual: true }),
        ]
      );

      // 3. Activate enrollment
      await client.query(
        `UPDATE enrollments 
         SET status = 'ACTIVE',
             payment_status = 'PAID',
             updated_at = NOW()
         WHERE id = $1`,
        [enrollmentId]
      );

      await client.query("COMMIT");
      return {
        payment: payRes.rows[0],
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Idempotent Webhook Event Processor.
   * Guarantees that duplicate webhook deliveries from Stripe or payment providers
   * will never create duplicate payments, enrollments, or access grants.
   */
  static async handleWebhookEvent({
    provider = "STRIPE",
    eventId,
    eventType,
    payload,
  }: {
    provider?: string;
    eventId: string;
    eventType: string;
    payload: any;
  }) {
    // 1. Check if event was already processed
    const existing = await pool.query(
      `SELECT id, created_at FROM processed_webhook_events WHERE event_id = $1`,
      [eventId]
    );

    if (existing.rows.length > 0) {
      return {
        alreadyProcessed: true,
        message: "Webhook event already processed (idempotent ignore).",
        eventId,
      };
    }

    // 2. Record event in idempotency table
    await pool.query(
      `INSERT INTO processed_webhook_events (provider, event_id, event_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [provider, eventId, eventType, JSON.stringify(payload)]
    );

    // 3. Process payment event (Cohort Enrollment or Donation)
    const providerTransactionId =
      payload.transactionId || payload.data?.object?.id || eventId;

    const isDonation =
      payload.data?.object?.metadata?.type === "DONATION" ||
      Boolean(payload.data?.object?.metadata?.donationId);

    if (isDonation) {
      const donationId =
        payload.data?.object?.metadata?.donationId ||
        payload.data?.object?.client_reference_id;
      if (donationId) {
        await DonationService.completeDonationFromWebhook({
          donationId,
          sessionId: payload.data?.object?.id?.startsWith("cs_") ? payload.data?.object?.id : undefined,
          providerPaymentId: providerTransactionId,
          amount: payload.data?.object?.amount_total ? payload.data?.object?.amount_total / 100 : undefined,
          currency: payload.data?.object?.currency ? payload.data?.object?.currency.toUpperCase() : undefined,
        });
      }
    } else {
      const paymentId =
        payload.paymentId ||
        payload.data?.object?.metadata?.paymentId ||
        payload.data?.object?.client_reference_id;

      if (paymentId) {
        await this.verifyPayment(paymentId, providerTransactionId);
      }
    }

    return {
      alreadyProcessed: false,
      message: "Webhook event processed successfully.",
      eventId,
    };
  }
}
