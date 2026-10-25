import crypto from "crypto";
import Stripe from "stripe";
import { pool } from "../database/pool.js";
import { env } from "../config/env.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { NotificationService } from "./NotificationService.js";
import { PaymentProviderRegistry } from "./payments/PaymentProvider.js";

export interface CreateDonationCheckoutParams {
  name: string;
  email: string;
  phone?: string;
  amount: number;
  currency?: "USD" | "EUR" | "HTG" | string;
  frequency?: "one-off" | "monthly" | string;
  message?: string;
  provider?: string;
  paymMethod?: string;
}

export interface DonationCheckoutResult {
  donationId: string;
  sessionId: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  frequency: string;
  status: string;
  provider: string;
  internalReference?: string;
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
  provider?: string;
}

export class DonationService {
  private static stripe: Stripe | null = null;

  private static getStripe(): Stripe {
    if (!this.stripe) {
      const rawKey = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY || "";
      const key = rawKey.trim().replace(/^["']|["']$/g, "");
      if (!key) {
        throw new AppError(500, "PROVIDER_ERROR", "Stripe secret key is not configured.");
      }
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  /**
   * Creates a pending donation record and initializes a secure checkout session
   * with the requested active provider (PayPal, Pay'm, or Stripe when enabled).
   *
   * BUSINESS RULE: A donation NEVER grants course or cohort enrollment.
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

    const providerName = (params.provider || "PAYPAL").toUpperCase();

    // Enforce availability: reject disabled payment providers (e.g. Stripe when STRIPE_ENABLED=false)
    if (!PaymentProviderRegistry.isProviderEnabled(providerName)) {
      throw new AppError(
        403,
        "PROVIDER_DISABLED",
        `Payment provider '${providerName}' is currently disabled for donations.`
      );
    }

    const rawCurrency = (params.currency || "USD").toUpperCase();
    const currency = rawCurrency === "EUR" ? "EUR" : rawCurrency === "HTG" ? "HTG" : "USD";
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

    // 1. Generate unique internal reference for donation
    const internalReference = `ilsi_don_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // 2. Insert initial donation record with PENDING status inside database
    const insertRes = await pool.query(
      `INSERT INTO donations (
         name, email, phone, amount, currency, frequency, message, status, provider, internal_reference, metadata
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10)
       RETURNING id, name, email, amount, currency, frequency, status, provider, internal_reference, created_at`,
      [
        name,
        email,
        phone,
        rawAmount,
        currency,
        frequency,
        message,
        providerName,
        internalReference,
        JSON.stringify({
          paymMethod: params.paymMethod || null,
        }),
      ]
    );

    const donation = insertRes.rows[0];
    const rawUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || "http://localhost:8080";
    let frontendUrl = rawUrl.split(",")[0].trim().replace(/\/+$/, "");
    if (!frontendUrl.startsWith("http://") && !frontendUrl.startsWith("https://")) {
      frontendUrl = `https://${frontendUrl}`;
    }

    // 3. Dispatch to appropriate provider
    let sessionId = "";
    let checkoutUrl = "";

    if (providerName === "PAYPAL") {
      const paypalProvider = PaymentProviderRegistry.getProvider("PAYPAL");
      const session = await paypalProvider.createCheckoutSession({
        paymentId: donation.id,
        amount: rawAmount,
        currency,
        customerEmail: email,
        successUrl: `${frontendUrl}/about?donation=return&provider=paypal&donation_id=${donation.id}`,
        cancelUrl: `${frontendUrl}/about?donation=cancelled&provider=paypal&donation_id=${donation.id}`,
        purpose: "donation",
        metadata: {
          type: "DONATION",
          donationId: donation.id,
          internalReference,
        },
      });

      sessionId = session.sessionId;
      checkoutUrl = session.checkoutUrl;

      await pool.query(
        `UPDATE donations SET provider_order_id = $1 WHERE id = $2`,
        [sessionId, donation.id]
      );
    } else if (providerName === "PAYM") {
      const paymProvider = PaymentProviderRegistry.getProvider("PAYM");
      const session = await paymProvider.createCheckoutSession({
        paymentId: donation.id,
        amount: rawAmount,
        currency,
        customerEmail: email,
        successUrl: `${frontendUrl}/about?donation=return&provider=paym&donation_id=${donation.id}&refference_id=${internalReference}`,
        cancelUrl: `${frontendUrl}/about?donation=cancelled&provider=paym&donation_id=${donation.id}`,
        purpose: "donation",
        metadata: {
          merchantReference: internalReference,
          paymentMethod: params.paymMethod || "all",
          type: "DONATION",
          donationId: donation.id,
        },
      });

      sessionId = session.sessionId;
      checkoutUrl = session.checkoutUrl;

      await pool.query(
        `UPDATE donations SET provider_order_id = $1 WHERE id = $2`,
        [sessionId, donation.id]
      );
    } else if (providerName === "STRIPE") {
      // Kept intact when STRIPE_ENABLED is active
      const stripe = this.getStripe();
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

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: frequency === "monthly" ? "subscription" : "payment",
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amountInCents,
              product_data: {
                name: productName,
                description: productDescription,
              },
              ...(frequency === "monthly"
                ? { recurring: { interval: "month" as const } }
                : {}),
            },
            quantity: 1,
          },
        ],
        customer_email: email,
        client_reference_id: donation.id,
        success_url: `${frontendUrl}/about?donation=success&session_id={CHECKOUT_SESSION_ID}&donation_id=${donation.id}`,
        cancel_url: `${frontendUrl}/about?donation=cancelled&donation_id=${donation.id}`,
        ...(frequency === "monthly" ? {} : { submit_type: "donate" as const }),
        metadata: {
          type: "DONATION",
          donationId: donation.id,
          donorName: name,
          donorEmail: email,
          frequency,
          currency,
          amount: String(rawAmount),
          internalReference,
        },
      });

      if (!session.url) {
        throw new AppError(500, "PROVIDER_ERROR", "Stripe session created without redirect URL.");
      }

      sessionId = session.id;
      checkoutUrl = session.url;

      await pool.query(
        `UPDATE donations SET stripe_session_id = $1, provider_order_id = $2 WHERE id = $3`,
        [session.id, session.id, donation.id]
      );
    } else {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unsupported provider: ${providerName}`);
    }

    void NotificationService.notifyAdmins({
      type: "PAYMENT",
      titleEn: `Donation Initiated via ${providerName}`,
      titleFr: `Don initié via ${providerName}`,
      bodyEn: `${name} initiated a donation of ${rawAmount} ${currency} (${frequency}) via ${providerName}.`,
      bodyFr: `${name} a initié un don de ${rawAmount} ${currency} (${frequency}) via ${providerName}.`,
    });

    return {
      donationId: donation.id,
      sessionId,
      checkoutUrl,
      amount: rawAmount,
      currency,
      frequency,
      status: "PENDING",
      provider: providerName,
      internalReference,
    };
  }

  /**
   * Unified authoritative verification for donations (PayPal, Pay'm, Stripe)
   * Enforces that successful donations NEVER enroll user or activate cohort access.
   */
  static async verifyDonationProvider({
    provider,
    donationId,
    orderId,
    referenceId,
    transactionId,
    sessionId,
  }: {
    provider: string;
    donationId?: string;
    orderId?: string;
    referenceId?: string;
    transactionId?: string;
    sessionId?: string;
  }): Promise<DonationVerificationResult> {
    const providerName = (provider || "PAYPAL").toUpperCase();

    // Look up target donation record
    const lookupKey = donationId || referenceId || orderId || transactionId || sessionId;
    if (!lookupKey) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Donation reference is required for verification.");
    }

    const donRes = await pool.query(
      `SELECT id, name, email, phone, amount, currency, frequency, message, status, provider,
              internal_reference, provider_order_id, provider_payment_id, stripe_session_id, paid_at
       FROM donations
       WHERE id::text = $1 
          OR internal_reference = $1 
          OR provider_order_id = $1 
          OR provider_payment_id = $1 
          OR stripe_session_id = $1
       LIMIT 1`,
      [lookupKey]
    );

    if (donRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Donation record not found.");
    }

    const donation = donRes.rows[0];

    // Idempotency: if already completed, return immediately
    if (donation.status === "COMPLETED" || donation.status === "PAID") {
      return {
        status: "COMPLETED",
        donationId: donation.id,
        amount: Number(donation.amount),
        currency: donation.currency,
        frequency: donation.frequency,
        donorName: donation.name,
        donorEmail: donation.email,
        paidAt: donation.paid_at || new Date(),
        provider: donation.provider,
        message: "Donation was already verified successfully.",
      };
    }

    // Provider-specific authoritative check
    let verifiedProviderTx = "";
    let chargedAmount = Number(donation.amount);
    let chargedCurrency = donation.currency;

    if (providerName === "STRIPE") {
      // Use existing Stripe session verification
      const targetSessionId = sessionId || donation.stripe_session_id;
      if (!targetSessionId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Stripe session ID required for Stripe donation.");
      }
      return await this.verifyDonationSession(targetSessionId, donation.id);
    } else if (providerName === "PAYPAL") {
      const paypal = PaymentProviderRegistry.getProvider("PAYPAL");
      const targetOrderId = orderId || donation.provider_order_id;
      if (!targetOrderId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "PayPal order ID required for verification.");
      }

      const verifyRes = await paypal.verifyPayment(donation.id, targetOrderId, {
        expectedAmount: Number(donation.amount),
        expectedCurrency: donation.currency,
      });

      if (verifyRes.status !== "PAID") {
        return {
          status: "PENDING",
          donationId: donation.id,
          amount: Number(donation.amount),
          currency: donation.currency,
          frequency: donation.frequency,
          donorName: donation.name,
          donorEmail: donation.email,
          provider: providerName,
          message: "PayPal payment has not been completed yet.",
        };
      }

      verifiedProviderTx = verifyRes.providerPaymentId || targetOrderId;
      chargedAmount = verifyRes.amount || Number(donation.amount);
      chargedCurrency = verifyRes.currency || donation.currency;
    } else if (providerName === "PAYM") {
      const paym = PaymentProviderRegistry.getProvider("PAYM");
      const targetTx = transactionId || orderId || donation.provider_order_id;
      const verifyRes = await paym.verifyPayment(donation.id, targetTx, {
        merchantReference: referenceId || donation.internal_reference,
      });

      if (verifyRes.status !== "PAID") {
        return {
          status: "PENDING",
          donationId: donation.id,
          amount: Number(donation.amount),
          currency: donation.currency,
          frequency: donation.frequency,
          donorName: donation.name,
          donorEmail: donation.email,
          provider: providerName,
          message: "Pay'm transaction has not confirmed yet.",
        };
      }

      verifiedProviderTx = verifyRes.providerPaymentId || `paym_${Date.now()}`;
    } else {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unsupported provider: ${providerName}`);
    }

    // Atomic DB update to COMPLETED
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Anti-replay check: ensure providerPaymentId is not attributed to another donation
      if (verifiedProviderTx) {
        const replayCheck = await client.query(
          `SELECT id FROM donations WHERE provider_payment_id = $1 AND id != $2`,
          [verifiedProviderTx, donation.id]
        );
        if (replayCheck.rows.length > 0) {
          throw new AppError(409, "REPLAY_DETECTED", "This payment has already been attributed to another transaction.");
        }
      }

      const updateRes = await client.query(
        `UPDATE donations 
         SET status = 'COMPLETED',
             provider_payment_id = $1,
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, amount, currency, frequency, status, paid_at, provider`,
        [verifiedProviderTx || `tx_${Date.now()}`, donation.id]
      );

      const updated = updateRes.rows[0];

      // Audit log entry
      await client.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
         VALUES ('DONATION_COMPLETED', 'donation', $1, $2)`,
        [
          donation.id,
          JSON.stringify({
            amount: updated.amount,
            currency: updated.currency,
            frequency: updated.frequency,
            providerPaymentId: verifiedProviderTx,
            provider: providerName,
            donorEmail: updated.email,
            verifiedVia: "provider_return",
          }),
        ]
      );

      await client.query("COMMIT");

      void NotificationService.notifyAdmins({
        type: "PAYMENT",
        titleEn: `Donation Confirmed via ${providerName}`,
        titleFr: `Don confirmé via ${providerName}`,
        bodyEn: `Received ${updated.amount} ${updated.currency} donation from ${updated.name} via ${providerName}.`,
        bodyFr: `Don de ${updated.amount} ${updated.currency} reçu de ${updated.name} via ${providerName}.`,
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
        provider: providerName,
        message: "Thank you for your generous gift! Your donation has been confirmed.",
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Stripe session direct verification (Preserved for Stripe)
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
        provider: "STRIPE",
        message: "Payment on Stripe has not been confirmed yet.",
      };
    }

    const donationId =
      session.metadata?.donationId || session.client_reference_id || clientDonationId;

    if (!donationId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Cannot resolve donation reference from Stripe session.");
    }

    if (clientDonationId && session.metadata?.donationId && clientDonationId !== session.metadata.donationId) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "Security validation failed: donation ID mismatch.");
    }

    const providerPaymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : typeof session.subscription === "string"
        ? session.subscription
        : session.id;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

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
          provider: "STRIPE",
          message: "Donation was already verified successfully.",
        };
      }

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
        provider: "STRIPE",
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
   * Idempotent Webhook Completion for asynchronous payment events
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
        `SELECT id, amount, currency, status, name FROM donations WHERE id::text = $1 OR internal_reference = $1 FOR UPDATE`,
        [donationId]
      );

      if (donRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return { alreadyCompleted: false, donationId };
      }

      const donation = donRes.rows[0];
      if (donation.status === "COMPLETED" || donation.status === "PAID") {
        await client.query("COMMIT");
        return { alreadyCompleted: true, donationId: donation.id };
      }

      await client.query(
        `UPDATE donations
         SET status = 'COMPLETED',
             stripe_session_id = COALESCE($1, stripe_session_id),
             provider_payment_id = COALESCE($2, provider_payment_id),
             paid_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [sessionId || null, providerPaymentId || `tx_${Date.now()}`, donation.id]
      );

      await client.query(
        `INSERT INTO audit_logs (action, resource_type, resource_id, metadata)
         VALUES ('DONATION_COMPLETED', 'donation', $1, $2)`,
        [
          donation.id,
          JSON.stringify({
            providerPaymentId,
            sessionId,
            verifiedVia: "webhook",
          }),
        ]
      );

      await client.query("COMMIT");
      return { alreadyCompleted: false, donationId: donation.id };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
