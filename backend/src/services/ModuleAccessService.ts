import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { ModuleState } from "../types/domain.js";

export interface AccessEvaluation {
  allowed: boolean;
  state: ModuleState;
  code: string;
  blockingModuleOrder?: number;
  requiredScore?: number;
}

export class ModuleAccessService {
  /**
   * Evaluates whether a student can access a specific module in their cohort.
   * Enforces the hard rule: Calendar dates ALONE never unlock a module.
   */
  static async evaluateAccess(
    userId: string,
    moduleId: string,
    now: Date = new Date()
  ): Promise<AccessEvaluation> {
    // 1. Get module and cohort information
    const moduleRes = await pool.query(
      `SELECT m.id, m.cohort_id, m.order_index, m.start_date, m.end_date, 
              m.required_completion, m.passing_score,
              c.status as cohort_status, c.start_date as cohort_start_date,
              q.id as quiz_id, q.passing_score as quiz_passing_score
       FROM modules m
       JOIN cohorts c ON c.id = m.cohort_id
       LEFT JOIN quizzes q ON q.module_id = m.id
       WHERE m.id = $1`,
      [moduleId]
    );

    if (moduleRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.MODULE_NOT_AVAILABLE, "Module not found");
    }

    const currentModule = moduleRes.rows[0];

    // 2. Verify student enrollment & payment in this cohort
    const enrollRes = await pool.query(
      `SELECT status, payment_status 
       FROM enrollments 
       WHERE user_id = $1 AND cohort_id = $2`,
      [userId, currentModule.cohort_id]
    );

    if (enrollRes.rows.length === 0) {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const enrollment = enrollRes.rows[0];
    if (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.INVALID_ENROLLMENT_STATUS,
      };
    }

    if (enrollment.payment_status !== "PAID" && enrollment.payment_status !== "NOT_REQUIRED") {
      return {
        allowed: false,
        state: "LOCKED",
        code: ErrorCodes.PAYMENT_REQUIRED,
      };
    }

    // 3. If module order > 1, check prerequisite (previous module)
    if (currentModule.order_index > 1) {
      const prevModuleRes = await pool.query(
        `SELECT m.id, m.order_index, m.required_completion, m.passing_score,
                q.id as quiz_id, q.passing_score as quiz_passing_score
         FROM modules m
         LEFT JOIN quizzes q ON q.module_id = m.id
         WHERE m.cohort_id = $1 AND m.order_index = $2`,
        [currentModule.cohort_id, currentModule.order_index - 1]
      );

      if (prevModuleRes.rows.length > 0) {
        const prevModule = prevModuleRes.rows[0];

        // Check previous module lessons completion
        const prevLessonsRes = await pool.query(
          `SELECT l.id, l.mandatory, COALESCE(lp.completed, FALSE) as is_completed
           FROM lessons l
           LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
           WHERE l.module_id = $2`,
          [userId, prevModule.id]
        );

        const totalPrevLessons = prevLessonsRes.rows.length;
        const donePrevLessons = prevLessonsRes.rows.filter((r) => r.is_completed).length;
        const mandatoryPrevDone = prevLessonsRes.rows
          .filter((r) => r.mandatory)
          .every((r) => r.is_completed);

        const prevLessonPercent = totalPrevLessons ? Math.round((donePrevLessons / totalPrevLessons) * 100) : 100;

        if (!mandatoryPrevDone || prevLessonPercent < prevModule.required_completion) {
          return {
            allowed: false,
            state: "LOCKED",
            code: ErrorCodes.PREVIOUS_LESSONS_INCOMPLETE,
            blockingModuleOrder: prevModule.order_index,
            requiredScore: prevModule.passing_score,
          };
        }

        // Check previous module progress
        const prevProgRes = await pool.query(
          `SELECT completed, quiz_passed FROM module_progress WHERE module_id = $1 AND user_id = $2`,
          [prevModule.id, userId]
        );
        const isPrevCompleted = prevProgRes.rows.length > 0 && prevProgRes.rows[0].completed;

        // Check previous module quiz
        if (prevModule.quiz_id && !isPrevCompleted) {
          const prevAttemptRes = await pool.query(
            `SELECT percentage, passed 
             FROM quiz_attempts 
             WHERE quiz_id = $1 AND user_id = $2 
             ORDER BY percentage DESC 
             LIMIT 1`,
            [prevModule.quiz_id, userId]
          );

          if (prevAttemptRes.rows.length === 0) {
            return {
              allowed: false,
              state: "LOCKED",
              code: ErrorCodes.PREVIOUS_QUIZ_MISSING,
              blockingModuleOrder: prevModule.order_index,
              requiredScore: prevModule.quiz_passing_score || prevModule.passing_score,
            };
          }

          const countRes = await pool.query(
            `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2`,
            [prevModule.quiz_id, userId]
          );
          const prevAttemptCount = parseInt(countRes.rows[0].count, 10);
          const maxAttempts = prevModule.attempts_allowed || 3;
          const attemptsExhausted = prevAttemptCount >= maxAttempts;

          const bestPrevAttempt = prevAttemptRes.rows[0];
          if (!bestPrevAttempt.passed && !attemptsExhausted) {
            return {
              allowed: false,
              state: "LOCKED",
              code: ErrorCodes.PREVIOUS_QUIZ_FAILED,
              blockingModuleOrder: prevModule.order_index,
              requiredScore: prevModule.quiz_passing_score || prevModule.passing_score,
            };
          }
        }
      }
    }

