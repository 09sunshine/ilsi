import crypto from "crypto";
import { env } from "../../config/env.js";
import {
  PaymentProvider,
  CreateCheckoutParams,
  CheckoutSessionResult,
  PaymentVerificationResult,
  WebhookResult,
} from "./PaymentProvider.js";

export class PaymPaymentProvider implements PaymentProvider {
  name = "PAYM";

  private getBaseUrl(): string {
    const raw = process.env.PAYM_BASE_URL || env.PAYM_BASE_URL || "https://plopplop.solutionip.app/";
    return raw.replace(/\/+$/, "");
  }

  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.PAYM_CLIENT_ID || env.PAYM_CLIENT_ID;
    const clientSecret = process.env.PAYM_CLIENT_SECRET || env.PAYM_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Pay'm credentials (PAYM_CLIENT_ID and PAYM_CLIENT_SECRET) are not configured.");
    }
    return { clientId, clientSecret };
  }

  private static cachedRates: { usdToHtg: number; eurToHtg: number; lastUpdated: number } | null = null;
  public static readonly CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours TTL

  /**
   * Fetches live market exchange rate from open.er-api.com with 12-hour in-memory caching and fallback.
   * Eliminates hardcoded drift while ensuring 0ms overhead on cached lookups.
   */
  static async getLiveExchangeRates(): Promise<{ usdToHtg: number; eurToHtg: number }> {
    const now = Date.now();
    if (this.cachedRates && now - this.cachedRates.lastUpdated < this.CACHE_TTL_MS) {
      return {
        usdToHtg: this.cachedRates.usdToHtg,
        eurToHtg: this.cachedRates.eurToHtg,
      };
    }

    const fallbackUsd = Number(process.env.PAYM_USD_TO_HTG_RATE || env.PAYM_USD_TO_HTG_RATE || 132.0);
    const fallbackEur = Math.round(fallbackUsd * 1.08 * 100) / 100;

    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data: any = await res.json();
        const liveHtg = Number(data?.rates?.HTG);
        const liveEur = Number(data?.rates?.EUR);

        // Sanity check: Ensure HTG rate is within realistic market bounds
        if (liveHtg > 50 && liveHtg < 500) {
          const usdToHtg = Math.round(liveHtg * 100) / 100;
          const eurToHtg =
            liveEur > 0 ? Math.round((liveHtg / liveEur) * 100) / 100 : Math.round(usdToHtg * 1.08 * 100) / 100;

          this.cachedRates = {
            usdToHtg,
            eurToHtg,
            lastUpdated: now,
          };

          return { usdToHtg, eurToHtg };
        }
      }
    } catch (err: any) {
      console.warn("[Pay'm] Live exchange rate API unavailable, falling back to configured rate:", err?.message || err);
    }

    return {
      usdToHtg: fallbackUsd,
      eurToHtg: fallbackEur,
    };
  }

  /**
   * Resets rate cache (used for unit testing or forced re-fetch).
   */
  static resetRateCache(): void {
    this.cachedRates = null;
  }

  /**
   * Calculates the exact transaction amount in HTG conforming to the documented Pay'm requirements:
   * - Minimum transaction amount: 20 HTG
   * - Auditable conversion from USD/EUR using live rate or configured fallback
   */
  calculateHtgAmount(
    amount: number,
    currency: string = "USD",
    overrideRate?: number
  ): { htgAmount: number; exchangeRate: number; isConverted: boolean } {
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error("Payment amount must be strictly positive and greater than 0.");
    }

    const upperCurrency = currency.toUpperCase();
    if (upperCurrency === "HTG") {
      const htg = Math.round(amount * 100) / 100;
      if (htg < 20) {
        throw new Error("Minimum transaction amount for Pay'm is 20 HTG.");
      }
      return { htgAmount: htg, exchangeRate: 1.0, isConverted: false };
    }

    let rate = overrideRate;
    if (!rate) {
      const fallbackRate = Number(process.env.PAYM_USD_TO_HTG_RATE || env.PAYM_USD_TO_HTG_RATE || 132.0);
      if (
        PaymPaymentProvider.cachedRates &&
        Date.now() - PaymPaymentProvider.cachedRates.lastUpdated < PaymPaymentProvider.CACHE_TTL_MS
      ) {
        rate =
          upperCurrency === "EUR"
            ? PaymPaymentProvider.cachedRates.eurToHtg
            : PaymPaymentProvider.cachedRates.usdToHtg;
      } else {
        rate = upperCurrency === "EUR" ? Math.round(fallbackRate * 1.08 * 100) / 100 : fallbackRate;
      }
    }

    const calculatedHtg = Math.round(amount * rate);

    if (calculatedHtg < 20) {
      throw new Error("Calculated Pay'm amount is below the mandatory minimum of 20 HTG.");
    }

    return {
      htgAmount: calculatedHtg,
      exchangeRate: rate,
      isConverted: true,
    };
  }

  /**
   * Generates a collision-resistant merchant reference for Pay'm
   */
  generateMerchantReference(paymentId: string): string {
    const cleanId = paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const entropy = crypto.randomBytes(4).toString("hex");
    return `ilsi_${Date.now()}_${cleanId}_${entropy}`;
  }

  /**
   * Initiates a merchant payment with Pay'm: POST /api/paiement-marchand
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const { clientId } = this.getCredentials();
    const baseUrl = this.getBaseUrl();

    // Generate unique reference_id (documented as "refference_id")
    const merchantReference =
      params.metadata?.merchantReference || this.generateMerchantReference(params.paymentId);

    // Selected payment method: moncash, moncash_ussd, kashpaw, natcash, natcash_ussd, carte, all
    const paymentMethod = params.metadata?.paymentMethod || "all";
    const phoneNumber = params.metadata?.phoneNumber;

    // Retrieve live market exchange rates (cached for 12 hours)
    const rates = await PaymPaymentProvider.getLiveExchangeRates();
    const effectiveRate = params.currency.toUpperCase() === "EUR" ? rates.eurToHtg : rates.usdToHtg;

    // Calculate HTG amount according to documented API rules
    const { htgAmount, exchangeRate, isConverted } = this.calculateHtgAmount(
      params.amount,
      params.currency,
      effectiveRate
    );

    const requestBody: Record<string, any> = {
      client_id: clientId,
      refference_id: merchantReference, // Exact documented parameter spelling
      montant: htgAmount,
      payment_method: paymentMethod,
    };

    if (phoneNumber && (paymentMethod === "moncash_ussd" || paymentMethod === "natcash_ussd")) {
      requestBody.phone_number = phoneNumber;
    }

    const res = await fetch(`${baseUrl}/api/paiement-marchand`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Pay'm Merchant Payment creation failed: ${res.status} ${errText}`);
    }

    const data = (await res.json()) as {
      status: boolean | string;
      message: string;
      url?: string | null;
      transaction_id?: string;
    };

    const isSuccess = data.status === true || String(data.status).toLowerCase() === "true";
    if (!isSuccess && !data.transaction_id) {
      throw new Error(`Pay'm returned error: ${data.message || "Failed to create transaction"}`);
    }

    // Attach conversion metadata to session result if applicable
    const checkoutUrl = data.url || "";

    return {
      sessionId: data.transaction_id || merchantReference,
      checkoutUrl,
    };
  }

  /**
   * Authoritative transaction verification: POST /api/paiement-verify
   * Returns trans_status = "ok" for confirmed transactions.
   */
  async verifyPayment(
    paymentId: string,
    providerPaymentId?: string,
    options?: { expectedAmount?: number; expectedCurrency?: string; merchantReference?: string }
  ): Promise<PaymentVerificationResult> {
    const { clientId, clientSecret } = this.getCredentials();
    const baseUrl = this.getBaseUrl();

    const queryPayload: Record<string, any> = {
      client_id: clientId,
      client_secret: clientSecret,
    };

    if (providerPaymentId) {
      queryPayload.transaction_id = providerPaymentId;
    }
    if (options?.merchantReference) {
      queryPayload.refference_id = options.merchantReference;
    }

    if (!queryPayload.transaction_id && !queryPayload.refference_id) {
      return {
        status: "PENDING",
        providerPaymentId: providerPaymentId || "",
      };
    }

    try {
      const res = await fetch(`${baseUrl}/api/paiement-verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queryPayload),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Pay'm verification request returned HTTP ${res.status}:`, err);
        return {
          status: "PENDING",
          providerPaymentId: providerPaymentId || "",
        };
      }

      const data = (await res.json()) as {
        status: boolean | string;
        message: string;
        montant?: number;
        trans_status?: string; // "ok" or "no"
        transaction_id?: string;
        refference_id?: string;
        provider_transac?: string;
        method?: string;
      };

      // In Pay'm API, data.status: true is merely an API-level indicator that the lookup succeeded.
      // The true payment status is strictly in data.trans_status ("ok" = paid, "no" = pending/awaiting OTP).
      const transStatus = String(data.trans_status || "").toLowerCase().trim();
      const isOk =
        transStatus === "ok" ||
        transStatus === "success" ||
        transStatus === "succes" ||
        transStatus === "completed" ||
        transStatus === "paid";

      const resolvedTxId = data.transaction_id || providerPaymentId || data.refference_id || `paym_${Date.now()}`;

      if (isOk) {
        return {
          status: "PAID",
          providerPaymentId: resolvedTxId,
          paidAt: new Date(),
          amount: data.montant ? Number(data.montant) : undefined,
          currency: "HTG",
          metadata: {
            paymTransactionId: data.transaction_id,
            refferenceId: data.refference_id,
            providerTransac: data.provider_transac,
            paymentMethod: data.method,
            transStatus: data.trans_status,
          },
        };
      }

      if (["failed", "cancelled", "canceled", "error"].includes(transStatus)) {
        return {
          status: "FAILED",
          providerPaymentId: resolvedTxId,
          metadata: {
            transStatus: data.trans_status,
            message: data.message,
          },
        };
      }

      return {
        status: "PENDING",
        providerPaymentId: resolvedTxId,
        metadata: {
          transStatus: data.trans_status || "no",
          message: data.message,
        },
      };
    } catch (err: any) {
      console.warn("Pay'm verification exception:", err.message);
      return {
        status: "PENDING",
        providerPaymentId: providerPaymentId || "",
      };
    }
  }

  /**
   * Cryptographically validates HMAC-SHA256 signature on raw request body using client_secret
   */
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader) {
      return false;
    }
    const { clientSecret } = this.getCredentials();
    const cleanSig = signatureHeader.replace(/^sha256=/, "").trim();

    const expectedSig = crypto
      .createHmac("sha256", clientSecret)
      .update(rawBody)
      .digest("hex");

    try {
      const a = Buffer.from(cleanSig, "hex");
      const b = Buffer.from(expectedSig, "hex");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Handles incoming Pay'm webhook notification
   */
  async handleWebhook(payload: any, signature?: string, headers?: any): Promise<WebhookResult> {
    const rawBody = (headers?.rawBody || headers?.rawPayload) || JSON.stringify(payload);
    const signatureHeader =
      signature ||
      headers?.["x-webhook-signature"] ||
      headers?.["X-Webhook-Signature"] ||
      headers?.["x-signature"] ||
      headers?.["X-Signature"] ||
      headers?.["signature"];

    // Validate signature
    if (!this.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new Error("Invalid Pay'm webhook signature. Request HMAC validation failed.");
    }

    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    const eventType = String(data.event || "transaction.status_changed").trim();

    // Handle both nested { transaction: { ... } } and flat { transaction_id: ... } payloads
    const transaction =
      data && typeof data.transaction === "object" && data.transaction !== null
        ? data.transaction
        : data;

    const paymentReference =
      transaction?.reference_id ||
      transaction?.refference_id ||
      data?.reference_id ||
      data?.refference_id ||
      data?.order_id ||
      data?.merchant_reference;

    const providerPaymentId =
      transaction?.transaction_id ||
      transaction?.id_transaction ||
      data?.transaction_id ||
      data?.id_transaction;

    const eventId = `paym_evt_${providerPaymentId || Date.now()}_${Date.now()}`;

    // transaction.created is merely session initiation (user opened checkout/OTP screen), NOT payment!
    if (eventType === "transaction.created") {
      return {
        eventId,
        eventType,
        paymentId: paymentReference,
        providerPaymentId,
        status: "PENDING",
        rawPayload: data,
      };
    }

    // Normalize status ("ok", "success", "succes", "paid", "completed")
    // Do NOT include "true" as a paid status because boolean response flags must never authorize payments.
    const rawStatus = String(
      transaction?.trans_status ||
      transaction?.new_status ||
      transaction?.status ||
      data?.trans_status ||
      data?.new_status ||
      data?.status ||
      ""
    ).toLowerCase().trim();

    let status = "PENDING";
    if (
      rawStatus === "ok" ||
      rawStatus === "success" ||
      rawStatus === "succes" ||
      rawStatus === "paid" ||
      rawStatus === "completed"
    ) {
      status = "PAID";
    } else if (
      rawStatus === "failed" ||
      rawStatus === "error" ||
      rawStatus === "cancelled" ||
      rawStatus === "canceled"
    ) {
      status = "FAILED";
    } else {
      status = "PENDING";
    }

    return {
      eventId,
      eventType,
      paymentId: paymentReference,
      providerPaymentId,
      status,
      rawPayload: data,
    };
  }
}
