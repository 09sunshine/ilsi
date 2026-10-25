import { env } from "../../config/env.js";
import {
  PaymentProvider,
  CreateCheckoutParams,
  CheckoutSessionResult,
  PaymentVerificationResult,
  WebhookResult,
} from "./PaymentProvider.js";

interface PayPalTokenCache {
  accessToken: string;
  expiresAt: number;
}

export class PayPalPaymentProvider implements PaymentProvider {
  name = "PAYPAL";
  private tokenCache: PayPalTokenCache | null = null;

  private getBaseUrl(): string {
    const environment = process.env.PAYPAL_ENVIRONMENT || env.PAYPAL_ENVIRONMENT;
    return environment === "live" || environment === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }

  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.PAYPAL_CLIENT_ID || env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET) are not configured.");
    }
    return { clientId, clientSecret };
  }

  /**
   * Securely obtains or returns cached PayPal OAuth 2.0 access token
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.accessToken;
    }

    const { clientId, clientSecret } = this.getCredentials();
    const baseUrl = this.getBaseUrl();
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to obtain PayPal access token: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  /**
   * Creates an approved PayPal order from a server-validated internal payment record
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const accessToken = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const rawUrl = process.env.FRONTEND_URL || env.FRONTEND_URL || "http://localhost:8080";
    let frontendUrl = rawUrl.split(",")[0].trim().replace(/\/+$/, "");
    if (!frontendUrl.startsWith("http://") && !frontendUrl.startsWith("https://")) {
      frontendUrl = `https://${frontendUrl}`;
    }

    const isDonation = params.purpose === "donation" || params.metadata?.type === "DONATION";
    const currency = (params.currency || "USD").toUpperCase();
    const formattedAmount = params.amount.toFixed(2);

    const description = isDonation
      ? "ILSI Scholarship & Leadership Donation"
      : params.cohortName
      ? `ILSI Cohort Fee — ${params.cohortName}`
      : "ILSI Cohort Enrollment Fee";

    const successUrl =
      params.successUrl ||
      (isDonation
        ? `${frontendUrl}/about?donation=return&provider=paypal&payment_id=${params.paymentId}`
        : `${frontendUrl}/track-application?payment=return&provider=paypal&payment_id=${params.paymentId}${
            params.applicationId ? `&id=${params.applicationId}` : ""
          }`);

    const cancelUrl =
      params.cancelUrl ||
      (isDonation
        ? `${frontendUrl}/about?donation=cancelled&provider=paypal&payment_id=${params.paymentId}`
        : `${frontendUrl}/track-application?payment=cancelled&provider=paypal&payment_id=${params.paymentId}${
            params.applicationId ? `&id=${params.applicationId}` : ""
          }`);

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.paymentId,
          custom_id: params.paymentId,
          description: description.substring(0, 127),
          amount: {
            currency_code: currency,
            value: formattedAmount,
          },
        },
      ],
      application_context: {
        brand_name: "ILSI Campus",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        return_url: successUrl,
        cancel_url: cancelUrl,
      },
    };

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal Order Creation failed: ${res.status} ${errText}`);
    }

    const orderData = (await res.json()) as {
      id: string;
      status: string;
      links?: Array<{ href: string; rel: string; method?: string }>;
    };

    const approveLink = orderData.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
    if (!approveLink?.href) {
      throw new Error("PayPal order created without an approval redirect URL.");
    }

    return {
      sessionId: orderData.id,
      checkoutUrl: approveLink.href,
    };
  }

  /**
   * Captures an authorized PayPal order on the server
   */
  async captureOrder(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      // If already captured, attempt to retrieve order details to verify status
      if (res.status === 422) {
        const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        if (orderRes.ok) {
          return await orderRes.json();
        }
      }
      const errText = await res.text();
      throw new Error(`PayPal Capture failed: ${res.status} ${errText}`);
    }

    return await res.json();
  }

  /**
   * Retrieves order status directly from PayPal REST API
   */
  async getOrder(orderId: string): Promise<any> {
    const accessToken = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to retrieve PayPal order: ${res.status} ${err}`);
    }

    return await res.json();
  }

  /**
   * Server-side authoritative verification of payment
   */
  async verifyPayment(
    paymentId: string,
    providerPaymentId?: string,
    options?: { expectedAmount?: number; expectedCurrency?: string }
  ): Promise<PaymentVerificationResult> {
    if (!providerPaymentId) {
      return {
        status: "PENDING",
        providerPaymentId: "",
      };
    }

    try {
      // 1. Try capturing the order or retrieving captured order
      let order = await this.captureOrder(providerPaymentId).catch(async () => {
        return await this.getOrder(providerPaymentId);
      });

      if (!order) {
        return {
          status: "FAILED",
          providerPaymentId,
        };
      }

      // 2. Inspect order status
      const status = order.status;
      if (status !== "COMPLETED") {
        return {
          status: status === "VOIDED" ? "FAILED" : "PENDING",
          providerPaymentId,
        };
      }

      const purchaseUnit = order.purchase_units?.[0];
      const capture = purchaseUnit?.payments?.captures?.[0];
      const capturedAmount = capture?.amount?.value
        ? parseFloat(capture.amount.value)
        : purchaseUnit?.amount?.value
        ? parseFloat(purchaseUnit.amount.value)
        : undefined;

      const capturedCurrency = capture?.amount?.currency_code || purchaseUnit?.amount?.currency_code;
      const captureId = capture?.id || order.id;

      return {
        status: "PAID",
        providerPaymentId: captureId,
        paidAt: new Date(),
        amount: capturedAmount,
        currency: capturedCurrency,
        metadata: {
          paypalOrderId: order.id,
          captureId,
          payerEmail: order.payer?.email_address,
          payerId: order.payer?.payer_id,
        },
      };
    } catch (err: any) {
      console.warn("PayPal verification error:", err.message);
      return {
        status: "PENDING",
        providerPaymentId,
      };
    }
  }

  /**
   * Handles and cryptographically verifies PayPal webhook notifications
   */
  async handleWebhook(payload: any, signature?: string, headers?: any): Promise<WebhookResult> {
    const rawPayload = typeof payload === "string" ? JSON.parse(payload) : payload;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || env.PAYPAL_WEBHOOK_ID;

    // Verify webhook signature with PayPal API if webhook ID is configured
    if (webhookId && headers) {
      try {
        const accessToken = await this.getAccessToken();
        const baseUrl = this.getBaseUrl();

        const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_algo: headers["paypal-auth-algo"],
            cert_url: headers["paypal-cert-url"],
            transmission_id: headers["paypal-transmission-id"],
            transmission_sig: headers["paypal-transmission-sig"],
            transmission_time: headers["paypal-transmission-time"],
            webhook_id: webhookId,
            webhook_event: rawPayload,
          }),
        });

        if (verifyRes.ok) {
          const verifyData = (await verifyRes.json()) as { verification_status: string };
          if (verifyData.verification_status !== "SUCCESS") {
            throw new Error(`PayPal webhook signature rejected: ${verifyData.verification_status}`);
          }
        }
      } catch (err: any) {
        throw new Error(`PayPal webhook cryptographic validation failed: ${err.message}`);
      }
    }

    const eventId = rawPayload.id;
    const eventType = rawPayload.event_type;
    const resource = rawPayload.resource || {};

    let paymentId: string | undefined =
      resource.custom_id || resource.purchase_units?.[0]?.custom_id || resource.reference_id;
    let providerPaymentId: string | undefined = resource.id;

    let status = "PENDING";
    if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
      status = "PAID";
    } else if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "CHECKOUT.ORDER.VOIDED") {
      status = "FAILED";
    }

    return {
      eventId,
      eventType,
      paymentId,
      providerPaymentId,
      status,
      rawPayload,
    };
  }
}
