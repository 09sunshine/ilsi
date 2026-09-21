import Stripe from "stripe";
import { pool } from "../database/pool.js";
import { env } from "../config/env.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { NotificationService } from "./NotificationService.js";

export interface CreateDonationCheckoutParams {
  name: string;
  email: string;
  phone?: string;
  amount: number;
  currency?: "USD" | "EUR" | string;
  frequency?: "one-off" | "monthly" | string;
  message?: string;
}

export interface DonationCheckoutResult {
  donationId: string;
  sessionId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  frequency: string;
  status: string;
}

export interface DonationVerificationResult {
  status: "COMPLETED" | "PENDING" | "FAILED";
  donationId: string;
  amount: number;
  currency: string;
  frequency: string;
  donorName: string;
  donorEmail: string;
  paidAt?: Date;
  message?: string;
}

export class DonationService {
  private static stripe: Stripe | null = null;

  private static getStripe(): Stripe {
    if (!this.stripe) {
      const key = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new AppError(500, "PROVIDER_ERROR", "Stripe secret key is not configured.");
      }
      this.stripe = new Stripe(key, {
        apiVersion: "2026-08-26.dahlia" as any,
      });
    }
    return this.stripe;
  }

  /**
   * Principle 1: Strict Server-Side Validation & Input Sanitization
   * Principle 6: Zero Cardholder Data Retention (PCI-DSS compliant via Stripe Checkout)
   *
   * Creates a pending donation record and initializes a secure Stripe Checkout Session.
   */
  static async createDonationCheckout(
    params: CreateDonationCheckoutParams
  ): Promise<DonationCheckoutResult> {
    const rawAmount = Number(params.amount);
    if (!rawAmount || isNaN(rawAmount) || rawAmount < 1 || rawAmount > 100000) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Donation amount must be between 1 and 100,000."
      );
    }

    const currency = (params.currency || "USD").toUpperCase() === "EUR" ? "EUR" : "USD";
    const frequency = params.frequency === "monthly" ? "monthly" : "one-off";
    const name = params.name?.trim();
    const email = params.email?.trim().toLowerCase();
    const phone = params.phone?.trim() || null;
    const message = params.message?.trim() || null;

    if (!name || name.length < 2) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "A valid donor name is required.");
    }
    if (!email || !email.includes("@")) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "A valid donor email is required.");
    }

    // 1. Insert initial donation record with PENDING status inside database
    const insertRes = await pool.query(
      `INSERT INTO donations (
         name, email, phone, amount, currency, frequency, message, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING id, name, email, amount, currency, frequency, status, created_at`,
      [name, email, phone, rawAmount, currency, frequency, message]
    );

    const donation = insertRes.rows[0];
    const stripe = this.getStripe();
    const rawUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || "http://localhost:8080";
    const frontendUrl = rawUrl.split(",")[0].trim().replace(/\/+$/, "");

    const amountInCents = Math.round(rawAmount * 100);
    const isEur = currency === "EUR";
    const productName =
      frequency === "monthly"
        ? isEur
          ? "Don mensuel ILSI — Fonds de bourses d'études"
          : "ILSI Monthly Donation — Scholarship Fund"
        : isEur
        ? "Don ILSI — Fonds de bourses d'études"
        : "ILSI Donation — Scholarship Fund";

    const productDescription = isEur
      ? "Soutien direct aux bourses d'études pour les leaders émergents au sein des cohortes ILSI."
      : "Direct scholarship support funding seats for emerging leaders in ILSI cohorts.";

    const successUrl = `${frontendUrl}/about?donation=success&session_id={CHECKOUT_SESSION_ID}&donation_id=${donation.id}`;
    const cancelUrl = `${frontendUrl}/about?donation=cancelled&donation_id=${donation.id}`;

    // 2. Configure Stripe Checkout Session line items based on frequency
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: amountInCents,
          product_data: {
            name: productName,
            description: productDescription,
          },
          ...(frequency === "monthly"
            ? {
                recurring: {
                  interval: "month" as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval,
                },
              }
            : {}),
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: frequency === "monthly" ? "subscription" : "payment",
      line_items: lineItems,
      customer_email: email,
      client_reference_id: donation.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(frequency === "monthly" ? {} : { submit_type: "donate" as const }),
      metadata: {
        type: "DONATION",
        donationId: donation.id,
        donorName: name,
        donorEmail: email,
        frequency,
        currency,
        amount: String(rawAmount),
      },
    });

    if (!session.url) {
      throw new AppError(
        500,
        "PROVIDER_ERROR",
        "Stripe checkout session was created without a valid redirect URL."
      );
    }

    // 3. Save stripe_session_id on donation record
    await pool.query(
      `UPDATE donations SET stripe_session_id = $1 WHERE id = $2`,
      [session.id, donation.id]
    );

    void NotificationService.notifyAdmins({
      type: "PAYMENT",
      titleEn: "Donation Initiated via Stripe",
      titleFr: "Don initié via Stripe",
      bodyEn: `${name} initiated a donation of ${rawAmount} ${currency} (${frequency}).`,
      bodyFr: `${name} a initié un don de ${rawAmount} ${currency} (${frequency}).`,
    });

    return {
      donationId: donation.id,
      sessionId: session.id,
      checkoutUrl: session.url,
      amount: rawAmount,
      currency,
      frequency,
      status: "PENDING",
    };
  }

  /**
   * Principle 3 & 4: Anti-Tampering & Anti-Replay Server Verification
   * Principle 5: Atomic Database Transactions (ACID)
   * Principle 7: Fail-Safe Defaults & Idempotent State Transitions
   *
   * Verifies the checkout session directly against Stripe's API before updating DB.
   */
  static async verifyDonationSession(
    sessionId: string,
    clientDonationId?: string
  ): Promise<DonationVerificationResult> {
    if (!sessionId || !sessionId.startsWith("cs_")) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Invalid Stripe session ID.");
    }

    const stripe = this.getStripe();
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      throw new AppError(
        404,
        ErrorCodes.RESOURCE_NOT_FOUND,
        `Stripe session could not be verified: ${err.message}`
      );
    }

    // Check payment status from Stripe directly
    const isPaid =
      session.payment_status === "paid" ||
      (session.mode === "subscription" && session.status === "complete");

    if (!isPaid) {
      return {
        status: "PENDING",
        donationId: clientDonationId || "",
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: (session.currency || "USD").toUpperCase(),
        frequency: session.mode === "subscription" ? "monthly" : "one-off",
        donorName: session.customer_details?.name || "Donor",
        donorEmail: session.customer_details?.email || "",
        message: "Payment on Stripe has not been confirmed yet.",
      };
    }

    // Anti-tampering check: verify metadata identity
    const donationId =
      session.metadata?.donationId || session.client_reference_id || clientDonationId;

    if (!donationId) {
      throw new AppError(
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Cannot resolve donation reference from Stripe session."
      );
    }

    if (clientDonationId && session.metadata?.donationId && clientDonationId !== session.metadata.donationId) {
      throw new AppError(
        403,
        ErrorCodes.FORBIDDEN,
        "Security validation failed: donation ID mismatch."
      );
    }

    const providerPaymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : typeof session.subscription === "string"
        ? session.subscription
        : session.id;

    // Anti-replay check: ensure session is not applied to a different donation
    const replayCheck = await pool.query(
      `SELECT id FROM donations 
       WHERE (stripe_session_id = $1 OR provider_payment_id = $2) AND id != $3`,
      [sessionId, providerPaymentId, donationId]
    );
    if (replayCheck.rows.length > 0) {
      throw new AppError(
        409,
        "REPLAY_DETECTED",
        "This Stripe payment has already been credited to another transaction."
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Fetch target donation record with row lock to prevent race conditions
      const donRes = await client.query(
        `SELECT id, name, email, phone, amount, currency, frequency, message, status, paid_at
         FROM donations
         WHERE id = $1
         FOR UPDATE`,
        [donationId]
      );

      if (donRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Donation record not found.");
      }

      const donation = donRes.rows[0];

      // Anti-tampering check: verify amount & currency
      if (session.amount_total) {
        const chargedAmount = session.amount_total / 100;
        if (Math.abs(chargedAmount - Number(donation.amount)) > 0.05) {
          throw new AppError(
            400,
            "TAMPERED_PAYMENT",
            `Donation amount mismatch: expected ${donation.amount}, received ${chargedAmount}`
          );
        }
      }

      if (session.currency && session.currency.toUpperCase() !== donation.currency.toUpperCase()) {
        throw new AppError(
          400,
          "TAMPERED_PAYMENT",
          `Donation currency mismatch: expected ${donation.currency}, received ${session.currency.toUpperCase()}`
        );
      }

      // Idempotency check: if already completed, return immediately without re-executing
      if (donation.status === "COMPLETED" || donation.status === "PAID") {
        await client.query("COMMIT");
        return {
          status: "COMPLETED",
          donationId: donation.id,
          amount: Number(donation.amount),
          currency: donation.currency,
          frequency: donation.frequency,
          donorName: donation.name,
          donorEmail: donation.email,
          paidAt: donation.paid_at || new Date(),
          message: "Donation was already verified successfully.",
        };
      }

      // Atomic update to COMPLETED
      const updateRes = await client.query(
        `UPDATE donations 
         SET status = 'COMPLETED',
             stripe_session_id = $1,
             provider_payment_id = $2,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, name, email, amount, currency, frequency, status, paid_at`,
        [sessionId, providerPaymentId, donationId]
      );

      const updated = updateRes.rows[0];

      // Record audit log entry
      await client.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
         VALUES ('DONATION_COMPLETED', 'donation', $1, $2)`,
        [
          donationId,
          JSON.stringify({
            amount: updated.amount,
            currency: updated.currency,
            frequency: updated.frequency,
            providerPaymentId,
            donorEmail: updated.email,
            verifiedVia: "session_return",
          }),
        ]
      );

      await client.query("COMMIT");

      void NotificationService.notifyAdmins({
        type: "PAYMENT",
        titleEn: "Donation Confirmed via Stripe",
        titleFr: "Don confirmé via Stripe",
        bodyEn: `Received ${updated.amount} ${updated.currency} donation from ${updated.name}.`,
        bodyFr: `Don de ${updated.amount} ${updated.currency} reçu de ${updated.name}.`,
      });

      return {
        status: "COMPLETED",
        donationId: updated.id,
        amount: Number(updated.amount),
        currency: updated.currency,
        frequency: updated.frequency,
        donorName: updated.name,
        donorEmail: updated.email,
        paidAt: updated.paid_at,
        message: "Thank you for your generous gift! Your donation has been confirmed.",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Idempotent Webhook Completion for asynchronous Stripe events
   * Guarantees donation is completed even if the donor closed their browser before redirecting.
   */
  static async completeDonationFromWebhook({
    donationId,
    sessionId,
    providerPaymentId,
    amount,
    currency,
  }: {
    donationId: string;
    sessionId?: string;
    providerPaymentId?: string;
    amount?: number;
    currency?: string;
  }): Promise<{ alreadyCompleted: boolean; donationId: string }> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const donRes = await client.query(
        `SELECT id, amount, currency, status FROM donations WHERE id = $1 FOR UPDATE`,
        [donationId]
      );

      if (donRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return { alreadyCompleted: false, donationId };
      }

      const donation = donRes.rows[0];
      if (donation.status === "COMPLETED" || donation.status === "PAID") {
        await client.query("COMMIT");
        return { alreadyCompleted: true, donationId };
      }

      // Verify amount & currency if available
      if (amount && Math.abs(amount - Number(donation.amount)) > 0.05) {
        console.warn(`[Webhook Donation] Amount discrepancy for ${donationId}`);
      }
      if (currency && currency.toUpperCase() !== donation.currency.toUpperCase()) {
        console.warn(`[Webhook Donation] Currency discrepancy for ${donationId}`);
      }

      await client.query(
        `UPDATE donations
         SET status = 'COMPLETED',
             stripe_session_id = COALESCE($1, stripe_session_id),
             provider_payment_id = COALESCE($2, provider_payment_id),
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [sessionId || null, providerPaymentId || `tx_${Date.now()}`, donationId]
      );

      await client.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
         VALUES ('DONATION_COMPLETED', 'donation', $1, $2)`,
        [
          donationId,
          JSON.stringify({
            providerPaymentId,
            sessionId,
            verifiedVia: "stripe_webhook",
          }),
        ]
      );

      await client.query("COMMIT");
      return { alreadyCompleted: false, donationId };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
