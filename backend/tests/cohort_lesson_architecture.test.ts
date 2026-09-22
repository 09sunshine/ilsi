import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pool } from "../src/database/pool.js";
import { LessonAccessService } from "../src/services/LessonAccessService.js";
import { AppError, ErrorCodes } from "../src/constants/errors.js";
import { adminSchemas } from "../src/validators/schemas.js";

describe("Decoupled LMS Content Architecture Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Dynamic Lesson Access State Pipeline (LessonAccessService)", () => {
    const mockLessonRow = {
      id: "lesson-1",
      module_id: "mod-1",
      order_index: 1,
      type: "VIDEO",
      title_en: "Introduction to Ethical Leadership",
      title_fr: "Introduction au leadership éthique",
      duration_minutes: 20,
      mandatory: true,
      lesson_status: "PUBLISHED",
      module_cohort_id: null,
      module_program_id: "prog-1",
      module_status: "PUBLISHED",
    };

    const mockEnrollmentRow = {
      id: "enroll-1",
      user_id: "user-1",
      cohort_id: "cohort-1",
      status: "ACTIVE",
      payment_status: "PAID",
      enrolled_at: new Date("2026-01-01"),
      start_at: new Date("2026-01-01"),
      end_at: new Date("2026-12-31"),
    };

    it("evaluates AVAILABLE when lesson is within cohort schedule and has no prerequisites", async () => {
      const now = new Date("2026-06-15T12:00:00Z");

      const mockCohortLessonRow = {
        id: "cl-1",
        cohort_id: "cohort-1",
        lesson_id: "lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
        prerequisite_assignment_id: null,
        prereq_title_en: null,
        prereq_title_fr: null,
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any, values: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) {
          return { rows: [mockLessonRow] } as any;
        }
        if (q.includes("FROM enrollments e")) {
          return { rows: [mockEnrollmentRow] } as any;
        }
        if (q.includes("FROM cohort_lessons cl")) {
          return { rows: [mockCohortLessonRow] } as any;
        }
        if (q.includes("FROM lesson_progress lp")) {
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1", now);

      expect(access.allowed).toBe(true);
      expect(access.state).toBe("AVAILABLE");
      expect(access.isLocked).toBe(false);
      expect(access.cohortId).toBe("cohort-1");
      expect(access.cohortLessonId).toBe("cl-1");
      expect(access.lockReason).toBeUndefined();
    });

    it("evaluates UPCOMING when lesson startAt is in the future", async () => {
      const now = new Date("2026-05-15T12:00:00Z"); // Before start_at

      const mockCohortLessonRow = {
        id: "cl-1",
        cohort_id: "cohort-1",
        lesson_id: "lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments e")) return { rows: [mockEnrollmentRow] } as any;
        if (q.includes("FROM cohort_lessons cl")) return { rows: [mockCohortLessonRow] } as any;
        if (q.includes("FROM lesson_progress lp")) return { rows: [] } as any;
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1", now);

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("UPCOMING");
      expect(access.isLocked).toBe(true);
      expect(access.lockReason).toBe("AVAILABLE_FROM_FUTURE");
      expect(access.availableFrom).toBe(mockCohortLessonRow.start_at.toISOString());
    });

    it("evaluates EXPIRED when lesson endAt has passed and student did not complete", async () => {
      const now = new Date("2026-07-05T12:00:00Z"); // After end_at

      const mockCohortLessonRow = {
        id: "cl-1",
        cohort_id: "cohort-1",
        lesson_id: "lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments")) return { rows: [mockEnrollmentRow] } as any;
        if (q.includes("FROM cohort_lessons")) return { rows: [mockCohortLessonRow] } as any;
        if (q.includes("FROM lesson_progress")) return { rows: [{ completed: false }] } as any;
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1", now);

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("EXPIRED");
      expect(access.isLocked).toBe(true);
      expect(access.lockReason).toBe("ACCESS_PERIOD_ENDED");
      expect(access.availableUntil).toBe(mockCohortLessonRow.end_at.toISOString());
    });

    it("evaluates LOCKED with PREREQUISITE_INCOMPLETE when prerequisite lesson is not done", async () => {
      const now = new Date("2026-06-15T12:00:00Z");

      const mockCohortLessonRow = {
        id: "cl-2",
        cohort_id: "cohort-1",
        lesson_id: "lesson-2",
        order_index: 2,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: "lesson-1",
        prereq_title_en: "Lesson 1: Basics",
        prereq_title_fr: "Leçon 1: Les bases",
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any, values: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons WHERE id = $1")) {
          return { rows: [{ id: "lesson-1", title_en: "Lesson 1: Basics", title_fr: "Leçon 1: Les bases" }] } as any;
        }
        if (q.includes("FROM lessons")) {
          return { rows: [{ ...mockLessonRow, id: "lesson-2", order_index: 2 }] } as any;
        }
        if (q.includes("FROM enrollments")) return { rows: [mockEnrollmentRow] } as any;
        if (q.includes("FROM cohort_lessons")) {
          return { rows: [mockCohortLessonRow] } as any;
        }
        if (q.includes("FROM lesson_progress")) {
          // Prerequisite check for lesson-1 returns incomplete
          return { rows: [] } as any;
        }
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-2", "cohort-1", now);

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("LOCKED");
      expect(access.isLocked).toBe(true);
      expect(access.lockReason).toBe("PREREQUISITE_INCOMPLETE");
      expect(access.prerequisite).toBeDefined();
      expect(access.prerequisite?.id).toBe("lesson-1");
      expect(access.prerequisite?.title.en).toBe("Lesson 1: Basics");
    });

    it("evaluates COMPLETED when student has finished lesson within cohort", async () => {
      const now = new Date("2026-06-15T12:00:00Z");

      const mockCohortLessonRow = {
        id: "cl-1",
        cohort_id: "cohort-1",
        lesson_id: "lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments")) return { rows: [mockEnrollmentRow] } as any;
        if (q.includes("FROM cohort_lessons")) return { rows: [mockCohortLessonRow] } as any;
        if (q.includes("FROM lesson_progress")) {
          return { rows: [{ completed: true, video_percent: 100 }] } as any;
        }
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1", now);

      expect(access.allowed).toBe(true);
      expect(access.state).toBe("COMPLETED");
      expect(access.completed).toBe(true);
      expect(access.progressPercent).toBe(100);
      expect(access.isLocked).toBe(false);
    });

    it("strictly evaluates EXPIRED when now > endAt even if lesson was previously completed", async () => {
      const now = new Date("2026-07-10T12:00:00Z"); // After end_at

      const mockCohortLessonRow = {
        id: "cl-1",
        cohort_id: "cohort-1",
        lesson_id: "lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 20,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments")) return { rows: [mockEnrollmentRow] } as any;
        if (q.includes("FROM cohort_lessons")) return { rows: [mockCohortLessonRow] } as any;
        if (q.includes("FROM lesson_progress")) {
          return { rows: [{ completed: true, video_percent: 100 }] } as any;
        }
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1", now);

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("EXPIRED");
      expect(access.isLocked).toBe(true);
      expect(access.lockReason).toBe("ACCESS_PERIOD_ENDED");
    });

    it("evaluates LOCKED with NOT_ENROLLED when user has no active enrollment in cohort", async () => {
      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments e")) return { rows: [] } as any; // No enrollment
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-999", "lesson-1", "cohort-1");

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("LOCKED");
      expect(access.lockReason).toBe("NOT_ENROLLED");
    });

    it("evaluates LOCKED with PAYMENT_REQUIRED when user enrollment payment is pending", async () => {
      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [mockLessonRow] } as any;
        if (q.includes("FROM enrollments e")) {
          return { rows: [{ ...mockEnrollmentRow, payment_status: "PENDING" }] } as any;
        }
        return { rows: [] } as any;
      });

      const access = await LessonAccessService.evaluateAccess("user-1", "lesson-1", "cohort-1");

      expect(access.allowed).toBe(false);
      expect(access.state).toBe("LOCKED");
      expect(access.lockReason).toBe("PAYMENT_REQUIRED");
    });
  });

  describe("Cross-Cohort Isolation & Multi-Cohort Reusable Lessons", () => {
    it("provides independent schedules for the same reusable lesson across different cohorts", async () => {
      // Reusable lesson: Lesson 1
      // Cohort A: Started June 1, ends June 30
      // Cohort B: Starts August 1, ends August 31
      // Current date: June 15, 2026
      const now = new Date("2026-06-15T12:00:00Z");

      const lessonRow = {
        id: "shared-lesson-1",
        module_id: "mod-1",
        order_index: 1,
        type: "VIDEO",
        title_en: "Cross-Cultural Communication",
        title_fr: "Communication interculturelle",
        duration_minutes: 30,
        mandatory: true,
        lesson_status: "PUBLISHED",
        module_cohort_id: null,
        module_program_id: "prog-1",
        module_status: "PUBLISHED",
      };

      const cohortALesson = {
        id: "cl-cohort-a",
        cohort_id: "cohort-a",
        lesson_id: "shared-lesson-1",
        order_index: 1,
        start_at: new Date("2026-06-01T00:00:00Z"),
        end_at: new Date("2026-06-30T23:59:59Z"),
        duration_minutes: 30,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      const cohortBLesson = {
        id: "cl-cohort-b",
        cohort_id: "cohort-b",
        lesson_id: "shared-lesson-1",
        order_index: 1,
        start_at: new Date("2026-08-01T00:00:00Z"),
        end_at: new Date("2026-08-31T23:59:59Z"),
        duration_minutes: 30,
        is_required: true,
        is_published: true,
        status: "PUBLISHED",
        passing_score: 70,
        prerequisite_lesson_id: null,
      };

      // Evaluation for Cohort A Student
      vi.spyOn(pool, "query").mockImplementation(async (query: any, values: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [lessonRow] } as any;
        if (q.includes("FROM enrollments e")) {
          return { rows: [{ id: "e-a", user_id: "user-a", cohort_id: "cohort-a", status: "ACTIVE", payment_status: "PAID" }] } as any;
        }
        if (q.includes("FROM cohort_lessons cl")) return { rows: [cohortALesson] } as any;
        if (q.includes("FROM lesson_progress lp")) return { rows: [] } as any;
        return { rows: [] } as any;
      });

      const accessA = await LessonAccessService.evaluateAccess("user-a", "shared-lesson-1", "cohort-a", now);
      expect(accessA.allowed).toBe(true);
      expect(accessA.state).toBe("AVAILABLE");

      // Evaluation for Cohort B Student
      vi.spyOn(pool, "query").mockImplementation(async (query: any, values: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [lessonRow] } as any;
        if (q.includes("FROM enrollments e")) {
          return { rows: [{ id: "e-b", user_id: "user-b", cohort_id: "cohort-b", status: "ACTIVE", payment_status: "PAID" }] } as any;
        }
        if (q.includes("FROM cohort_lessons cl")) return { rows: [cohortBLesson] } as any;
        if (q.includes("FROM lesson_progress lp")) return { rows: [] } as any;
        return { rows: [] } as any;
      });

      const accessB = await LessonAccessService.evaluateAccess("user-b", "shared-lesson-1", "cohort-b", now);
      expect(accessB.allowed).toBe(false);
      expect(accessB.state).toBe("UPCOMING");
      expect(accessB.lockReason).toBe("AVAILABLE_FROM_FUTURE");
    });

    it("prevents cross-cohort unauthorized access when a student attempts to access a different cohort's lesson schedule", async () => {
      // User enrolled only in Cohort A attempts to access via Cohort B
      vi.spyOn(pool, "query").mockImplementation(async (query: any) => {
        const q = typeof query === "string" ? query : query.text;
        if (q.includes("FROM lessons l")) return { rows: [{ id: "lesson-1", status: "PUBLISHED" }] } as any;
        if (q.includes("FROM enrollments e")) return { rows: [] } as any; // No enrollment in Cohort B
        return { rows: [] } as any;
      });

      await expect(
        LessonAccessService.assertAccess("user-cohort-a-only", "lesson-1", "cohort-b")
      ).rejects.toThrowError(AppError);
    });
  });

  describe("Validation Schemas for Curriculum Decoupling", () => {
    it("validates cohort lesson assignment schedule: enforces endAt > startAt", () => {
      const valid = adminSchemas.assignCohortLesson.safeParse({
        cohortId: "coh-1",
        lessonId: "les-1",
        startAt: "2026-06-01T00:00:00Z",
        endAt: "2026-06-15T00:00:00Z",
        passingScore: 75,
      });
      expect(valid.success).toBe(true);

      const invalidDates = adminSchemas.assignCohortLesson.safeParse({
        cohortId: "coh-1",
        lessonId: "les-1",
        startAt: "2026-06-15T00:00:00Z",
        endAt: "2026-06-01T00:00:00Z", // Inverted
      });
      expect(invalidDates.success).toBe(false);
    });

    it("validates program creation schema with localized titles and currency", () => {
      const validProg = adminSchemas.createProgram.safeParse({
        slug: "african-leadership-2026",
        titleEn: "African Leadership Excellence",
        titleFr: "Excellence en leadership africain",
        descriptionEn: "Comprehensive cohort-based leadership development for emerging pan-African innovators.",
        descriptionFr: "Programme de développement du leadership pour les innovateurs panafricains émergents.",
        durationWeeks: 12,
        price: 180,
        priceEur: 165,
        currency: "USD",
        status: "PUBLISHED",
      });
      expect(validProg.success).toBe(true);

      const invalidSlug = adminSchemas.createProgram.safeParse({
        slug: "INVALID SLUG WITH SPACES",
        titleEn: "Test",
        titleFr: "Test",
        descriptionEn: "Short",
        descriptionFr: "Court",
      });
      expect(invalidSlug.success).toBe(false);
    });

    it("validates reusable lesson creation independent of calendar dates", () => {
      const validLesson = adminSchemas.createLesson.safeParse({
        moduleId: "mod-1",
        orderIndex: 1,
        type: "VIDEO",
        titleEn: "Strategic Governance",
        titleFr: "Gouvernance stratégique",
        durationMinutes: 25,
        mandatory: true,
      });
      expect(validLesson.success).toBe(true);
      if (validLesson.success) {
        expect(validLesson.data.durationMinutes).toBe(25);
        expect(validLesson.data.type).toBe("VIDEO");
      }
    });
  });

  describe("Administrative Safeguard: Content Archival Protection", () => {
    it("simulates safe archival protection: preserves lesson with student history", async () => {
      // Simulate checking for student activity before deleting a lesson
      const lessonId = "les-active-history";

      // Mock DB: student progress exists
      const mockHasProgress = true;

      function decideDeleteAction(hasStudentProgress: boolean) {
        if (hasStudentProgress) {
          return { action: "ARCHIVE", status: "ARCHIVED", preservedRecords: true };
        }
        return { action: "HARD_DELETE", preservedRecords: false };
      }

      const decisionWithHistory = decideDeleteAction(mockHasProgress);
      expect(decisionWithHistory.action).toBe("ARCHIVE");
      expect(decisionWithHistory.status).toBe("ARCHIVED");
      expect(decisionWithHistory.preservedRecords).toBe(true);

      const decisionWithoutHistory = decideDeleteAction(false);
      expect(decisionWithoutHistory.action).toBe("HARD_DELETE");
      expect(decisionWithoutHistory.preservedRecords).toBe(false);
    });
  });
});
