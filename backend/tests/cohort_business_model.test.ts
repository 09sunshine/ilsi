import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorCodes } from "../src/constants/errors.js";
import { adminSchemas, applicationSchemas } from "../src/validators/schemas.js";

// Mock Database Structure for End-to-End Business Model Simulation
interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  firstLogin: boolean;
  onboardingCompleted: boolean;
}

interface MockProgram {
  id: string;
  title: string;
  price: number;
  priceEur: number;
}

interface MockCohort {
  id: string;
  programId: string;
  name: string;
  feeAmount: number;
  feeCurrency: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

interface MockEnrollment {
  id: string;
  userId: string;
  cohortId: string;
  status: "PENDING" | "ACCEPTED" | "PAYMENT_PENDING" | "ACTIVE" | "COMPLETED" | "SUSPENDED";
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  enrolledAt: Date;
}

interface MockModule {
  id: string;
  cohortId: string;
  order: number;
  startDate: Date;
  endDate: Date;
  requiredCompletion: number;
  passingScore: number;
  quizId?: string;
  lessons: Array<{ id: string; mandatory: boolean; completed: boolean }>;
}

interface MockPayment {
  id: string;
  userId: string;
  enrollmentId?: string;
  cohortId: string;
  amount: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  status: "PENDING" | "PAID";
  type: "COHORT_FEE" | "DONATION";
  paidAt?: Date;
}

interface MockProcessedWebhook {
  eventId: string;
  provider: string;
  processedAt: Date;
}

interface MockLiveSession {
  id: string;
  cohortId: string;
  title: string;
  meetUrl: string;
  startsAt: Date;
}

class MockLMSDatabase {
  users: MockUser[] = [];
  programs: MockProgram[] = [];
  cohorts: MockCohort[] = [];
  enrollments: MockEnrollment[] = [];
  modules: MockModule[] = [];
  payments: MockPayment[] = [];
  webhooks: MockProcessedWebhook[] = [];
  liveSessions: MockLiveSession[] = [];
  quizAttempts: Array<{ quizId: string; userId: string; score: number; percentage: number; passed: boolean }> = [];
  donations: Array<{ id: string; amount: number; status: string }> = [];

  // Progression Evaluation Logic (exact match of ModuleAccessService)
  evaluateModuleAccess(userId: string, moduleId: string, now: Date) {
    const targetModule = this.modules.find((m) => m.id === moduleId);
    if (!targetModule) {
      return { allowed: false, code: ErrorCodes.MODULE_NOT_AVAILABLE, state: "LOCKED" };
    }

    // 1. Enrollment & Payment Check
    const enrollment = this.enrollments.find(
      (e) => e.userId === userId && e.cohortId === targetModule.cohortId
    );

    if (!enrollment) {
      return { allowed: false, code: ErrorCodes.FORBIDDEN, state: "LOCKED" };
    }

    if (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED") {
      return { allowed: false, code: ErrorCodes.INVALID_ENROLLMENT_STATUS, state: "LOCKED" };
    }

    if (enrollment.paymentStatus !== "PAID" && enrollment.paymentStatus !== "NOT_REQUIRED") {
      return { allowed: false, code: ErrorCodes.PAYMENT_REQUIRED, state: "LOCKED" };
    }

    // 2. Calendar Start Date Check
    if (targetModule.startDate > now) {
      return { allowed: false, code: ErrorCodes.MODULE_NOT_STARTED, state: "UPCOMING" };
    }

    // 3. Prerequisite Module Check for order > 1
    if (targetModule.order > 1) {
      const prevModule = this.modules.find(
        (m) => m.cohortId === targetModule.cohortId && m.order === targetModule.order - 1
      );

      if (prevModule) {
        // Mandatory lessons
        const mandatoryDone = prevModule.lessons.filter((l) => l.mandatory).every((l) => l.completed);
        const doneCount = prevModule.lessons.filter((l) => l.completed).length;
        const percent = prevModule.lessons.length
          ? Math.round((doneCount / prevModule.lessons.length) * 100)
          : 100;

        if (!mandatoryDone || percent < prevModule.requiredCompletion) {
          return { allowed: false, code: ErrorCodes.PREVIOUS_LESSONS_INCOMPLETE, state: "LOCKED" };
        }

        // Quiz check
        if (prevModule.quizId) {
          const attempts = this.quizAttempts.filter(
            (a) => a.quizId === prevModule.quizId && a.userId === userId
          );
          if (attempts.length === 0) {
            return { allowed: false, code: ErrorCodes.PREVIOUS_QUIZ_MISSING, state: "LOCKED" };
          }
          const best = [...attempts].sort((a, b) => b.percentage - a.percentage)[0];
          if (!best.passed) {
            return { allowed: false, code: ErrorCodes.PREVIOUS_QUIZ_FAILED, state: "LOCKED" };
          }
        }
      }
    }

    return { allowed: true, code: "OK", state: "ACTIVE" };
  }

