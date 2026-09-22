import { pool } from "../database/pool.js";
import { ModuleAccessService } from "./ModuleAccessService.js";
import { LessonAccessService } from "./LessonAccessService.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { NotificationService } from "./NotificationService.js";

export class QuizEngineService {
  /**
   * Retrieves quiz details for a student. Excludes answer keys from output.
   */
  static async getQuizForStudent(quizId: string, userId: string, isAdmin: boolean = false, targetCohortId?: string) {
    const quizRes = await pool.query(
      `SELECT q.id, q.module_id, q.lesson_id, q.title_en, q.title_fr, q.description_en, q.description_fr,
              q.time_limit_minutes, q.passing_score, q.attempts_allowed, q.published, q.status
       FROM quizzes q
       WHERE q.id = $1 OR q.module_id = $1 OR q.lesson_id = $1`,
      [quizId]
    );

    if (quizRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.QUIZ_NOT_FOUND, "Quiz not found");
    }

    const quiz = quizRes.rows[0];

    if (!isAdmin) {
      if (quiz.lesson_id) {
        await LessonAccessService.assertAccess(userId, quiz.lesson_id, targetCohortId);
      }
      if (quiz.module_id) {
        await ModuleAccessService.assertAccess(userId, quiz.module_id);
      }
    }

    // Fetch user's previous attempts first to check completion / attempt status
    const attemptsRes = await pool.query(
      `SELECT id, attempt_number, score, percentage, passed, started_at, submitted_at
       FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2
       ORDER BY attempt_number ASC`,
      [quiz.id, userId]
    );

    const attemptsAllowed = quiz.attempts_allowed || 3;
    const hasPassed = attemptsRes.rows.some((a) => a.passed);
    const attemptsExhausted = attemptsRes.rows.length >= attemptsAllowed;
    const revealAnswers = isAdmin || hasPassed || attemptsExhausted;

    // Fetch questions and options (include correct answers if attempts are exhausted or passed)
    const questionsRes = await pool.query(
      `SELECT id, order_index, type, prompt_en, prompt_fr, points, required,
              correct_text, explanation_en, explanation_fr
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY order_index ASC`,
      [quiz.id]
    );

    const questions = [];
    for (const q of questionsRes.rows) {
      const optionsRes = await pool.query(
        `SELECT id, order_index, label_en, label_fr, correct 
         FROM quiz_options 
         WHERE question_id = $1 
         ORDER BY order_index ASC`,
        [q.id]
      );

      questions.push({
        id: q.id,
        order: q.order_index,
        type: q.type,
        prompt: { en: q.prompt_en, fr: q.prompt_fr },
        points: q.points,
        required: q.required,
        explanation: revealAnswers ? { en: q.explanation_en, fr: q.explanation_fr } : undefined,
        correctText: revealAnswers ? q.correct_text : undefined,
        options: optionsRes.rows.map((opt) => ({
          id: opt.id,
          label: { en: opt.label_en, fr: opt.label_fr },
          correct: revealAnswers ? opt.correct : undefined,
        })),
      });
    }