    // 4. Current module schedule check
    // If the cohort is active, enrolled and paid students are permitted to access Module 1,
    // and progress to subsequent modules once prerequisites are completed.
    const isCohortActive = currentModule.cohort_status === "ACTIVE";
    const startDate = new Date(currentModule.start_date);
    if (startDate > now && !isCohortActive) {
      return {
        allowed: false,
        state: "UPCOMING",
        code: ErrorCodes.MODULE_NOT_STARTED,
      };
    }

    // 5. Check if current module is already COMPLETED or FAILED
    const currentProgressRes = await pool.query(
      `SELECT completed, quiz_passed 
       FROM module_progress 
       WHERE module_id = $1 AND user_id = $2`,
      [moduleId, userId]
    );

    if (currentProgressRes.rows.length > 0 && currentProgressRes.rows[0].completed) {
      return {
        allowed: true,
        state: "COMPLETED",
        code: "OK",
      };
    }

    // Check latest quiz attempt in current module
    if (currentModule.quiz_id) {
      const currentAttemptRes = await pool.query(
        `SELECT passed 
         FROM quiz_attempts 
         WHERE quiz_id = $1 AND user_id = $2 
         ORDER BY submitted_at DESC 
         LIMIT 1`,
        [currentModule.quiz_id, userId]
      );

      if (currentAttemptRes.rows.length > 0 && !currentAttemptRes.rows[0].passed) {
        return {
          allowed: true,
          state: "FAILED",
          code: "OK",
        };
      }
    }

    // Check expiration
    const endDate = new Date(currentModule.end_date);
    if (endDate < now) {
      return {
        allowed: true,
        state: "EXPIRED",
        code: "OK",
      };
    }

    return {
      allowed: true,
      state: "ACTIVE",
      code: "OK",
    };
  }

  /**
   * Helper that throws an AppError immediately if access is denied.
   */
  static async assertAccess(userId: string, moduleId: string, now: Date = new Date()): Promise<void> {
    const evaluation = await this.evaluateAccess(userId, moduleId, now);
    if (!evaluation.allowed) {
      throw new AppError(
        403,
        evaluation.code,
        `Module access denied: ${evaluation.code}`,
        {
          blockingModuleOrder: evaluation.blockingModuleOrder,
          requiredScore: evaluation.requiredScore,
        }
      );
    }
  }
}
