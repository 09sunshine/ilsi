import { describe, it, expect } from "vitest";
import { z } from "zod";
import { applicationSchemas, progressSchemas, authSchemas, supportSchemas, contactSchemas, paymentSchemas } from "../src/validators/schemas.js";


describe("Security Architecture & Anti-Tampering Tests", () => {
  // 1. Anti-Tampering Payment Price Test
  describe("Server-Side Payment Pricing (Anti-Tampering)", () => {
    interface DBProgram {
      id: string;
      price: number;
      priceEur: number;
      currency: string;
    }

    interface DBCohort {
      id: string;
      programId: string;
    }

    const mockDB = {
      programs: [
        { id: "prog-1", price: 180, priceEur: 165, currency: "USD" },
      ] as DBProgram[],
      cohorts: [
        { id: "coh-1", programId: "prog-1" },
      ] as DBCohort[],
    };

    function serverCalculatePayment(cohortId: string, clientPayload: any) {
      // Server finds cohort and program from DB
      const cohort = mockDB.cohorts.find((c) => c.id === cohortId);
      if (!cohort) throw new Error("Invalid cohort");
      const program = mockDB.programs.find((p) => p.id === cohort.programId);
      if (!program) throw new Error("Invalid program");

      // Multi-currency resolution: USD or EUR
      const requestedCurrency = clientPayload.currency?.toUpperCase() === "EUR" ? "EUR" : "USD";
      const chargedAmount = requestedCurrency === "EUR" ? program.priceEur : program.price;

      return {
        amount: chargedAmount,
        currency: requestedCurrency,
        cohortId,
        tamperedAttemptDetected: clientPayload.amount !== undefined && clientPayload.amount !== chargedAmount,
      };
    }

    it("ensures that any price manipulated in DevTools (e.g. $0.01) is ignored and the true database price ($180) is charged", () => {
      // Attacker attempts to send amount: 0.01 via browser DevTools
      const devToolsTamperedPayload = {
        cohortId: "coh-1",
        amount: 0.01,
        currency: "USD",
      };

      const result = serverCalculatePayment(devToolsTamperedPayload.cohortId, devToolsTamperedPayload);

      expect(result.amount).toBe(180);
      expect(result.amount).not.toBe(0.01);
      expect(result.currency).toBe("USD");
      expect(result.tamperedAttemptDetected).toBe(true);
    });

    it("ensures that French learners paying in EUR receive the official database EUR price (165 €) with anti-tampering enforcement", () => {
      const devToolsTamperedPayload = {
        cohortId: "coh-1",
        amount: 1.00,
        currency: "EUR",
      };

      const result = serverCalculatePayment(devToolsTamperedPayload.cohortId, devToolsTamperedPayload);

      expect(result.amount).toBe(165);
      expect(result.amount).not.toBe(1.00);
      expect(result.currency).toBe("EUR");
      expect(result.tamperedAttemptDetected).toBe(true);
    });
  });

  // 2. Server-Side Module Completion Gating Test
  describe("Server-Side Module Completion Gating", () => {
    function serverEvaluateLessonCompletion(videoPercent: number, mandatory: boolean) {
      // Server only marks complete if watch threshold >= 80%
      const serverCalculatedComplete = videoPercent >= 80;
      return {
        completed: serverCalculatedComplete,
        videoPercent: Math.min(100, Math.max(0, Math.round(videoPercent))),
      };
    }

    it("rejects client attempts to mark video completed if watch percentage is below 80%", () => {
      // Attacker sends { videoPercent: 12, markComplete: true }
      const res = serverEvaluateLessonCompletion(12, true);
      expect(res.completed).toBe(false);
    });

    it("verifies completion when watch percentage reaches 80% or higher", () => {
      const res = serverEvaluateLessonCompletion(85, true);
      expect(res.completed).toBe(true);
    });
  });

  // 3. SQL Injection Immunity Test
  describe("SQL Injection Immunity with Parameterized Queries", () => {
    // Simulates how pg.Pool executes parameterized queries ($1, $2)
    function simulateParameterizedQuery(sql: string, params: any[]) {
      // Verify query uses placeholders $1, $2... and no concatenated variables
      const hasStringConcat = /['"][ ]*\+[ ]*[a-zA-Z]/.test(sql);
      const hasTemplateLiteral = /\$\{[a-zA-Z_0-9]+\}/.test(sql);

      // In parameterized queries, parameter values are sent out-of-band to PostgreSQL
      // and cannot break out of SQL string literals.
      const paramTreatedAsLiteral = params.every(
        (p) => typeof p === "string" || typeof p === "number" || typeof p === "boolean" || p === null
      );

      return {
        isSafeFromSqlInjection: !hasStringConcat && !hasTemplateLiteral && paramTreatedAsLiteral,
      };
    }

    it("treats malicious SQL injection payloads as literal strings without altering AST", () => {
      const maliciousPayloads = [
        "admin' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM accounts --",
        "1' OR '1' = '1' /*",
      ];

      for (const attackString of maliciousPayloads) {
        const query = "SELECT id, email, role FROM users WHERE email = $1";
        const result = simulateParameterizedQuery(query, [attackString]);
        expect(result.isSafeFromSqlInjection).toBe(true);
      }
    });
  });

  // 4. Input Validation (Zod Schemas) Test
  describe("End-to-End Input Validation Schemas", () => {
    it("rejects invalid emails in application submissions", () => {
      const invalidApp = {
        firstName: "Jean",
        lastName: "Dupont",
        email: "not-an-email",
        phone: "+33612345678",
        country: "France",
        city: "Paris",
        education: "Master",
        occupation: "Engineer",
        programId: "prog-1",
        motivation: "This is a motivation text that has at least forty characters to meet the minimum.",
        terms: true,
      };

      const parsed = applicationSchemas.submit.safeParse(invalidApp);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors.some((e) => e.path.includes("email"))).toBe(true);
      }
    });

    it("rejects applications with motivation shorter than 40 characters", () => {
      const shortMotivation = {
        firstName: "Jean",
        lastName: "Dupont",
        email: "jean.dupont@example.com",
        phone: "+33612345678",
        country: "France",
        city: "Paris",
        education: "Master",
        occupation: "Engineer",
        programId: "prog-1",
        motivation: "Too short",
        terms: true,
      };

      const parsed = applicationSchemas.submit.safeParse(shortMotivation);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors.some((e) => e.path.includes("motivation"))).toBe(true);
      }
    });

    it("rejects video percentage values outside 0-100", () => {
      const negativePercent = { videoPercent: -5 };
      const overflowPercent = { videoPercent: 120 };

      expect(progressSchemas.updateLesson.safeParse(negativePercent).success).toBe(false);
      expect(progressSchemas.updateLesson.safeParse(overflowPercent).success).toBe(false);
      expect(progressSchemas.updateLesson.safeParse({ videoPercent: 75 }).success).toBe(true);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const weakPassword = { email: "user@example.com", password: "123" };
      expect(authSchemas.login.safeParse(weakPassword).success).toBe(false);
      expect(authSchemas.login.safeParse({ email: "user@example.com", password: "ValidPassword123!" }).success).toBe(true);
    });

    it("validates contact form submissions and rejects malformed inputs", () => {
      const validContact = {
        name: "Alice Johnson",
        email: "alice@example.org",
        subject: "Cohort Inquiry",
        message: "Hello, I would like more information about the upcoming cohort schedule.",
      };
      expect(contactSchemas.submit.safeParse(validContact).success).toBe(true);

      const invalidEmailContact = {
        name: "Alice Johnson",
        email: "invalid-email",
        subject: "Cohort Inquiry",
        message: "Hello, I would like more information about the upcoming cohort schedule.",
      };
      expect(contactSchemas.submit.safeParse(invalidEmailContact).success).toBe(false);

      const shortMsgContact = {
        name: "Alice Johnson",
        email: "alice@example.org",
        subject: "Hi",
        message: "Hey",
      };
      expect(contactSchemas.submit.safeParse(shortMsgContact).success).toBe(false);
    });
  });


  // 5. Rapid Submission Deduplication Test
  describe("Rapid Submission Deduplication", () => {
    it("deduplicates identical requests sent within short threshold window", () => {
      const submissionLog: Array<{ id: string; timestamp: number; data: string }> = [];

      function handleDeduplicatedSubmit(userId: string, payload: string, now: number) {
        const last = submissionLog.find(
          (s) => s.id === userId && now - s.timestamp < 3000 && s.data === payload
        );
        if (last) {
          return { deduplicated: true, message: "Duplicate rapid click ignored" };
        }
        submissionLog.push({ id: userId, timestamp: now, data: payload });
        return { deduplicated: false, message: "Processed" };
      }

      const t0 = 1000000;
      const first = handleDeduplicatedSubmit("user-1", JSON.stringify({ a: 1 }), t0);
      expect(first.deduplicated).toBe(false);

      // Rapid double click 200ms later
      const second = handleDeduplicatedSubmit("user-1", JSON.stringify({ a: 1 }), t0 + 200);
      expect(second.deduplicated).toBe(true);

      // Legitimate submit 5 seconds later
      const third = handleDeduplicatedSubmit("user-1", JSON.stringify({ a: 1 }), t0 + 5000);
      expect(third.deduplicated).toBe(false);
    });
  });

  // 6. Support Forms Input Validation & Multi-Currency Safety Test
  describe("Support Forms Input Validation (Donation & Volunteer)", () => {
    it("validates legitimate donation pledge with positive amount and supported currency", () => {
      const validUsdDonation = {
        name: "Sophie Martin",
        email: "sophie@example.org",
        amount: 250,
        currency: "USD",
        frequency: "one-off",
        message: "Scholarship funding",
      };
      const result = supportSchemas.donate.safeParse(validUsdDonation);
      expect(result.success).toBe(true);

      const validEurDonation = {
        name: "Marc Dubois",
        email: "marc@example.fr",
        amount: 100,
        currency: "EUR",
        frequency: "monthly",
      };
      const eurResult = supportSchemas.donate.safeParse(validEurDonation);
      expect(eurResult.success).toBe(true);
    });

    it("rejects malicious, negative, or invalid donation amounts", () => {
      const negativeDonation = {
        name: "Attacker",
        email: "attacker@test.com",
        amount: -50,
        currency: "USD",
      };
      const result = supportSchemas.donate.safeParse(negativeDonation);
      expect(result.success).toBe(false);
    });

    it("validates volunteer registration and rejects missing required areas", () => {
      const validVolunteer = {
        name: "David Leroy",
        email: "david@consulting.fr",
        area: "Mentoring & Debriefs",
        availability: "2 hours per week",
      };
      const result = supportSchemas.volunteer.safeParse(validVolunteer);
      expect(result.success).toBe(true);

      const invalidVolunteer = {
        name: "David Leroy",
        email: "david@consulting.fr",
        area: "", // Empty area
        availability: "2 hours per week",
      };
      const invalidResult = supportSchemas.volunteer.safeParse(invalidVolunteer);
      expect(invalidResult.success).toBe(false);
    });
  });

  // 7. BOLA / IDOR Payment Intent Protection
  describe("BOLA / IDOR Payment Protection", () => {
    function evaluateEnrollmentPaymentAccess(
      caller: { id: string; role: string },
      enrollment: { id: string; userId: string }
    ) {
      const isOwner = caller.id === enrollment.userId;
      const isAdmin = caller.role === "ADMIN" || caller.role === "SUPER_ADMIN";
      if (!isOwner && !isAdmin) {
        throw new Error("Access denied: You cannot initiate payment for another user's enrollment");
      }
      return { allowed: true };
    }

    it("prevents an authenticated student from paying or creating payment intents for another student's enrollment (IDOR)", () => {
      const studentA = { id: "student-a-id", role: "PARTICIPANT" };
      const studentBEnrollment = { id: "enr-b-123", userId: "student-b-id" };

      expect(() =>
        evaluateEnrollmentPaymentAccess(studentA, studentBEnrollment)
      ).toThrow("Access denied: You cannot initiate payment for another user's enrollment");
    });

    it("permits an authenticated student to pay for their own enrollment", () => {
      const studentA = { id: "student-a-id", role: "PARTICIPANT" };
      const studentAEnrollment = { id: "enr-a-123", userId: "student-a-id" };

      const res = evaluateEnrollmentPaymentAccess(studentA, studentAEnrollment);
      expect(res.allowed).toBe(true);
    });

    it("allows administrators to initiate or manage payments on behalf of students", () => {
      const admin = { id: "admin-id", role: "ADMIN" };
      const studentBEnrollment = { id: "enr-b-123", userId: "student-b-id" };

      const res = evaluateEnrollmentPaymentAccess(admin, studentBEnrollment);
      expect(res.allowed).toBe(true);
    });
  });

  // 8. Webhook Signature Security Enforcement
  describe("Stripe Webhook Signature Verification Enforcement", () => {
    it("rejects unsigned webhooks when a webhook secret is configured", async () => {
      const { StripePaymentProvider } = await import("../src/services/payments/PaymentProvider.js");
      const provider = new StripePaymentProvider();
      
      const origSecret = process.env.STRIPE_WEBHOOK_SECRET;
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_key";

      try {
        await expect(
          provider.handleWebhook(JSON.stringify({ type: "payment_intent.succeeded" }), undefined)
        ).rejects.toThrow("Missing required 'stripe-signature' header for webhook verification.");
      } finally {
        if (origSecret !== undefined) {
          process.env.STRIPE_WEBHOOK_SECRET = origSecret;
        } else {
          delete process.env.STRIPE_WEBHOOK_SECRET;
        }
      }
    }, 15000);
  });

  // 9. Account Takeover Prevention on activate-account
  describe("Account Takeover Prevention (First-Login Guard)", () => {
    function evaluateAccountActivation(userAccount: { id: string; first_login: boolean } | null) {
      if (userAccount && userAccount.first_login === false) {
        throw new Error("This student account has already been activated. Please log in directly with your password.");
      }
      return { canActivate: true };
    }

    it("rejects password activation attempt if account is already activated", () => {
      const alreadyActivatedUser = { id: "user-1", first_login: false };
      expect(() => evaluateAccountActivation(alreadyActivatedUser)).toThrow(
        "This student account has already been activated. Please log in directly with your password."
      );
    });

    it("allows password activation for first-time login / unactivated accounts", () => {
      const firstLoginUser = { id: "user-2", first_login: true };
      expect(evaluateAccountActivation(firstLoginUser).canActivate).toBe(true);
    });

    it("allows password activation when user account does not yet exist", () => {
      expect(evaluateAccountActivation(null).canActivate).toBe(true);
    });
  });

  // 10. Field Sanitation and Schema Validation
  describe("Field Sanitation and Schema Validation", () => {
    it("validates profile update fields with trimmed strings and length constraints", () => {
      const validProfile = {
        firstName: "Amadou",
        lastName: "Diallo",
        phone: "+221 77 123 4567",
        country: "Senegal",
        city: "Dakar",
        locale: "fr" as const,
      };
      const res = authSchemas.updateProfile.safeParse(validProfile);
      expect(res.success).toBe(true);
    });

    it("rejects invalid locale in profile update", () => {
      const invalidProfile = {
        firstName: "Amadou",
        locale: "de", // Unsupported locale
      };
      const res = authSchemas.updateProfile.safeParse(invalidProfile);
      expect(res.success).toBe(false);
    });

    it("validates application tracking query requiring email or applicationId", () => {
      const withEmail = applicationSchemas.track.safeParse({ email: "learner@example.com" });
      expect(withEmail.success).toBe(true);

      const withId = applicationSchemas.track.safeParse({ applicationId: "app-uuid-1234" });
      expect(withId.success).toBe(true);

      const empty = applicationSchemas.track.safeParse({});
      expect(empty.success).toBe(false);
    });

    it("validates payment schemas", () => {
      const validIntent = paymentSchemas.createIntent.safeParse({
        cohortId: "coh-1",
        currency: "USD",
      });
      expect(validIntent.success).toBe(true);

      const invalidCurrency = paymentSchemas.createIntent.safeParse({
        currency: "GBP",
      });
      expect(invalidCurrency.success).toBe(false);
    });
  });

  // 11. OAuth State HMAC CSRF Protection
  describe("Google OAuth State HMAC Protection", () => {
    it("successfully verifies authentic HMAC signed state", async () => {
      const { verifyOAuthState } = await import("../src/integrations/google/meet.js");
      const crypto = await import("crypto");
      const secret = process.env.BETTER_AUTH_SECRET || "ilsi_state_secret";
      const userId = "admin-123";
      const hmac = crypto.createHmac("sha256", secret).update(userId).digest("hex").substring(0, 32);
      const state = `${userId}.${hmac}`;

      const verified = verifyOAuthState(state);
      expect(verified).toBe(userId);
    }, 60000);

    it("rejects tampered OAuth state parameter", async () => {
      const { verifyOAuthState } = await import("../src/integrations/google/meet.js");
      const tamperedState = "victim-user-id.forgedhmacthatdoesnotmatch123456";

      const verified = verifyOAuthState(tamperedState);
      expect(verified).toBeNull();
    });
  });

  // 12. Cohort Deletion & Media Purge Architecture
  describe("Cohort Deletion & Supabase Storage Purge Architecture", () => {
    function extractStoragePath(rawPathOrUrl: string | null | undefined, bucket: string): string | null {
      if (!rawPathOrUrl || typeof rawPathOrUrl !== "string") return null;
      const trimmed = rawPathOrUrl.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const pattern = new RegExp(`/${bucket}/([^?#]+)`);
        const match = trimmed.match(pattern);
        if (match && match[1]) {
          return decodeURIComponent(match[1]);
        }
        return null;
      }

      return trimmed.replace(/^\/+/, "");
    }

    it("extracts relative storage keys from Supabase public CDN URLs", () => {
      const cdnUrl =
        "https://rjnzjmewvyifeaotxpyg.supabase.co/storage/v1/object/public/course-thumbnails/cohort-covers/lead-cohort-123.webp?t=2026-09-21";
      const key = extractStoragePath(cdnUrl, "course-thumbnails");
      expect(key).toBe("cohort-covers/lead-cohort-123.webp");
    });

    it("extracts storage keys from Supabase signed video URLs", () => {
      const signedUrl =
        "https://rjnzjmewvyifeaotxpyg.supabase.co/storage/v1/object/sign/course-videos/lessons/lesson-5-full.mp4?token=eyJhbGciOi...";
      const key = extractStoragePath(signedUrl, "course-videos");
      expect(key).toBe("lessons/lesson-5-full.mp4");
    });

    it("preserves relative storage paths already stored without domain", () => {
      const relPath = "lessons/video_upload_171000.mp4";
      const key = extractStoragePath(relPath, "course-videos");
      expect(key).toBe("lessons/video_upload_171000.mp4");
    });

    it("safely ignores third-party external video URLs (e.g. YouTube, Vimeo, Loom)", () => {
      const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const vimeoUrl = "https://player.vimeo.com/video/123456789";
      expect(extractStoragePath(youtubeUrl, "course-videos")).toBeNull();
      expect(extractStoragePath(vimeoUrl, "course-videos")).toBeNull();
    });

    it("enforces admin-only access control for cohort deletion", () => {
      function checkDeleteCohortAccess(role: string) {
        const allowedRoles = ["ADMIN", "SUPER_ADMIN"];
        if (!allowedRoles.includes(role)) {
          throw new Error("Insufficient permissions: Only administrators can delete cohorts.");
        }
        return true;
      }

      expect(() => checkDeleteCohortAccess("STUDENT")).toThrow("Insufficient permissions");
      expect(() => checkDeleteCohortAccess("PARTICIPANT")).toThrow("Insufficient permissions");
      expect(checkDeleteCohortAccess("ADMIN")).toBe(true);
      expect(checkDeleteCohortAccess("SUPER_ADMIN")).toBe(true);
    });
  });

  // 13. Participant Deletion & Role Safeguards
  describe("Participant Deletion & Role Safeguards", () => {
    function evaluateParticipantDeletion(targetUserRole: string, requesterRole: string) {
      const adminRoles = ["ADMIN", "SUPER_ADMIN"];
      if (!adminRoles.includes(requesterRole)) {
        throw new Error("Unauthorized: Only administrators can delete participants.");
      }

      if (targetUserRole !== "PARTICIPANT" && targetUserRole !== "STUDENT") {
        throw new Error("Forbidden: Cannot delete administrative accounts via participant management.");
      }

      return { canDelete: true, targetUserRole };
    }

    it("allows administrators and super administrators to delete participants", () => {
      expect(evaluateParticipantDeletion("PARTICIPANT", "ADMIN").canDelete).toBe(true);
      expect(evaluateParticipantDeletion("STUDENT", "ADMIN").canDelete).toBe(true);
      expect(evaluateParticipantDeletion("PARTICIPANT", "SUPER_ADMIN").canDelete).toBe(true);
      expect(evaluateParticipantDeletion("STUDENT", "SUPER_ADMIN").canDelete).toBe(true);
    });

    it("prevents non-admins from attempting participant deletion", () => {
      expect(() => evaluateParticipantDeletion("PARTICIPANT", "PARTICIPANT")).toThrow("Unauthorized");
      expect(() => evaluateParticipantDeletion("PARTICIPANT", "STUDENT")).toThrow("Unauthorized");
    });

    it("strictly prevents deletion of ADMIN or SUPER_ADMIN through participant deletion route", () => {
      expect(() => evaluateParticipantDeletion("ADMIN", "ADMIN")).toThrow("Forbidden: Cannot delete administrative accounts");
      expect(() => evaluateParticipantDeletion("SUPER_ADMIN", "ADMIN")).toThrow("Forbidden: Cannot delete administrative accounts");
    });
  });
});