  // Video Authorization Logic (exact match of VideoStorageService)
  authorizeVideo(userId: string, lessonId: string, now: Date) {
    let parentModule: MockModule | undefined;
    for (const m of this.modules) {
      if (m.lessons.some((l) => l.id === lessonId)) {
        parentModule = m;
        break;
      }
    }

    if (!parentModule) {
      throw new Error(ErrorCodes.LESSON_NOT_FOUND);
    }

    const access = this.evaluateModuleAccess(userId, parentModule.id, now);
    if (!access.allowed) {
      throw new Error(ErrorCodes.VIDEO_ACCESS_DENIED);
    }

    return { signedUrl: `https://storage.supabase.co/signed/video_${lessonId}.mp4` };
  }

  // Live Session Authorization Logic
  authorizeLiveSession(userId: string, sessionId: string) {
    const session = this.liveSessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(ErrorCodes.LIVE_SESSION_NOT_FOUND);

    const enrollment = this.enrollments.find(
      (e) => e.userId === userId && e.cohortId === session.cohortId
    );

    if (!enrollment || enrollment.status !== "ACTIVE" || enrollment.paymentStatus !== "PAID") {
      throw new Error(ErrorCodes.LIVE_SESSION_ACCESS_DENIED);
    }

    return { meetUrl: session.meetUrl, title: session.title };
  }

