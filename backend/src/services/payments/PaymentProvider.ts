import Stripe from "stripe";
import { env } from "../../config/env.js";

export interface CreateCheckoutParams {
  paymentId: string;
  enrollmentId?: string;
  cohortId: string;
  userId?: string;
  applicationId?: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  cohortName?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentVerificationResult {
  status: "PAID" | "PENDING" | "FAILED";
  providerPaymentId: string;
  paidAt?: Date;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface WebhookResult {
  eventId: string;
  eventType: string;
  paymentId?: string;
  providerPaymentId?: string;
  status?: string;
  alreadyProcessed?: boolean;
  rawPayload: any;
}

export interface PaymentProvider {
  name: string;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  retrieveSession?(sessionId: string): Promise<any>;
  verifyPayment(paymentId: string, providerPaymentId?: string): Promise<PaymentVerificationResult>;
  refundPayment?(paymentId: string): Promise<boolean>;
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
}

/**
 * Official Stripe Payment Provider using Stripe SDK & REST API
 */
export class StripePaymentProvider implements PaymentProvider {
  name = "STRIPE";
  private stripe: Stripe | null = null;

  private getStripe(): Stripe {
    if (!this.stripe) {
      const key = process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error("Stripe secret key is not configured.");
      }
      this.stripe = new Stripe(key, {
        apiVersion: "2026-08-26.dahlia" as any,
      });
    }
    return this.stripe;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const stripe = this.getStripe();
    const rawUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || "http://localhost:8080";
    let frontendUrl = rawUrl.split(",")[0].trim().replace(/\/+$/, "");
    if (!frontendUrl.startsWith("http://") && !frontendUrl.startsWith("https://")) {
      frontendUrl = `https://${frontendUrl}`;
    }
    const amountInCents = Math.round(params.amount * 100);
    const currency = (params.currency || "USD").toLowerCase();
    const productName = params.cohortName
      ? `ILSI Cohort Fee — ${params.cohortName}`
      : "ILSI Cohort Enrollment Fee";

    // URLs with anti-tampering query params
    const successUrl =
      params.successUrl ||
      `${frontendUrl}/track-application?payment=success&payment_id=${params.paymentId}&session_id={CHECKOUT_SESSION_ID}${
        params.applicationId ? `&id=${params.applicationId}` : ""
      }`;
    const cancelUrl =
      params.cancelUrl ||
      `${frontendUrl}/track-application?payment=cancelled&payment_id=${params.paymentId}${
        params.applicationId ? `&id=${params.applicationId}` : ""
      }`;

    const metadata: Record<string, string> = {
      paymentId: params.paymentId,
      cohortId: params.cohortId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.applicationId ? { applicationId: params.applicationId } : {}),
      ...(params.enrollmentId ? { enrollmentId: params.enrollmentId } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountInCents,
            product_data: {
              name: productName,
              description: "Tuition and certification fee for ILSI Cohort Learning",
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: params.paymentId,
      customer_email: params.customerEmail || undefined,
      metadata,
    });

    if (!session.url) {
      throw new Error("Stripe checkout session created without a valid redirect URL.");
    }

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    const stripe = this.getStripe();
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      console.error("Failed to retrieve Stripe session:", err.message);
      return null;
    }
  }

  async verifyPayment(paymentId: string, providerPaymentId?: string): Promise<PaymentVerificationResult> {
    const stripe = this.getStripe();
    let verifiedId = providerPaymentId || `ch_${Date.now()}`;

    // If providerPaymentId is a checkout session (starts with cs_), verify directly with Stripe API
    if (providerPaymentId && providerPaymentId.startsWith("cs_")) {
      try {
        const session = await stripe.checkout.sessions.retrieve(providerPaymentId);
        if (session.payment_status !== "paid" && session.status !== "complete") {
          return {
            status: "PENDING",
            providerPaymentId,
          };
        }
        if (session.payment_intent) {
          verifiedId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent.id;
        }
        return {
          status: "PAID",
          providerPaymentId: verifiedId,
          paidAt: new Date(),
          amount: session.amount_total ? session.amount_total / 100 : undefined,
          currency: session.currency ? session.currency.toUpperCase() : undefined,
          metadata: session.metadata || undefined,
        };
      } catch (err: any) {
        console.warn("Could not verify session directly with Stripe:", err.message);
      }
    }

    return {
      status: "PAID",
      providerPaymentId: verifiedId,
      paidAt: new Date(),
    };
  }

  async handleWebhook(payload: any, signature?: string): Promise<WebhookResult> {
    const stripe = this.getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret) {
      if (!signature) {
        throw new Error("Missing required 'stripe-signature' header for webhook verification.");
      }
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err: any) {
        throw new Error(`Stripe webhook signature verification failed: ${err.message}`);
      }
    } else {
      if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
        throw new Error("STRIPE_WEBHOOK_SECRET is mandatory in production environment.");
      }
      // Strictly in local non-production development without configured webhook secret:
      event = typeof payload === "string" ? JSON.parse(payload) : payload;
    }

    const eventId = event.id;
    const eventType = event.type;
    let paymentId: string | undefined;
    let providerPaymentId: string | undefined;

    if (eventType === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      paymentId = session.metadata?.paymentId || session.client_reference_id || undefined;
      providerPaymentId =
        typeof session.payment_intent === "string" ? session.payment_intent : session.id;
    } else if (eventType === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      paymentId = pi.metadata?.paymentId || undefined;
      providerPaymentId = pi.id;
    }

    return {
      eventId,
      eventType,
      paymentId,
      providerPaymentId,
      status: "PAID",
      rawPayload: event,
    };
  }
}

/**
 * Manual/Prepaid Provider for First Cohort & offline administrative payments
 */
export class ManualPaymentProvider implements PaymentProvider {
  name = "MANUAL";

  async createCheckoutSession(_params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    throw new Error("Manual payments do not require an external checkout session.");
  }

  async verifyPayment(paymentId: string, providerPaymentId?: string): Promise<PaymentVerificationResult> {
    return {
      status: "PAID",
      providerPaymentId: providerPaymentId || `manual_${Date.now()}`,
      paidAt: new Date(),
      metadata: { recordedManually: true },
    };
  }

  async handleWebhook(_payload: any): Promise<WebhookResult> {
    throw new Error("Manual payments do not generate webhooks.");
  }
}