    return {
      quiz: {
        id: quiz.id,
        moduleId: quiz.module_id,
        title: { en: quiz.title_en, fr: quiz.title_fr },
        description: { en: quiz.description_en, fr: quiz.description_fr },
        timeLimitMinutes: quiz.time_limit_minutes,
        passingScore: quiz.passing_score,
        attemptsAllowed,
        quizCompleted: hasPassed || attemptsExhausted,
        attemptsExhausted: attemptsExhausted && !hasPassed,
        hasPassed,
        questions,
      },
      previousAttempts: attemptsRes.rows,
    };
  }

  /**
   * Evaluates and records a quiz submission.
   */
  static async submitQuizAttempt(
    quizId: string,
    userId: string,
    answers: Record<string, string>,
    targetCohortId?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch quiz info and verify access
      const quizRes = await client.query(
        `SELECT q.id, q.module_id, q.lesson_id, q.passing_score, q.attempts_allowed
         FROM quizzes q
         WHERE q.id = $1 OR q.module_id = $1 OR q.lesson_id = $1`,
        [quizId]
      );

      if (quizRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.QUIZ_NOT_FOUND, "Quiz not found");
      }

      const quiz = quizRes.rows[0];
      const actualQuizId = quiz.id;

      let resolvedCohortId = targetCohortId;
      if (quiz.lesson_id) {
        const evalAccess = await LessonAccessService.assertAccess(userId, quiz.lesson_id, targetCohortId);
        resolvedCohortId = resolvedCohortId || evalAccess.cohortId;
      }
      if (quiz.module_id) {
        await ModuleAccessService.assertAccess(userId, quiz.module_id);
        if (!resolvedCohortId) {
          const modRes = await client.query(`SELECT cohort_id FROM modules WHERE id = $1`, [quiz.module_id]);
          resolvedCohortId = modRes.rows[0]?.cohort_id || null;
        }
      }

      // Rapid multi-click deduplication (within 3 seconds)
      const recentAttemptRes = await client.query(
        `SELECT id, attempt_number, score, percentage, passed, started_at, submitted_at
         FROM quiz_attempts
         WHERE quiz_id = $1 AND user_id = $2 AND submitted_at > NOW() - INTERVAL '3 seconds'
         ORDER BY submitted_at DESC LIMIT 1`,
        [actualQuizId, userId]
      );
      if (recentAttemptRes.rows.length > 0) {
        const lastAttempt = recentAttemptRes.rows[0];
        await client.query("COMMIT");
        return {
          attempt: {
            id: lastAttempt.id,
            quizId: actualQuizId,
            moduleId: quiz.module_id,
            participantId: userId,
            attemptNumber: lastAttempt.attempt_number,
            score: lastAttempt.score,
            percentage: lastAttempt.percentage,
            passed: lastAttempt.passed,
            startedAt: lastAttempt.started_at,
            submittedAt: lastAttempt.submitted_at,
          },
          graded: [],
        };
      }

      // 2. Check previous attempts count
      const countRes = await client.query(
        `SELECT COUNT(*) as count FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2`,
        [actualQuizId, userId]
      );
      const attemptCount = parseInt(countRes.rows[0].count, 10);

      if (attemptCount >= quiz.attempts_allowed) {
        throw new AppError(
          400,
          ErrorCodes.QUIZ_MAX_ATTEMPTS_REACHED,
          `Maximum attempts (${quiz.attempts_allowed}) reached for this quiz`
        );
      }

      // 3. Fetch questions with answer keys
      const questionsRes = await client.query(
        `SELECT id, type, points, correct_text, explanation_en, explanation_fr
         FROM quiz_questions
         WHERE quiz_id = $1`,
        [actualQuizId]
      );

      const attemptNumber = attemptCount + 1;
      const maxAttempts = quiz.attempts_allowed || 3;
      const attemptsExhausted = attemptNumber >= maxAttempts;

      let totalPoints = 0;
      let earnedScore = 0;
      const gradedDetails = [];

      for (const q of questionsRes.rows) {
        totalPoints += q.points;
        const given = answers[q.id] ?? "";
        let isCorrect: boolean | null = false;
        let earned = 0;
        let correctAnswer: any = null;

        if (q.type === "WRITTEN" || q.type === "REFLECTION") {
          // Written/reflection: auto-credited if answer meets minimum length, pending trainer review
          earned = given.trim().length >= 20 ? q.points : 0;
          isCorrect = null;
        } else if (q.type === "FILL_BLANK") {
          isCorrect = given.trim().toLowerCase() === (q.correct_text ?? "").trim().toLowerCase();
          earned = isCorrect ? q.points : 0;
          correctAnswer = { text: q.correct_text };
        } else {
          // Multiple choice, True/False, Scenario
          const correctOptRes = await client.query(
            `SELECT id, label_en, label_fr FROM quiz_options WHERE question_id = $1 AND correct = TRUE`,
            [q.id]
          );
          const correctOptIds = correctOptRes.rows.map((r) => r.id);
          isCorrect = correctOptIds.includes(given);
          earned = isCorrect ? q.points : 0;
          correctAnswer = {
            optionIds: correctOptIds,
            options: correctOptRes.rows.map((r) => ({
              id: r.id,
              label: { en: r.label_en, fr: r.label_fr },
            })),
          };
        }

        earnedScore += earned;
        gradedDetails.push({
          questionId: q.id,
          given,
          correct: isCorrect,
          points: q.points,
          earned,
          explanation: { en: q.explanation_en, fr: q.explanation_fr },
          correctAnswer,
        });
      }

      const percentage = totalPoints ? Math.round((earnedScore / totalPoints) * 100) : 0;
      const passed = percentage >= quiz.passing_score;
      const quizCompleted = passed || attemptsExhausted;
      const revealAnswers = passed || attemptsExhausted;

      // Filter out correctAnswer if not allowed to reveal yet
      if (!revealAnswers) {
        for (const detail of gradedDetails) {
          delete detail.correctAnswer;
        }
      }

      // 4. Save attempt with cohortId and lessonId
      const attemptRes = await client.query(
        `INSERT INTO quiz_attempts (quiz_id, module_id, lesson_id, cohort_id, user_id, attempt_number, score, percentage, passed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, started_at, submitted_at`,
        [
          actualQuizId,
          quiz.module_id || null,
          quiz.lesson_id || null,
          resolvedCohortId || null,
          userId,
          attemptNumber,
          earnedScore,
          percentage,
          passed,
        ]
      );

      const attemptId = attemptRes.rows[0].id;

      // Notify student of quiz result
      if (passed) {
        void NotificationService.create({
          userId,
          type: "QUIZ_PASSED",
          titleEn: "Quiz Passed!",
          titleFr: "Quiz réussi !",
          bodyEn: `Congratulations! You scored ${percentage}% on the quiz.`,
          bodyFr: `Félicitations ! Vous avez obtenu ${percentage}% au quiz.`,
        });
      } else {
        void NotificationService.create({
          userId,
          type: "QUIZ_FAILED",
          titleEn: "Quiz Attempt Completed",
          titleFr: "Tentative de quiz terminée",
          bodyEn: `You scored ${percentage}%. You need ${quiz.passing_score}% to pass. Review the materials and retry!`,
          bodyFr: `Vous avez obtenu ${percentage}%. Le score requis est de ${quiz.passing_score}%. Révisez et réessayez !`,
        });
      }

      // 5. Save answers
      for (const detail of gradedDetails) {
        await client.query(
          `INSERT INTO quiz_answers (attempt_id, question_id, given_answer, correct, earned_points)
           VALUES ($1, $2, $3, $4, $5)`,
          [attemptId, detail.questionId, detail.given, detail.correct, detail.earned]
        );
      }

      // 6. Update lesson_progress if attached to a lesson
      if (quiz.lesson_id) {
        const markLessonDone = passed;
        await client.query(
          `INSERT INTO lesson_progress (
             user_id, cohort_id, lesson_id, module_id, completed, completed_at
           )
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN NOW() ELSE NULL END)
           ON CONFLICT (user_id, cohort_id, lesson_id) WHERE cohort_id IS NOT NULL DO UPDATE SET
             completed = EXCLUDED.completed OR lesson_progress.completed,
             completed_at = CASE WHEN (EXCLUDED.completed OR lesson_progress.completed) AND lesson_progress.completed_at IS NULL THEN NOW() ELSE lesson_progress.completed_at END,
             updated_at = NOW()`,
          [userId, resolvedCohortId || null, quiz.lesson_id, quiz.module_id || null, markLessonDone]
        );
      }

      // 7. Update module_progress if attached to a module
      if (quiz.module_id) {
        const bestScoreRes = await client.query(
          `SELECT MAX(percentage) as best_score, BOOL_OR(passed) as has_passed
           FROM quiz_attempts
           WHERE module_id = $1 AND user_id = $2`,
          [quiz.module_id, userId]
        );

        const bestScore = bestScoreRes.rows[0].best_score || percentage;
        const hasPassed = bestScoreRes.rows[0].has_passed || passed;
        const quizFulfilled = hasPassed || attemptsExhausted;

        // Check if all lessons are done to update completed flag
        const lessonsRes = await client.query(
          `SELECT l.mandatory, COALESCE(lp.completed, FALSE) as done
           FROM lessons l
           LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
           WHERE l.module_id = $2`,
          [userId, quiz.module_id]
        );

        const allMandatoryDone = lessonsRes.rows.filter((l) => l.mandatory).every((l) => l.done);
        const doneCount = lessonsRes.rows.filter((l) => l.done).length;
        const lessonPercent = lessonsRes.rows.length ? Math.round((doneCount / lessonsRes.rows.length) * 100) : 100;
        const moduleCompleted = allMandatoryDone && quizFulfilled;

        await client.query(
          `INSERT INTO module_progress (user_id, module_id, completed, lessons_completed, completion_percentage, quiz_passed, best_quiz_score, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, module_id) DO UPDATE SET
             completed = EXCLUDED.completed,
             lessons_completed = EXCLUDED.lessons_completed,
             completion_percentage = EXCLUDED.completion_percentage,
             quiz_passed = EXCLUDED.quiz_passed,
             best_quiz_score = EXCLUDED.best_quiz_score,
             completed_at = CASE WHEN EXCLUDED.completed AND module_progress.completed_at IS NULL THEN NOW() ELSE module_progress.completed_at END,
             updated_at = NOW()`,
          [
            userId,
            quiz.module_id,
            moduleCompleted,
            doneCount,
            lessonPercent,
            quizFulfilled,
            bestScore,
            moduleCompleted ? new Date() : null,
          ]
        );
      }

      await client.query("COMMIT");

      return {
        attempt: {
          id: attemptId,
          quizId: actualQuizId,
          moduleId: quiz.module_id,
          participantId: userId,
          attemptNumber,
          score: earnedScore,
          percentage,
          passed,
          attemptsExhausted: attemptsExhausted && !passed,
          quizCompleted,
          startedAt: attemptRes.rows[0].started_at,
          submittedAt: attemptRes.rows[0].submitted_at,
        },
        graded: gradedDetails,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