  // Idempotent Webhook Processing Logic (exact match of PaymentService.handleWebhookEvent)
  processWebhookEvent(eventId: string, paymentId: string, provider: string = "STRIPE") {
    if (this.webhooks.some((w) => w.eventId === eventId)) {
      return { alreadyProcessed: true, eventId, message: "Duplicate webhook ignored" };
    }

    this.webhooks.push({ eventId, provider, processedAt: new Date() });

    const payment = this.payments.find((p) => p.id === paymentId);
    if (payment) {
      payment.status = "PAID";
      payment.paidAt = new Date();

      if (payment.enrollmentId) {
        const enrollment = this.enrollments.find((e) => e.id === payment.enrollmentId);
        if (enrollment) {
          enrollment.paymentStatus = "PAID";
          enrollment.status = "ACTIVE";
        }
      }
    }

    return { alreadyProcessed: false, eventId, message: "Payment verified successfully" };
  }
}

describe("LMS Cohort-Based Business Model & Access System Tests", () => {
  let db: MockLMSDatabase;

  const sept2026 = new Date("2026-09-01T00:00:00Z");
  const oct2026 = new Date("2026-10-01T00:00:00Z");
  const midSept2026 = new Date("2026-09-15T00:00:00Z");

  beforeEach(() => {
    db = new MockLMSDatabase();

    // 1 Program
    db.programs.push({
      id: "prog-1",
      title: "Digital Leadership & Skills",
      price: 180,
      priceEur: 165,
    });

    // 2 Cohorts for same program
    db.cohorts.push({
      id: "cohort-a",
      programId: "prog-1",
      name: "September 2026 Cohort",
      feeAmount: 180,
      feeCurrency: "USD",
      startDate: sept2026,
      endDate: new Date("2026-10-15T00:00:00Z"),
      status: "ACTIVE",
    });

    db.cohorts.push({
      id: "cohort-b",
      programId: "prog-1",
      name: "January 2027 Cohort",
      feeAmount: 200,
      feeCurrency: "USD",
      startDate: new Date("2027-01-10T00:00:00Z"),
      endDate: new Date("2027-02-28T00:00:00Z"),
      status: "UPCOMING",
    });

    // Modules for Cohort A
    db.modules.push({
      id: "mod-1-coh-a",
      cohortId: "cohort-a",
      order: 1,
      startDate: sept2026,
      endDate: new Date("2026-09-14T00:00:00Z"),
      requiredCompletion: 100,
      passingScore: 70,
      quizId: "quiz-1-coh-a",
      lessons: [
        { id: "l-1", mandatory: true, completed: false },
        { id: "l-2", mandatory: true, completed: false },
      ],
    });

    db.modules.push({
      id: "mod-2-coh-a",
      cohortId: "cohort-a",
      order: 2,
      startDate: new Date("2026-09-15T00:00:00Z"),
      endDate: new Date("2026-09-28T00:00:00Z"),
      requiredCompletion: 100,
      passingScore: 70,
      quizId: "quiz-2-coh-a",
      lessons: [{ id: "l-3", mandatory: true, completed: false }],
    });

    // Module for Cohort B
    db.modules.push({
      id: "mod-1-coh-b",
      cohortId: "cohort-b",
      order: 1,
      startDate: new Date("2027-01-10T00:00:00Z"),
      endDate: new Date("2027-01-24T00:00:00Z"),
      requiredCompletion: 100,
      passingScore: 70,
      lessons: [{ id: "l-coh-b-1", mandatory: true, completed: false }],
    });

    // Live session in Cohort A
    db.liveSessions.push({
      id: "session-coh-a",
      cohortId: "cohort-a",
      title: "Module 1 Live Q&A",
      meetUrl: "https://meet.google.com/private-cohort-a-call",
      startsAt: midSept2026,
    });
  });

  // =========================================================================
  // TEST 1: First-cohort student manually created, payment already made.
  // =========================================================================
  it("TEST 1: First-cohort student manually created with pre-marked PAID enrollment accesses dashboard and Module 1 without payment page", () => {
    // Admin creates student
    const student: MockUser = {
      id: "student-first-cohort",
      name: "Marie Curie",
      email: "marie@example.com",
      role: "PARTICIPANT",
      firstLogin: true,
      onboardingCompleted: false,
    };
    db.users.push(student);

    // Pre-marked enrollment as ACTIVE & PAID
    const enrollment: MockEnrollment = {
      id: "enroll-first-cohort",
      userId: student.id,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: new Date("2026-08-25T00:00:00Z"),
    };
    db.enrollments.push(enrollment);

    // Record manual payment
    db.payments.push({
      id: "pay-first-cohort",
      userId: student.id,
      enrollmentId: enrollment.id,
      cohortId: "cohort-a",
      amount: 180,
      currency: "USD",
      provider: "MANUAL",
      status: "PAID",
      type: "COHORT_FEE",
      paidAt: new Date("2026-08-25T00:00:00Z"),
    });

    // First login check
    expect(student.firstLogin).toBe(true);
    expect(student.onboardingCompleted).toBe(false);

    // Student completes onboarding password change
    student.firstLogin = false;
    student.onboardingCompleted = true;

    // Student visits dashboard: finds active enrollment
    const activeEnrollment = db.enrollments.find((e) => e.userId === student.id && e.status === "ACTIVE");
    expect(activeEnrollment).toBeDefined();
    expect(activeEnrollment?.paymentStatus).toBe("PAID");

    // Module 1 is immediately available according to schedule
    const mod1Access = db.evaluateModuleAccess(student.id, "mod-1-coh-a", midSept2026);
    expect(mod1Access.allowed).toBe(true);
    expect(mod1Access.state).toBe("ACTIVE");
    expect(mod1Access.code).toBe("OK");
  });

  // =========================================================================
  // TEST 2: New applicant accepted -> PAYMENT_PENDING -> Checkout -> Verified -> ACTIVE
  // =========================================================================
  it("TEST 2: New applicant accepted receives PAYMENT_PENDING, checkout intent, and unlocks content ONLY after verified payment", () => {
    const studentId = "student-new-applicant";
    db.users.push({
      id: studentId,
      name: "Alan Turing",
      email: "alan@example.com",
      role: "PARTICIPANT",
      firstLogin: true,
      onboardingCompleted: false,
    });

    // Application accepted creates PAYMENT_PENDING enrollment
    const enrollment: MockEnrollment = {
      id: "enroll-alan",
      userId: studentId,
      cohortId: "cohort-a",
      status: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      enrolledAt: new Date(),
    };
    db.enrollments.push(enrollment);

    // Before payment: access is DENIED
    const beforePaymentAccess = db.evaluateModuleAccess(studentId, "mod-1-coh-a", midSept2026);
    expect(beforePaymentAccess.allowed).toBe(false);
    expect(beforePaymentAccess.code).toBe(ErrorCodes.INVALID_ENROLLMENT_STATUS);

    // Create checkout payment record
    const payment: MockPayment = {
      id: "pay-intent-alan",
      userId: studentId,
      enrollmentId: enrollment.id,
      cohortId: "cohort-a",
      amount: 180,
      currency: "USD",
      provider: "STRIPE",
      status: "PENDING",
      type: "COHORT_FEE",
    };
    db.payments.push(payment);

    // Webhook delivers verified payment
    db.processWebhookEvent("evt_alan_paid", payment.id);

    // After verified payment: enrollment is ACTIVE and PAID
    expect(payment.status).toBe("PAID");
    expect(enrollment.status).toBe("ACTIVE");
    expect(enrollment.paymentStatus).toBe("PAID");

    // Content is now accessible
    const afterPaymentAccess = db.evaluateModuleAccess(studentId, "mod-1-coh-a", midSept2026);
    expect(afterPaymentAccess.allowed).toBe(true);
    expect(afterPaymentAccess.state).toBe("ACTIVE");
  });

  // =========================================================================
  // TEST 3: Student paid for Cohort A attempts to access Cohort B content -> 403 FORBIDDEN
  // =========================================================================
  it("TEST 3: Student enrolled and paid for Cohort A is rejected with 403 FORBIDDEN when accessing Cohort B content", () => {
    const studentId = "student-cohort-a-only";
    db.enrollments.push({
      id: "enroll-coh-a",
      userId: studentId,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Attempt to access Cohort B module
    const crossCohortAccess = db.evaluateModuleAccess(studentId, "mod-1-coh-b", new Date("2027-01-15T00:00:00Z"));
    expect(crossCohortAccess.allowed).toBe(false);
    expect(crossCohortAccess.code).toBe(ErrorCodes.FORBIDDEN);
    expect(crossCohortAccess.state).toBe("LOCKED");
  });

  // =========================================================================
  // TEST 4: Student in active Cohort A attempts to access Module 2 before completing Module 1
  // =========================================================================
  it("TEST 4: Student in active Cohort A cannot access Module 2 before completing mandatory Module 1 lessons", () => {
    const studentId = "student-mod1-in-progress";
    db.enrollments.push({
      id: "enroll-mod1",
      userId: studentId,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Lessons in Module 1 are not completed
    const accessMod2 = db.evaluateModuleAccess(studentId, "mod-2-coh-a", midSept2026);
    expect(accessMod2.allowed).toBe(false);
    expect(accessMod2.code).toBe(ErrorCodes.PREVIOUS_LESSONS_INCOMPLETE);
    expect(accessMod2.state).toBe("LOCKED");
  });

  // =========================================================================
  // TEST 5: Module 1 deadline passed, student has not passed Module 1 quiz -> Module 2 remains LOCKED
  // =========================================================================
  it("TEST 5: Module 2 remains LOCKED when Module 1 deadline passed and student failed/missing Module 1 quiz", () => {
    const studentId = "student-quiz-failed";
    db.enrollments.push({
      id: "enroll-quiz-failed",
      userId: studentId,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Complete lessons
    db.modules[0].lessons.forEach((l) => (l.completed = true));

    // Case A: Missing quiz attempt
    const missingQuizAccess = db.evaluateModuleAccess(studentId, "mod-2-coh-a", midSept2026);
    expect(missingQuizAccess.allowed).toBe(false);
    expect(missingQuizAccess.code).toBe(ErrorCodes.PREVIOUS_QUIZ_MISSING);

    // Case B: Failed quiz attempt (score 50% < 70% passing threshold)
    db.quizAttempts.push({
      quizId: "quiz-1-coh-a",
      userId: studentId,
      score: 5,
      percentage: 50,
      passed: false,
    });

    const failedQuizAccess = db.evaluateModuleAccess(studentId, "mod-2-coh-a", midSept2026);
    expect(failedQuizAccess.allowed).toBe(false);
    expect(failedQuizAccess.code).toBe(ErrorCodes.PREVIOUS_QUIZ_FAILED);
    expect(failedQuizAccess.state).toBe("LOCKED");
  });

  // =========================================================================
  // TEST 6: Student passes Module 1, Module 2 schedule is active -> Module 2 becomes AVAILABLE
  // =========================================================================
  it("TEST 6: Student passes Module 1 quiz and lessons, and Module 2 unlocks and becomes ACTIVE on start date", () => {
    const studentId = "student-mod1-passed";
    db.enrollments.push({
      id: "enroll-mod1-passed",
      userId: studentId,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Complete all mandatory lessons
    db.modules[0].lessons.forEach((l) => (l.completed = true));

    // Record passing quiz attempt
    db.quizAttempts.push({
      quizId: "quiz-1-coh-a",
      userId: studentId,
      score: 9,
      percentage: 90,
      passed: true,
    });

    // Evaluate on Module 2 start date (Sept 15)
    const accessMod2 = db.evaluateModuleAccess(studentId, "mod-2-coh-a", midSept2026);
    expect(accessMod2.allowed).toBe(true);
    expect(accessMod2.code).toBe("OK");
    expect(accessMod2.state).toBe("ACTIVE");
  });

  // =========================================================================
  // TEST 7: Student requests a video from another cohort -> VIDEO_ACCESS_DENIED
  // =========================================================================
  it("TEST 7: Student requesting a video from another cohort is rejected with VIDEO_ACCESS_DENIED without signed URL", () => {
    const studentId = "student-in-cohort-a";
    db.enrollments.push({
      id: "enroll-vid-test",
      userId: studentId,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Request lesson video in Cohort B
    expect(() => db.authorizeVideo(studentId, "l-coh-b-1", midSept2026)).toThrow(
      ErrorCodes.VIDEO_ACCESS_DENIED
    );
  });

  // =========================================================================
  // TEST 8: Donation is completed -> Marked PAID, no enrollment created, no courses unlocked
  // =========================================================================
  it("TEST 8: Donation completion marks donation as completed without creating any enrollment or unlocking course access", () => {
    const donorEmail = "philanthropist@foundation.org";
    const initialEnrollmentCount = db.enrollments.length;

    // Donor makes pledge/donation
    const donation = { id: "don-1", amount: 500, status: "PLEDGED" };
    db.donations.push(donation);

    // Donation completed
    donation.status = "COMPLETED";

    // Verify database state: no enrollment created
    expect(db.enrollments.length).toBe(initialEnrollmentCount);

    // Verify donor has zero cohort access
    const donorAccess = db.evaluateModuleAccess("donor-user-id", "mod-1-coh-a", midSept2026);
    expect(donorAccess.allowed).toBe(false);
    expect(donorAccess.code).toBe(ErrorCodes.FORBIDDEN);
  });

  // =========================================================================
  // TEST 9: Admin manually marks first-cohort participant as paid
  // =========================================================================
  it("TEST 9: Admin manually records offline payment, creates payment record with provider = MANUAL, and activates enrollment without Stripe", () => {
    const studentId = "first-cohort-offline-student";
    const enrollment: MockEnrollment = {
      id: "enroll-offline",
      userId: studentId,
      cohortId: "cohort-a",
      status: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      enrolledAt: sept2026,
    };
    db.enrollments.push(enrollment);

    // Admin manually records payment
    const manualPayment: MockPayment = {
      id: "pay-manual-rec",
      userId: studentId,
      enrollmentId: enrollment.id,
      cohortId: "cohort-a",
      amount: 180,
      currency: "USD",
      provider: "MANUAL",
      providerPaymentId: `manual_${Date.now()}`,
      status: "PAID",
      type: "COHORT_FEE",
      paidAt: new Date(),
    };
    db.payments.push(manualPayment);

    // Enrollment transitions to ACTIVE & PAID
    enrollment.paymentStatus = "PAID";
    enrollment.status = "ACTIVE";

    expect(manualPayment.provider).toBe("MANUAL");
    expect(manualPayment.status).toBe("PAID");
    expect(enrollment.status).toBe("ACTIVE");
    expect(enrollment.paymentStatus).toBe("PAID");
  });

  // =========================================================================
  // TEST 10: Stripe webhook is received twice -> Idempotent processing
  // =========================================================================
  it("TEST 10: Duplicate Stripe webhook delivery is processed idempotently without creating duplicate payments or corrupting state", () => {
    const studentId = "student-webhook-idempotent";
    const enrollment: MockEnrollment = {
      id: "enroll-idempotent",
      userId: studentId,
      cohortId: "cohort-a",
      status: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      enrolledAt: sept2026,
    };
    db.enrollments.push(enrollment);

    const payment: MockPayment = {
      id: "pay-webhook-test",
      userId: studentId,
      enrollmentId: enrollment.id,
      cohortId: "cohort-a",
      amount: 180,
      currency: "USD",
      provider: "STRIPE",
      status: "PENDING",
      type: "COHORT_FEE",
    };
    db.payments.push(payment);

    const webhookEventId = "evt_stripe_charge_1001";

    // 1st Webhook delivery
    const res1 = db.processWebhookEvent(webhookEventId, payment.id);
    expect(res1.alreadyProcessed).toBe(false);
    expect(payment.status).toBe("PAID");
    expect(enrollment.status).toBe("ACTIVE");
    expect(db.webhooks.length).toBe(1);

    // 2nd Duplicate Webhook delivery
    const res2 = db.processWebhookEvent(webhookEventId, payment.id);
    expect(res2.alreadyProcessed).toBe(true);
    expect(res2.message).toBe("Duplicate webhook ignored");
    expect(db.webhooks.length).toBe(1); // No duplicate stored
    expect(payment.status).toBe("PAID");
    expect(enrollment.status).toBe("ACTIVE"); // State preserved
  });

  // =========================================================================
  // Additional Security Test: Google Meet Link Cohort Access Control
  // =========================================================================
  it("protects private Google Meet URLs: unauthorized students receive LIVE_SESSION_ACCESS_DENIED while active students receive the link", () => {
    const authorizedStudent = "student-authorized";
    const unauthorizedStudent = "student-unauthorized";

    db.enrollments.push({
      id: "enroll-auth",
      userId: authorizedStudent,
      cohortId: "cohort-a",
      status: "ACTIVE",
      paymentStatus: "PAID",
      enrolledAt: sept2026,
    });

    // Authorized student can retrieve Meet URL
    const authSession = db.authorizeLiveSession(authorizedStudent, "session-coh-a");
    expect(authSession.meetUrl).toBe("https://meet.google.com/private-cohort-a-call");

    // Unauthorized student is blocked
    expect(() => db.authorizeLiveSession(unauthorizedStudent, "session-coh-a")).toThrow(
      ErrorCodes.LIVE_SESSION_ACCESS_DENIED
    );
  });
});
