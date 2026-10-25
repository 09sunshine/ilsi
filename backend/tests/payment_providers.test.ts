import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import {
  PaymentProviderRegistry,
  PublicPaymentMethod,
} from "../src/services/payments/PaymentProvider.js";
import { PayPalPaymentProvider } from "../src/services/payments/PayPalPaymentProvider.js";
import { PaymPaymentProvider } from "../src/services/payments/PaymPaymentProvider.js";
import { PaymentService } from "../src/services/PaymentService.js";
import { DonationService } from "../src/services/DonationService.js";
import { pool } from "../src/database/pool.js";

describe("Payment Providers Integration & Security Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Provider Registry & Stripe Hiding Mechanism
  // --------------------------------------------------------------------------
  describe("Provider Registry & Stripe Hiding Mechanism", () => {
    it("returns safe list of methods omitting Stripe when STRIPE_ENABLED is false", () => {
      // Force environment flags: PayPal & Pay'm enabled, Stripe disabled
      process.env.PAYPAL_ENABLED = "true";
      process.env.PAYM_ENABLED = "true";
      process.env.STRIPE_ENABLED = "false";

      const methods = PaymentProviderRegistry.getAvailableMethods();
      const ids = methods.map((m) => m.id);

      expect(ids).toContain("paypal");
      expect(ids).toContain("paym");
      expect(ids).not.toContain("stripe");

      // Verify no secrets or sensitive merchant credentials are leaked
      methods.forEach((method) => {
        expect((method as any).secretKey).toBeUndefined();
        expect((method as any).clientSecret).toBeUndefined();
        expect((method as any).webhookSecret).toBeUndefined();
        expect((method as any).apiKey).toBeUndefined();
      });
    });

    it("includes Stripe only when explicitly enabled by server configuration", () => {
      process.env.STRIPE_ENABLED = "true";
      const methodsWithStripe = PaymentProviderRegistry.getAvailableMethods();
      expect(methodsWithStripe.map((m) => m.id)).toContain("stripe");

      // Reset
      process.env.STRIPE_ENABLED = "false";
      const methodsWithoutStripe = PaymentProviderRegistry.getAvailableMethods();
      expect(methodsWithoutStripe.map((m) => m.id)).not.toContain("stripe");
    });

    it("rejects creation of checkout sessions for disabled providers", async () => {
      process.env.STRIPE_ENABLED = "false";

      await expect(
        PaymentService.createPaymentIntent({
          cohortId: "cohort-123",
          provider: "STRIPE",
          amount: 150,
          currency: "USD",
        } as any)
      ).rejects.toThrow(/disabled/i);
    });
  });

  // --------------------------------------------------------------------------
  // 2. PayPal Integration Tests
  // --------------------------------------------------------------------------
  describe("PayPal Provider Service", () => {
    const paypal = new PayPalPaymentProvider();

    it("caches OAuth 2.0 access token until expiration", async () => {
      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          fetchCallCount++;
          return {
            ok: true,
            json: async () => ({
              access_token: "mock_paypal_access_token_123",
              expires_in: 3600,
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }) as any;

      const token1 = await paypal.getAccessToken();
      const token2 = await paypal.getAccessToken();

      expect(token1).toBe("mock_paypal_access_token_123");
      expect(token2).toBe("mock_paypal_access_token_123");
      expect(fetchCallCount).toBe(1); // Second call reused token from cache
    });

    it("creates PayPal checkout order with server-calculated amount and currency", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes("/v1/oauth2/token")) {
          return {
            ok: true,
            json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
          };
        }
        if (url.includes("/v2/checkout/orders")) {
          const body = JSON.parse(opts.body);
          expect(body.intent).toBe("CAPTURE");
          expect(body.purchase_units[0].amount.value).toBe("180.00");
          expect(body.purchase_units[0].amount.currency_code).toBe("USD");
          expect(body.purchase_units[0].custom_id).toBe("pay_test_001");

          return {
            ok: true,
            json: async () => ({
              id: "PAYPAL_ORDER_999",
              status: "CREATED",
              links: [
                { href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL_ORDER_999", rel: "approve" },
              ],
            }),
          };
        }
        return { ok: false, text: async () => "not found" };
      }) as any;

      const session = await paypal.createCheckoutSession({
        paymentId: "pay_test_001",
        amount: 180,
        currency: "USD",
        cohortName: "Leadership Fall 2026",
      });

      expect(session.sessionId).toBe("PAYPAL_ORDER_999");
      expect(session.checkoutUrl).toContain("sandbox.paypal.com/checkoutnow?token=PAYPAL_ORDER_999");
    });

    it("captures approved PayPal order and verifies amount and currency", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return { ok: true, json: async () => ({ access_token: "mock_token", expires_in: 3600 }) };
        }
        if (url.includes("/capture")) {
          return {
            ok: true,
            json: async () => ({
              id: "PAYPAL_ORDER_999",
              status: "COMPLETED",
              purchase_units: [
                {
                  payments: {
                    captures: [
                      {
                        id: "CAPTURE_ID_888",
                        status: "COMPLETED",
                        amount: { currency_code: "USD", value: "180.00" },
                      },
                    ],
                  },
                },
              ],
              payer: { email_address: "student@example.org" },
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const verification = await paypal.verifyPayment("pay_test_001", "PAYPAL_ORDER_999");
      expect(verification.status).toBe("PAID");
      expect(verification.providerPaymentId).toBe("CAPTURE_ID_888");
      expect(verification.amount).toBe(180);
      expect(verification.currency).toBe("USD");
    });

    it("handles pending and failed capture status safely", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v1/oauth2/token")) {
          return { ok: true, json: async () => ({ access_token: "mock_token", expires_in: 3600 }) };
        }
        if (url.includes("/capture")) {
          return {
            ok: true,
            json: async () => ({
              id: "PAYPAL_ORDER_999",
              status: "VOIDED",
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const verification = await paypal.verifyPayment("pay_test_001", "PAYPAL_ORDER_999");
      expect(verification.status).toBe("FAILED");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Pay'm Integration Tests
  // --------------------------------------------------------------------------
  describe("Pay'm Provider Service", () => {
    const paym = new PaymPaymentProvider();

    it("enforces documented minimum 20 HTG requirement", () => {
      // 10 HTG should be rejected
      expect(() => paym.calculateHtgAmount(10, "HTG")).toThrow(/minimum transaction amount.*20 HTG/i);

      // 25 HTG is valid
      const resHtg = paym.calculateHtgAmount(25, "HTG");
      expect(resHtg.htgAmount).toBe(25);
      expect(resHtg.isConverted).toBe(false);

      // USD conversion at rate 132 HTG/USD
      const resUsd = paym.calculateHtgAmount(1.5, "USD");
      expect(resUsd.htgAmount).toBe(198); // 1.5 * 132
      expect(resUsd.isConverted).toBe(true);
    });

    it("initiates transaction with exact documented parameter spelling 'refference_id'", async () => {
      let capturedRequest: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes("/api/paiement-marchand")) {
          capturedRequest = JSON.parse(opts.body);
          return {
            ok: true,
            json: async () => ({
              status: true,
              message: "success",
              url: "https://plopplop.solutionip.app/redirect-paiement/173763124912345",
              transaction_id: "173763124912345",
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const session = await paym.createCheckoutSession({
        paymentId: "pay_test_paym",
        amount: 50,
        currency: "USD",
        metadata: {
          paymentMethod: "moncash",
        },
      });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest.refference_id).toBeDefined(); // Exact documented spelling
      expect(capturedRequest.payment_method).toBe("moncash");
      expect(capturedRequest.montant).toBe(6600); // 50 USD * 132 HTG
      expect(session.sessionId).toBe("173763124912345");
      expect(session.checkoutUrl).toBe("https://plopplop.solutionip.app/redirect-paiement/173763124912345");
    });

    it("verifies transaction with Pay'm backend using trans_status='ok'", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/paiement-verify")) {
          return {
            ok: true,
            json: async () => ({
              status: true,
              message: "success",
              montant: 6600,
              trans_status: "ok",
              transaction_id: "173763124912345",
              refference_id: "CMD-2026001",
              provider_transac: "7123456789",
              method: "moncash",
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const result = await paym.verifyPayment("pay_test_paym", "173763124912345");
      expect(result.status).toBe("PAID");
      expect(result.providerPaymentId).toBe("173763124912345");
      expect(result.metadata?.transStatus).toBe("ok");
      expect(result.metadata?.paymentMethod).toBe("moncash");
    });

    it("marks payment PENDING when Pay'm returns trans_status='no'", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/api/paiement-verify")) {
          return {
            ok: true,
            json: async () => ({
              status: true,
              message: "pending",
              montant: 6600,
              trans_status: "no",
              transaction_id: "173763124912345",
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const result = await paym.verifyPayment("pay_test_paym", "173763124912345");
      expect(result.status).toBe("PENDING");
    });

    it("verifies constant-time HMAC-SHA256 signature for Pay'm webhooks", () => {
      const secret = "test_secret_key_123";
      process.env.PAYM_CLIENT_SECRET = secret;

      const rawBody = JSON.stringify({
        event: "transaction.status_changed",
        transaction: {
          transaction_id: "173763124912345",
          reference_id: "CMD-2026001",
          new_status: "ok",
        },
      });

      const validSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      expect(paym.verifyWebhookSignature(rawBody, `sha256=${validSig}`)).toBe(true);

      const invalidSig = crypto.createHmac("sha256", "wrong_key").update(rawBody).digest("hex");
      expect(paym.verifyWebhookSignature(rawBody, `sha256=${invalidSig}`)).toBe(false);
      expect(paym.verifyWebhookSignature(rawBody, "")).toBe(false);
    });

    it("rejects unauthorized webhook with invalid HMAC signature", async () => {
      process.env.PAYM_CLIENT_SECRET = "test_secret_key_123";
      const payload = { event: "transaction.status_changed" };

      await expect(
        paym.handleWebhook(payload, "sha256=invalid_signature_hex", {
          rawBody: JSON.stringify(payload),
        })
      ).rejects.toThrow(/invalid pay'm webhook signature/i);
    });

    it("dynamically fetches and caches live exchange rates with fallback", async () => {
      PaymPaymentProvider.resetRateCache();

      // Mock open.er-api.com live response
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("open.er-api.com")) {
          return {
            ok: true,
            json: async () => ({
              result: "success",
              rates: {
                HTG: 130.85,
                EUR: 0.89,
              },
            }),
          };
        }
        return { ok: false, text: async () => "err" };
      }) as any;

      const rates = await PaymPaymentProvider.getLiveExchangeRates();
      expect(rates.usdToHtg).toBe(130.85);
      expect(rates.eurToHtg).toBe(147.02); // 130.85 / 0.89

      // Subsequent call should be served from memory cache (fetch not called again)
      const fetchCallsBefore = (global.fetch as any).mock.calls.length;
      const cached = await PaymPaymentProvider.getLiveExchangeRates();
      expect(cached.usdToHtg).toBe(130.85);
      expect((global.fetch as any).mock.calls.length).toBe(fetchCallsBefore);

      // Verify calculation uses live rate
      const converted = paym.calculateHtgAmount(2, "USD", rates.usdToHtg);
      expect(converted.htgAmount).toBe(262); // round(2 * 130.85)
      expect(converted.exchangeRate).toBe(130.85);

      // Verify fallback behavior on network error
      PaymPaymentProvider.resetRateCache();
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
      const fallback = await PaymPaymentProvider.getLiveExchangeRates();
      expect(fallback.usdToHtg).toBe(132.0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Anti-Tampering, Anti-Replay & Idempotency Guarantees
  // --------------------------------------------------------------------------
  describe("Anti-Tampering & Anti-Replay Guarantees", () => {
    it("detects amount tampering if captured amount diverges from server-recorded price", async () => {
      vi.spyOn(pool, "connect").mockImplementation(async () => {
        return {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes("SELECT") && sql.includes("FROM payments")) {
              return {
                rows: [
                  {
                    id: "pay_100",
                    amount: "180.00",
                    currency: "USD",
                    status: "PENDING",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
          release: vi.fn(),
        } as any;
      });

      // Attempt to confirm payment with tampered amount $0.01 instead of $180
      await expect(
        PaymentService.verifyPayment("pay_100", "tx_123", {
          expectedAmount: 0.01,
          expectedCurrency: "USD",
        })
      ).rejects.toThrow(/payment amount mismatch/i);
    });

    it("detects currency tampering if captured currency differs from server-recorded currency", async () => {
      vi.spyOn(pool, "connect").mockImplementation(async () => {
        return {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("SELECT") && sql.includes("FROM payments")) {
              return {
                rows: [
                  {
                    id: "pay_100",
                    amount: "180.00",
                    currency: "USD",
                    status: "PENDING",
                  },
                ],
              };
            }
            return { rows: [] };
          }),
          release: vi.fn(),
        } as any;
      });

      // Attempt to pass EUR when payment was recorded in USD
      await expect(
        PaymentService.verifyPayment("pay_100", "tx_123", {
          expectedAmount: 180,
          expectedCurrency: "EUR",
        })
      ).rejects.toThrow(/payment currency mismatch/i);
    });

    it("processes webhooks idempotently without duplicate side-effects", async () => {
      const processedEvents: string[] = [];

      vi.spyOn(PaymentService, "verifyPayment").mockResolvedValue({
        status: "PAID",
        message: "Payment verified",
      } as any);

      vi.spyOn(pool, "query").mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes("SELECT") && sql.includes("FROM processed_webhook_events")) {
          const eventId = params[0];
          if (processedEvents.includes(eventId)) {
            return { rows: [{ id: "evt_1", created_at: new Date() }] } as any;
          }
          return { rows: [] } as any;
        }
        if (sql.includes("INSERT INTO processed_webhook_events")) {
          processedEvents.push(params[1]);
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      // First webhook delivery
      const res1 = await PaymentService.handleWebhookEvent({
        provider: "PAYPAL",
        eventId: "EVT_DUPLICATE_TEST_1",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        payload: { paymentId: "pay_1" },
      });
      expect(res1.alreadyProcessed).toBe(false);

      // Replayed duplicate webhook delivery
      const res2 = await PaymentService.handleWebhookEvent({
        provider: "PAYPAL",
        eventId: "EVT_DUPLICATE_TEST_1",
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        payload: { paymentId: "pay_1" },
      });
      expect(res2.alreadyProcessed).toBe(true);
      expect(res2.message).toContain("idempotent ignore");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Course vs Donation Strict Isolation
  // --------------------------------------------------------------------------
  describe("Course vs Donation Purpose Isolation", () => {
    it("ensures a successful donation NEVER touches or activates course enrollment", async () => {
      const executedQueries: string[] = [];

      const mockDonationRow = {
        id: "don_999",
        amount: "50.00",
        currency: "USD",
        frequency: "one-off",
        status: "PENDING",
        name: "Kind Donor",
        email: "donor@example.org",
        provider: "PAYPAL",
        provider_order_id: "PAYPAL_ORDER_DONATION",
        internal_reference: "ilsi_don_test_999",
      };

      vi.spyOn(pool, "query").mockImplementation(async (sql: string) => {
        executedQueries.push(sql);
        if (sql.includes("FROM donations")) {
          return { rows: [mockDonationRow] } as any;
        }
        return { rows: [] } as any;
      });

      vi.spyOn(pool, "connect").mockImplementation(async () => {
        return {
          query: vi.fn().mockImplementation(async (sql: string) => {
            executedQueries.push(sql);
            if (sql.includes("WHERE provider_payment_id")) {
              return { rows: [] }; // No other donation has this provider_payment_id
            }
            if (sql.includes("FROM donations")) {
              return { rows: [mockDonationRow] };
            }
            if (sql.includes("UPDATE donations")) {
              return {
                rows: [
                  {
                    ...mockDonationRow,
                    status: "COMPLETED",
                    paid_at: new Date(),
                  },
                ],
              };
            }
            return { rows: [] };
          }),
          release: vi.fn(),
        } as any;
      });

      // Mock PayPal verification to succeed
      const paypalProvider = PaymentProviderRegistry.getProvider("PAYPAL");
      vi.spyOn(paypalProvider, "verifyPayment").mockResolvedValue({
        status: "PAID",
        providerPaymentId: "CAPTURE_DONATION_001",
        amount: 50,
        currency: "USD",
      });

      const result = await DonationService.verifyDonationProvider({
        provider: "PAYPAL",
        donationId: "don_999",
        orderId: "PAYPAL_ORDER_DONATION",
      });

      expect(result.status).toBe("COMPLETED");

      // Verify that NO query touched enrollments, cohorts, lessons, or applications!
      const touchedEnrollment = executedQueries.some((q) =>
        q.toLowerCase().includes("enrollment") ||
        q.toLowerCase().includes("cohort_lesson") ||
        q.toLowerCase().includes("lesson_progress")
      );
      expect(touchedEnrollment).toBe(false);
    });
  });
});
