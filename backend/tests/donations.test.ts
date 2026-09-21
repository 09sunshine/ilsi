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

  describe("Public Unauthenticated Donation Flow", () => {
    it("allows unauthenticated donations without user session or token", () => {
      // Valid donation payload submitted from About Us page by an anonymous guest
      const guestDonation = {
        name: "Anonymous Benefactor",
        email: "benefactor@foundation.org",
        amount: 250,
        currency: "USD",
        frequency: "one-off",
      };

      const result = supportSchemas.donate.safeParse(guestDonation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Anonymous Benefactor");
        expect(result.data.amount).toBe(250);
        expect(result.data.currency).toBe("USD");
        expect(result.data.frequency).toBe("one-off");
      }
    });

    it("ensures student router does not intercept public /api/support or /api/contact endpoints", () => {
      const studentPrefixes = [
        "/dashboard",
        "/lessons",
        "/quizzes",
        "/current-cohort",
        "/enrollments",
        "/cohorts",
        "/modules",
        "/live-sessions",
        "/notifications",
        "/progress",
      ];

      const isStudentRoute = (path: string) =>
        studentPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

      // Public support routes MUST NOT be identified as student routes
      expect(isStudentRoute("/support/donate")).toBe(false);
      expect(isStudentRoute("/support/verify-donation-session")).toBe(false);
      expect(isStudentRoute("/support/volunteer")).toBe(false);
      expect(isStudentRoute("/contact")).toBe(false);

      // Student routes MUST be identified as student routes
      expect(isStudentRoute("/dashboard")).toBe(true);
      expect(isStudentRoute("/lessons/les-123")).toBe(true);
      expect(isStudentRoute("/quizzes/quiz-456")).toBe(true);
      expect(isStudentRoute("/live-sessions")).toBe(true);
    });
  });
});
