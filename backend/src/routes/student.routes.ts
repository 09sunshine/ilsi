import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requireOnboardingCompleted } from "../middleware/rbac.js";
import { validateRequest } from "../middleware/validate.js";
import { progressSchemas, quizSchemas } from "../validators/schemas.js";
import { quizLimiter, videoLimiter } from "../middleware/rateLimiters.js";
import { StudentDashboardService } from "../services/StudentDashboardService.js";
import { VideoStorageService } from "../services/VideoStorageService.js";
import { QuizEngineService } from "../services/QuizEngineService.js";
import { ModuleAccessService } from "../services/ModuleAccessService.js";
import { EnrollmentAccessService } from "../services/EnrollmentAccessService.js";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { NotificationService } from "../services/NotificationService.js";

const router = Router();

// All student routes require authentication
router.use(requireAuth);

/**
 * GET /api/student/dashboard
 * Aggregated dashboard payload for the current authenticated student
 */
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.query.cohortId as string | undefined;
    const dashboard = await StudentDashboardService.getDashboard(req.user!.id, cohortId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lessons/:id
 * Fetches lesson content with progression check
 */
router.get("/lessons/:id", requireOnboardingCompleted, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const lessonRes = await pool.query(
      `SELECT l.id, l.module_id, l.order_index, l.type, l.title_en, l.title_fr,
              l.description_en, l.description_fr, l.body_en, l.body_fr,
              l.duration_minutes, l.mandatory,
              m.cohort_id, m.order_index as module_order,
              COALESCE(lp.completed, FALSE) as completed,
              COALESCE(lp.video_percent, 0) as video_percent
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE l.id = $2`,
      [req.user!.id, id]
    );

    if (lessonRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
    }

    const lesson = lessonRes.rows[0];

    // Assert module access
    await ModuleAccessService.assertAccess(req.user!.id, lesson.module_id);

    // Fetch resources attached to lesson
    const resRes = await pool.query(
      `SELECT id, name_en, name_fr, type, size_kb, downloadable, url 
       FROM resources 
       WHERE lesson_id = $1`,
      [id]
    );

    // Check if video is available and fetch signed playback url
    const videoData = await VideoStorageService.getAuthorizedPlaybackUrl(id, req.user!.id);

    res.json({
      success: true,
      data: {
        id: lesson.id,
        moduleId: lesson.module_id,
        cohortId: lesson.cohort_id,
        order: lesson.order_index,
        type: lesson.type,
        title: { en: lesson.title_en, fr: lesson.title_fr },
        description: { en: lesson.description_en, fr: lesson.description_fr },
        body: { en: lesson.body_en, fr: lesson.body_fr },
        durationMinutes: lesson.duration_minutes,
        mandatory: lesson.mandatory,
        completed: lesson.completed,
        videoPercent: lesson.video_percent,
        videoUrl: videoData?.playbackUrl || null,
        resources: resRes.rows.map((r) => ({
          id: r.id,
          name: { en: r.name_en, fr: r.name_fr },
          type: r.type,
          sizeKb: r.size_kb,
          url: r.url,
          downloadable: r.downloadable,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lessons/:id/video
 * Returns short-lived signed video URL after strict access check with rate limiting
 */
router.get(
  "/lessons/:id/video",
  requireOnboardingCompleted,
  videoLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoData = await VideoStorageService.getAuthorizedPlaybackUrl(req.params.id as string, req.user!.id);
      if (!videoData) {
        throw new AppError(404, ErrorCodes.VIDEO_NOT_FOUND, "No video attached to this lesson");
      }
      res.json({ success: true, data: videoData });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/progress/lessons/:id
 * Tracks video watch percentage and marks lesson complete with Zod input validation
 */
router.post(
  "/progress/lessons/:id",
  requireOnboardingCompleted,
  validateRequest({ body: progressSchemas.updateLesson }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { videoPercent, markComplete } = req.body;

      // Get lesson module
      const lessonRes = await pool.query(`SELECT module_id FROM lessons WHERE id = $1`, [id]);
      if (lessonRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
      }

      const moduleId = lessonRes.rows[0].module_id;
      await ModuleAccessService.assertAccess(req.user!.id, moduleId);

      const percent = Math.min(100, Math.max(0, Math.round(Number(videoPercent) || 0)));
      const isCompleted = markComplete || percent >= 80;

      await pool.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, module_id, completed, video_percent, completed_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, lesson_id) DO UPDATE SET
           completed = EXCLUDED.completed OR lesson_progress.completed,
           video_percent = GREATEST(lesson_progress.video_percent, EXCLUDED.video_percent),
           completed_at = CASE WHEN (EXCLUDED.completed OR lesson_progress.completed) AND lesson_progress.completed_at IS NULL THEN NOW() ELSE lesson_progress.completed_at END,
           updated_at = NOW()`,
        [req.user!.id, id, moduleId, isCompleted, percent]
      );

      res.json({ success: true, data: { completed: isCompleted, videoPercent: percent } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/quizzes/:id
 * Fetches quiz questions (without answers)
 */
router.get("/quizzes/:id", requireOnboardingCompleted, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await QuizEngineService.getQuizForStudent(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/quizzes/:id/attempts
 * Submits quiz answers for evaluation with rate limiting and Zod input validation
 */
router.post(
  "/quizzes/:id/attempts",
  requireOnboardingCompleted,
  quizLimiter,
  validateRequest({ body: quizSchemas.submitAttempt }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const answers = req.body.answers || {};
      const result = await QuizEngineService.submitQuizAttempt(req.params.id as string, req.user!.id, answers);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/student/current-cohort (also /api/current-cohort)
 * Efficient resolution of current cohort based strictly on active paid enrollment
 */
router.get("/current-cohort", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const current = await EnrollmentAccessService.getCurrentCohort(req.user!.id);
    if (!current) {
      return res.json({ success: true, data: null, message: "No active cohort enrollment found." });
    }
    res.json({ success: true, data: current });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/student/enrollments (also /api/enrollments)
 * Returns all past and present enrollments for the student
 */
router.get("/enrollments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enrollments = await EnrollmentAccessService.getUserEnrollments(req.user!.id);
    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cohorts/:cohortId
 */
router.get("/cohorts/:cohortId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.cohortId as string;
    const cohortRes = await pool.query(
      `SELECT c.id, c.program_id, c.name_en, c.name_fr, c.start_date, c.end_date,
              c.capacity, c.status, c.passing_score, c.fee_amount, c.fee_currency,
              c.timezone, c.description_en, c.description_fr,
              p.title_en as program_title_en, p.title_fr as program_title_fr
       FROM cohorts c
       JOIN programs p ON p.id = c.program_id
       WHERE c.id = $1`,
      [cohortId]
    );

    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }

    const c = cohortRes.rows[0];
    res.json({
      success: true,
      data: {
        id: c.id,
        programId: c.program_id,
        programTitle: { en: c.program_title_en, fr: c.program_title_fr },
        name: { en: c.name_en, fr: c.name_fr },
        description: { en: c.description_en || "", fr: c.description_fr || "" },
        startDate: c.start_date.toISOString().split("T")[0],
        endDate: c.end_date.toISOString().split("T")[0],
        capacity: c.capacity,
        status: c.status,
        passingScore: c.passing_score,
        feeAmount: Number(c.fee_amount || 0),
        feeCurrency: c.fee_currency || "USD",
        timezone: c.timezone,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cohorts/:cohortId/modules
 */
router.get("/cohorts/:cohortId/modules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.cohortId as string;
    await EnrollmentAccessService.assertCohortAccess(req.user!.id, cohortId);

    const modulesRes = await pool.query(
      `SELECT id, order_index, title_en, title_fr, description_en, description_fr,
              start_date, end_date, estimated_hours, required_completion, passing_score
       FROM modules
       WHERE cohort_id = $1
       ORDER BY order_index ASC`,
      [cohortId]
    );

    const now = new Date();
    const modulesWithState = [];
    for (const m of modulesRes.rows) {
      const evaluation = await ModuleAccessService.evaluateAccess(req.user!.id, m.id, now);
      modulesWithState.push({
        id: m.id,
        order: m.order_index,
        title: { en: m.title_en, fr: m.title_fr },
        description: { en: m.description_en, fr: m.description_fr },
        startDate: m.start_date.toISOString(),
        endDate: m.end_date.toISOString(),
        estimatedHours: m.estimated_hours,
        requiredCompletion: m.required_completion,
        passingScore: m.passing_score,
        accessState: evaluation.state,
        allowed: evaluation.allowed,
        code: evaluation.code,
      });
    }

    res.json({ success: true, data: modulesWithState });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cohorts/:cohortId/live-sessions
 */
router.get("/cohorts/:cohortId/live-sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.cohortId as string;
    await EnrollmentAccessService.assertCohortAccess(req.user!.id, cohortId);

    const sessionsRes = await pool.query(
      `SELECT id, cohort_id, module_id, title_en, title_fr, description_en, description_fr,
              starts_at, ends_at, timezone, meet_url, recording_url, instructor_name, status
       FROM live_sessions
       WHERE cohort_id = $1
       ORDER BY starts_at ASC`,
      [cohortId]
    );

    res.json({
      success: true,
      data: sessionsRes.rows.map((s) => ({
        id: s.id,
        cohortId: s.cohort_id,
        moduleId: s.module_id,
        title: { en: s.title_en, fr: s.title_fr },
        description: { en: s.description_en, fr: s.description_fr },
        date: s.starts_at.toISOString().split("T")[0],
        startTime: s.starts_at.toTimeString().substring(0, 5),
        endTime: s.ends_at.toTimeString().substring(0, 5),
        timezone: s.timezone,
        meetUrl: s.meet_url,
        recordingUrl: s.recording_url,
        instructor: s.instructor_name,
        status: s.status,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cohorts/:cohortId/progress
 */
router.get("/cohorts/:cohortId/progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.cohortId as string;
    await EnrollmentAccessService.assertCohortAccess(req.user!.id, cohortId);

    const lessonsRes = await pool.query(
      `SELECT l.id, COALESCE(lp.completed, FALSE) as is_done
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE m.cohort_id = $2`,
      [req.user!.id, cohortId]
    );

    const total = lessonsRes.rows.length;
    const done = lessonsRes.rows.filter((l) => l.is_done).length;
    const progressPercent = total ? Math.round((done / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        cohortId,
        totalLessons: total,
        completedLessons: done,
        progressPercentage: progressPercent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/modules/:moduleId/access
 */
router.get("/modules/:moduleId/access", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const moduleId = req.params.moduleId as string;
    const evaluation = await ModuleAccessService.evaluateAccess(req.user!.id, moduleId);
    res.json({ success: true, data: evaluation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/live-sessions/:id
 * Strictly authorized: returns private Google Meet URL only if participant is in the session's cohort
 */
router.get("/live-sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id as string;
    const sessionRes = await pool.query(
      `SELECT ls.id, ls.cohort_id, ls.module_id, ls.title_en, ls.title_fr,
              ls.description_en, ls.description_fr, ls.starts_at, ls.ends_at,
              ls.timezone, ls.meet_url, ls.recording_url, ls.instructor_name, ls.status
       FROM live_sessions ls
       WHERE ls.id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.LIVE_SESSION_NOT_FOUND, "Live session not found");
    }

    const session = sessionRes.rows[0];

    // Assert student has active paid enrollment in this session's cohort
    try {
      await EnrollmentAccessService.assertCohortAccess(req.user!.id, session.cohort_id);
    } catch {
      throw new AppError(
        403,
        ErrorCodes.LIVE_SESSION_ACCESS_DENIED,
        "Live session access denied: You are not an active participant in this cohort."
      );
    }

    res.json({
      success: true,
      data: {
        id: session.id,
        cohortId: session.cohort_id,
        moduleId: session.module_id,
        title: { en: session.title_en, fr: session.title_fr },
        description: { en: session.description_en, fr: session.description_fr },
        date: session.starts_at.toISOString().split("T")[0],
        startTime: session.starts_at.toTimeString().substring(0, 5),
        endTime: session.ends_at.toTimeString().substring(0, 5),
        timezone: session.timezone,
        meetUrl: session.meet_url,
        recordingUrl: session.recording_url,
        instructor: session.instructor_name,
        status: session.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/live-sessions
 * Fetches live sessions for student's active cohorts
 */
router.get("/live-sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionsRes = await pool.query(
      `SELECT ls.id, ls.cohort_id, ls.module_id, ls.title_en, ls.title_fr,
              ls.description_en, ls.description_fr, ls.starts_at, ls.ends_at,
              ls.timezone, ls.meet_url, ls.recording_url, ls.instructor_name, ls.status
       FROM live_sessions ls
       JOIN enrollments e ON e.cohort_id = ls.cohort_id
       WHERE e.user_id = $1
         AND e.status IN ('ACTIVE', 'COMPLETED')
         AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
       ORDER BY ls.starts_at ASC`,
      [req.user!.id]
    );

    const sessions = sessionsRes.rows.map((s) => ({
      id: s.id,
      cohortId: s.cohort_id,
      moduleId: s.module_id,
      title: { en: s.title_en, fr: s.title_fr },
      description: { en: s.description_en, fr: s.description_fr },
      date: s.starts_at.toISOString().split("T")[0],
      startTime: s.starts_at.toTimeString().substring(0, 5),
      endTime: s.ends_at.toTimeString().substring(0, 5),
      timezone: s.timezone,
      meetingUrl: s.meet_url || (s.id ? `https://meet.jit.si/ilsi-live-${s.id.substring(0, 8)}` : "https://meet.jit.si/ilsi-live"),
      recordingUrl: s.recording_url,
      instructor: s.instructor_name,
      status: s.status,
    }));

    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications
 * In-app notification list for the current authenticated user
 */
router.get("/notifications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const notifications = await NotificationService.getUserNotifications(req.user!.id, limit);
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/mark-all-read
 */
router.post("/notifications/mark-all-read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await NotificationService.markAllRead(req.user!.id);
    res.json({ success: true, message: "All notifications marked as read", data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch("/notifications/:id/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await NotificationService.markAsRead(id, req.user!.id);
    res.json({ success: true, message: "Notification marked as read", data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
router.delete("/notifications/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await NotificationService.delete(id, req.user!.id);
    res.json({ success: true, message: "Notification deleted", data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
