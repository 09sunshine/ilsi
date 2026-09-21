import { describe, it, expect, vi } from "vitest";
import { supportSchemas } from "../src/validators/schemas.js";

describe("Donation Validation & Security Principles", () => {
  it("accepts valid USD one-off donation", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "Jean Dupont",
      email: "jean.dupont@example.com",
      phone: "+33612345678",
      amount: 100,
      currency: "USD",
      frequency: "one-off",
      message: "Keep up the great work!",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(100);
      expect(parsed.data.currency).toBe("USD");
      expect(parsed.data.frequency).toBe("one-off");
    }
  });

  it("accepts valid EUR monthly donation", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "Amara Diallo",
      email: "amara@example.org",
      amount: "50",
      currency: "EUR",
      frequency: "monthly",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(50);
      expect(parsed.data.currency).toBe("EUR");
      expect(parsed.data.frequency).toBe("monthly");
    }
  });

  it("rejects negative or zero donation amounts", () => {
    const zeroResult = supportSchemas.donate.safeParse({
      name: "Test Donor",
      email: "donor@example.com",
      amount: 0,
      currency: "USD",
    });
    expect(zeroResult.success).toBe(false);

    const negativeResult = supportSchemas.donate.safeParse({
      name: "Test Donor",
      email: "donor@example.com",
      amount: -25,
      currency: "USD",
    });
    expect(negativeResult.success).toBe(false);
  });

  it("rejects non-whitelisted currencies to prevent rate/fx tampering", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "Hacker",
      email: "hacker@example.com",
      amount: 100,
      currency: "BTC",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid donor email", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "Jane Doe",
      email: "not-an-email",
      amount: 100,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects names that are too short", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "A",
      email: "valid@example.com",
      amount: 100,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects excessive donation amounts above limit", () => {
    const parsed = supportSchemas.donate.safeParse({
      name: "Large Donor",
      email: "whale@example.com",
      amount: 10_000_000,
    });
    expect(parsed.success).toBe(false);
  });
});
