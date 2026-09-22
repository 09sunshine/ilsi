import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { LessonAccessState, LockReason, Bilingual } from "../types/domain.js";

export interface LessonAccessEvaluation {
  allowed: boolean;
  state: LessonAccessState;
  code: string;
  isLocked: boolean;
  lockReason?: LockReason;
  cohortId?: string;
  cohortLessonId?: string;
  availableFrom?: string;
  availableUntil?: string;
  prerequisite?: {
    id: string;
    title: Bilingual;
  } | null;
  progressPercent?: number;
  completed?: boolean;
}

export class LessonAccessService {
  /**
   * Evaluates dynamic access to a lesson for a specific user and cohort.
   * Access Decision Pipeline:
   * 1. User Authenticated & Active
   * 2. Active Paid Enrollment in Cohort
   * 3. Lesson exists & published
   * 4. Lesson assigned to Cohort via cohort_lessons & published
   * 5. Start date arrived (now >= startAt)
   * 6. Prerequisite lesson completed & passed (if configured or previous in sequence)
   */
  static async evaluateAccess(
    userId: string,
    lessonId: string,
    targetCohortId?: string,
    now: Date = new Date()
  ): Promise<LessonAccessEvaluation> {
    // 1. Fetch lesson information
    const lessonRes = await pool.query(
      `SELECT l.id, l.module_id, l.order_index, l.type, l.title_en, l.title_fr,
              l.duration_minutes, l.mandatory, l.status as lesson_status,
              m.cohort_id as module_cohort_id, m.program_id as module_program_id,
              m.status as module_status
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (lessonRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
    }

    const lesson = lessonRes.rows[0];

    // Unpublished content is never visible to students
    if (lesson.lesson_status === "DRAFT" || lesson.lesson_status === "ARCHIVED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.FORBIDDEN,
        isLocked: true,
        lockReason: "NOT_PUBLISHED",
      };
    }

    // 2. Resolve cohort: targetCohortId OR active enrollment for this lesson's cohort assignment
    let cohortId = targetCohortId;

    if (!cohortId) {
      // Find candidate cohorts that have this lesson assigned and where user is enrolled
      const cohortMatchRes = await pool.query(
        `SELECT cl.cohort_id
         FROM cohort_lessons cl
         JOIN enrollments e ON e.cohort_id = cl.cohort_id
         WHERE cl.lesson_id = $1 AND e.user_id = $2
           AND e.status IN ('ACTIVE', 'COMPLETED')
           AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
         ORDER BY cl.start_at ASC
         LIMIT 1`,
        [lessonId, userId]
      );

      if (cohortMatchRes.rows.length > 0) {
        cohortId = cohortMatchRes.rows[0].cohort_id;
      } else if (lesson.module_cohort_id) {
        // Fallback for legacy cohort-module links
        cohortId = lesson.module_cohort_id;
      }
    }

    if (!cohortId) {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.FORBIDDEN,
        isLocked: true,
        lockReason: "NOT_ENROLLED",
      };
    }

    // 3. Verify user enrollment & payment status in resolved cohort
    const enrollRes = await pool.query(
      `SELECT e.id, e.status, e.payment_status, c.status as cohort_status
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       WHERE e.user_id = $1 AND e.cohort_id = $2`,
      [userId, cohortId]
    );

    if (enrollRes.rows.length === 0) {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.FORBIDDEN,
        isLocked: true,
        lockReason: "NOT_ENROLLED",
      };
    }

    const enrollment = enrollRes.rows[0];
    if (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.INVALID_ENROLLMENT_STATUS,
        isLocked: true,
        lockReason: "COHORT_INACTIVE",
      };
    }

    if (enrollment.payment_status !== "PAID" && enrollment.payment_status !== "NOT_REQUIRED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.PAYMENT_REQUIRED,
        isLocked: true,
        lockReason: "PAYMENT_REQUIRED",
      };
    }

    // 4. Check CohortLesson assignment
    const clRes = await pool.query(
      `SELECT cl.id, cl.cohort_id, cl.lesson_id, cl.order_index, cl.start_at, cl.end_at,
              cl.is_required, cl.is_published, cl.status, cl.passing_score,
              cl.prerequisite_lesson_id, cl.prerequisite_assignment_id
       FROM cohort_lessons cl
       WHERE cl.cohort_id = $1 AND cl.lesson_id = $2`,
      [cohortId, lessonId]
    );

    let cohortLesson = clRes.rows[0];

    // If cohortLesson doesn't exist yet, check if legacy module has start/end dates
    if (!cohortLesson) {
      if (lesson.module_cohort_id === cohortId) {
        // Auto-create cohort lesson assignment from legacy module for seamless compatibility
        const autoClRes = await pool.query(
          `INSERT INTO cohort_lessons (
             cohort_id, lesson_id, order_index, start_at, end_at, duration_minutes,
             is_required, is_published, status, passing_score
           )
           SELECT m.cohort_id, l.id, l.order_index,
                  COALESCE(m.start_date, NOW()),
                  COALESCE(m.end_date, NOW() + INTERVAL '30 days'),
                  l.duration_minutes, l.mandatory, TRUE, 'PUBLISHED', m.passing_score
           FROM lessons l
           JOIN modules m ON m.id = l.module_id
           WHERE l.id = $1 AND m.cohort_id = $2
           ON CONFLICT (cohort_id, lesson_id) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [lessonId, cohortId]
        );
        cohortLesson = autoClRes.rows[0];
      }
    }

    if (!cohortLesson || !cohortLesson.is_published || cohortLesson.status !== "PUBLISHED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.LESSON_NOT_AVAILABLE,
        isLocked: true,
        lockReason: "CONTENT_UNAVAILABLE",
        cohortId,
      };
    }

    const startAt = new Date(cohortLesson.start_at);
    const endAt = new Date(cohortLesson.end_at);

    // 5. Check Prerequisite (if configured or previous assignment in sequence)
    let prereqLessonId = cohortLesson.prerequisite_lesson_id;

    if (!prereqLessonId && cohortLesson.order_index > 1) {
      // Find previous lesson assignment in this cohort
      const prevRes = await pool.query(
        `SELECT cl.lesson_id, l.title_en, l.title_fr
         FROM cohort_lessons cl
         JOIN lessons l ON l.id = cl.lesson_id
         WHERE cl.cohort_id = $1 AND cl.order_index = $2
         LIMIT 1`,
        [cohortId, cohortLesson.order_index - 1]
      );
      if (prevRes.rows.length > 0) {
        prereqLessonId = prevRes.rows[0].lesson_id;
      }
    }

    let prerequisiteInfo: { id: string; title: Bilingual } | null = null;

    if (prereqLessonId) {
      const prereqLessonRes = await pool.query(
        `SELECT id, title_en, title_fr FROM lessons WHERE id = $1`,
        [prereqLessonId]
      );
      if (prereqLessonRes.rows.length > 0) {
        prerequisiteInfo = {
          id: prereqLessonRes.rows[0].id,
          title: {
            en: prereqLessonRes.rows[0].title_en,
            fr: prereqLessonRes.rows[0].title_fr,
          },
        };

        // Check completion of prerequisite lesson in this cohort
        const prereqProgRes = await pool.query(
          `SELECT completed 
           FROM lesson_progress 
           WHERE user_id = $1 AND lesson_id = $2 AND (cohort_id = $3 OR cohort_id IS NULL)
           ORDER BY completed DESC
           LIMIT 1`,
          [userId, prereqLessonId, cohortId]
        );

        const prereqCompleted = prereqProgRes.rows.length > 0 && prereqProgRes.rows[0].completed;

        // Check if prerequisite has a quiz
        const prereqQuizRes = await pool.query(
          `SELECT id, passing_score FROM quizzes WHERE lesson_id = $1 AND published = TRUE`,
          [prereqLessonId]
        );

        let prereqQuizPassed = true;
        if (prereqQuizRes.rows.length > 0) {
          const pQuiz = prereqQuizRes.rows[0];
          const attemptRes = await pool.query(
            `SELECT passed 
             FROM quiz_attempts 
             WHERE quiz_id = $1 AND user_id = $2 AND (cohort_id = $3 OR cohort_id IS NULL)
             ORDER BY passed DESC, percentage DESC
             LIMIT 1`,
            [pQuiz.id, userId, cohortId]
          );
          prereqQuizPassed = attemptRes.rows.length > 0 && attemptRes.rows[0].passed;
        }

        if (!prereqCompleted || !prereqQuizPassed) {
          return {
            allowed: false,
            state: "LOCKED",
            code: ErrorCodes.PREVIOUS_LESSONS_INCOMPLETE,
            isLocked: true,
            lockReason: !prereqQuizPassed ? "PREREQUISITE_FAILED" : "PREREQUISITE_INCOMPLETE",
            cohortId,
            cohortLessonId: cohortLesson.id,
            availableFrom: startAt.toISOString(),
            availableUntil: endAt.toISOString(),
            prerequisite: prerequisiteInfo,
          };
        }
      }
    }

    // 6. Strict Time Window Check (accessible only within startAt <= now <= endAt)
    if (now < startAt) {
      return {
        allowed: false,
        state: "UPCOMING",
        code: ErrorCodes.MODULE_NOT_STARTED,
        isLocked: true,
        lockReason: "AVAILABLE_FROM_FUTURE",
        cohortId,
        cohortLessonId: cohortLesson.id,
        availableFrom: startAt.toISOString(),
        availableUntil: endAt.toISOString(),
        prerequisite: prerequisiteInfo,
      };
    }

    // 7. Check current student progress for this lesson
    const progRes = await pool.query(
      `SELECT completed, video_percent
       FROM lesson_progress
       WHERE user_id = $1 AND lesson_id = $2 AND (cohort_id = $3 OR cohort_id IS NULL)
       ORDER BY completed DESC, video_percent DESC
       LIMIT 1`,
      [userId, lessonId, cohortId]
    );

    const isCompleted = progRes.rows.length > 0 && progRes.rows[0].completed;
    const progressPercent = progRes.rows[0]?.video_percent || 0;

    // Check if lesson deadline passed (Strict: closed once deadline passes)
    if (now > endAt) {
      return {
        allowed: false,
        state: "EXPIRED",
        code: ErrorCodes.MODULE_EXPIRED,
        isLocked: true,
        lockReason: "ACCESS_PERIOD_ENDED",
        cohortId,
        cohortLessonId: cohortLesson.id,
        availableFrom: startAt.toISOString(),
        availableUntil: endAt.toISOString(),
        progressPercent,
        completed: isCompleted,
        prerequisite: prerequisiteInfo,
      };
    }

    if (isCompleted) {
      return {
        allowed: true,
        state: "COMPLETED",
        code: "OK",
        isLocked: false,
        cohortId,
        cohortLessonId: cohortLesson.id,
        availableFrom: startAt.toISOString(),
        availableUntil: endAt.toISOString(),
        progressPercent,
        completed: true,
        prerequisite: prerequisiteInfo,
      };
    }

    // Lesson is currently open and available
    return {
      allowed: true,
      state: progressPercent > 0 ? "IN_PROGRESS" : "AVAILABLE",
      code: "OK",
      isLocked: false,
      cohortId,
      cohortLessonId: cohortLesson.id,
      availableFrom: startAt.toISOString(),
      availableUntil: endAt.toISOString(),
      progressPercent,
      completed: false,
      prerequisite: prerequisiteInfo,
    };
  }

  /**
   * Asserts access to a lesson. Throws AppError with appropriate HTTP status if denied.
   */
  static async assertAccess(
    userId: string,
    lessonId: string,
    targetCohortId?: string,
    now: Date = new Date()
  ): Promise<LessonAccessEvaluation> {
    const evalResult = await this.evaluateAccess(userId, lessonId, targetCohortId, now);
    if (!evalResult.allowed) {
      const message =
        evalResult.lockReason === "AVAILABLE_FROM_FUTURE"
          ? `Lesson is not yet available. It opens on ${evalResult.availableFrom}.`
          : evalResult.lockReason === "ACCESS_PERIOD_ENDED"
          ? `Lesson access period ended on ${evalResult.availableUntil}. This lesson is closed.`
          : evalResult.lockReason === "PREREQUISITE_INCOMPLETE"
          ? `Complete ${evalResult.prerequisite?.title.en || "the prerequisite lesson"} before accessing this content.`
          : evalResult.lockReason === "PAYMENT_REQUIRED"
          ? "Payment is required to access cohort lessons."
          : `Access denied: ${evalResult.code}`;

      throw new AppError(403, evalResult.code, message, {
        state: evalResult.state,
        lockReason: evalResult.lockReason,
        availableFrom: evalResult.availableFrom,
        prerequisite: evalResult.prerequisite,
      });
    }
    return evalResult;
  }
}
