import { pool } from "../database/pool.js";
import { ModuleAccessService } from "./ModuleAccessService.js";
import { LessonAccessService } from "./LessonAccessService.js";
import { StudentDashboardDTO } from "../types/domain.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export class StudentDashboardService {
  /**
   * Fetches the complete aggregated dashboard payload for the authenticated student.
   */
  static async getDashboard(userId: string, targetCohortId?: string): Promise<StudentDashboardDTO> {
    // 1. Fetch user & profile
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.first_login, u.locale,
              p.first_name, p.last_name, p.phone, p.country, p.city, p.onboarding_completed
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.USER_NOT_FOUND, "User not found");
    }

    const u = userRes.rows[0];

    // 2. Fetch all enrollments & cohorts for this student
    const enrollRes = await pool.query(
      `SELECT e.id as enrollment_id, e.status as enrollment_status, e.payment_status,
              c.id as cohort_id, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
              c.start_date, c.end_date, c.capacity, c.status as cohort_status, c.passing_score as cohort_passing_score,
              c.fee_amount, c.fee_currency, c.timezone,
              (SELECT COUNT(*) FROM enrollments en WHERE en.cohort_id = c.id AND en.status = 'ACTIVE') as enrolled_count,
              p.id as program_id, p.slug as program_slug, p.title_en as prog_title_en, p.title_fr as prog_title_fr,
              p.tagline_en, p.tagline_fr, p.description_en, p.description_fr,
              p.duration_weeks, p.module_count, p.price, p.price_eur, p.currency
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = $1
         AND e.status IN ('ACTIVE', 'COMPLETED')
         AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
       ORDER BY 
         CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 2 END,
         c.start_date DESC`,
      [userId]
    );

    if (enrollRes.rows.length === 0) {
      // Return student without enrolled program
      return {
        student: {
          id: u.id,
          firstName: u.first_name || u.name.split(" ")[0] || "",
          lastName: u.last_name || u.name.split(" ").slice(1).join(" ") || "",
          email: u.email,
          phone: u.phone,
          country: u.country,
          city: u.city,
          locale: u.locale || "en",
          role: u.role,
          firstLogin: u.first_login,
          onboardingCompleted: u.onboarding_completed ?? false,
        },
        program: null,
        cohort: null,
        enrolledCohorts: [],
        overallProgress: 0,
        completedModulesCount: 0,
        lessonsDoneCount: 0,
        lessonsTotalCount: 0,
        avgScore: 0,
        attendancePercent: 0,
        currentModuleId: null,
        modules: [],
        upcomingLiveSessions: [],
        recentAttempts: [],
      };
    }

    // Determine currently active/selected cohort
    const selectedEnrollment = targetCohortId
      ? enrollRes.rows.find((r) => r.cohort_id === targetCohortId) || enrollRes.rows[0]
      : enrollRes.rows[0];

    // Build summaries for all enrolled cohorts
    const enrolledCohorts = await Promise.all(
      enrollRes.rows.map(async (row) => {
        const modRes = await pool.query(
          `SELECT m.id, COALESCE(mp.completed, FALSE) as is_completed
           FROM modules m
           LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.user_id = $1
           WHERE m.cohort_id = $2`,
          [userId, row.cohort_id]
        );
        const total = modRes.rows.length;
        const done = modRes.rows.filter((m) => m.is_completed).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return {
          cohortId: row.cohort_id,
          cohortName: { en: row.cohort_name_en, fr: row.cohort_name_fr },
          programId: row.program_id,
          programSlug: row.program_slug,
          programTitle: { en: row.prog_title_en, fr: row.prog_title_fr },
          startDate: row.start_date.toISOString().split("T")[0],
          endDate: row.end_date.toISOString().split("T")[0],
          status: row.cohort_status,
          progress,
          completedModulesCount: done,
          totalModulesCount: total,
          isCurrent: row.cohort_id === selectedEnrollment.cohort_id,
        };
      })
    );

    const en = selectedEnrollment;

    // 3. Fetch modules in cohort or program
    const modulesRes = await pool.query(
      `SELECT m.id, COALESCE(m.cohort_id, $1) as cohort_id, m.order_index, m.title_en, m.title_fr,
              m.description_en, m.description_fr,
              COALESCE(m.start_date, $3) as start_date,
              COALESCE(m.end_date, $4) as end_date,
              m.estimated_hours, m.required_completion, m.passing_score,
              q.id as quiz_id, q.title_en as quiz_title_en, q.title_fr as quiz_title_fr,
              q.passing_score as quiz_passing_score, q.attempts_allowed
       FROM modules m
       LEFT JOIN quizzes q ON q.module_id = m.id
       WHERE (m.cohort_id = $1 OR (m.program_id = $2 AND m.cohort_id IS NULL))
         AND m.status = 'PUBLISHED'
       ORDER BY m.order_index ASC`,
      [en.cohort_id, en.program_id, en.start_date, en.end_date]
    );

    const now = new Date();
    const modulesData: Array<any> = [];
    let totalLessonsCount = 0;
    let completedLessonsCount = 0;
    let completedModulesCount = 0;
    let currentActiveModuleId: string | null = null;

    for (const m of modulesRes.rows) {
      // Evaluate module access state
      const access = await ModuleAccessService.evaluateAccess(userId, m.id, now);
      if (access.state === "COMPLETED") completedModulesCount++;
      if (access.state === "ACTIVE" && !currentActiveModuleId) {
        currentActiveModuleId = m.id;
      }

      // Fetch lessons for this module
      const lessonsRes = await pool.query(
        `SELECT l.id, l.order_index, l.type, l.title_en, l.title_fr,
                l.duration_minutes, l.mandatory,
                COALESCE(lp.completed, FALSE) as is_done,
                COALESCE(lp.video_percent, 0) as video_percent
         FROM lessons l
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1 AND (lp.cohort_id = $2 OR lp.cohort_id IS NULL)
         WHERE l.module_id = $3 AND l.status = 'PUBLISHED'
         ORDER BY l.order_index ASC`,
        [userId, en.cohort_id, m.id]
      );

      const doneLessons = lessonsRes.rows.filter((l) => l.is_done).length;
      totalLessonsCount += lessonsRes.rows.length;
      completedLessonsCount += doneLessons;

      // Best quiz score
      let bestScore = 0;
      if (m.quiz_id) {
        const scoreRes = await pool.query(
          `SELECT MAX(percentage) as best_score 
           FROM quiz_attempts 
           WHERE quiz_id = $1 AND user_id = $2 AND (cohort_id = $3 OR cohort_id IS NULL)`,
          [m.quiz_id, userId, en.cohort_id]
        );
        bestScore = scoreRes.rows[0]?.best_score || 0;
      }

      const minutes = lessonsRes.rows.reduce((sum, l) => sum + l.duration_minutes, 0);

      // Evaluate access for each lesson
      const evaluatedLessons = await Promise.all(
        lessonsRes.rows.map(async (l) => {
          const lAccess = await LessonAccessService.evaluateAccess(userId, l.id, en.cohort_id, now).catch(() => null);
          return {
            id: l.id,
            moduleId: m.id,
            order: l.order_index,
            type: l.type,
            title: { en: l.title_en, fr: l.title_fr },
            description: { en: "", fr: "" },
            body: { en: "", fr: "" },
            durationMinutes: l.duration_minutes,
            mandatory: l.mandatory,
            completed: l.is_done,
            videoPercent: l.video_percent,
            access: lAccess ? {
              lessonId: l.id,
              cohortId: en.cohort_id,
              state: lAccess.state,
              isLocked: lAccess.isLocked,
              lockReason: lAccess.lockReason,
              availableFrom: lAccess.availableFrom,
              availableUntil: lAccess.availableUntil,
              prerequisite: lAccess.prerequisite,
              progress: lAccess.progressPercent || 0,
            } : undefined,
            resources: [],
          };
        })
      );

      const startDateStr = m.start_date instanceof Date ? m.start_date.toISOString() : new Date(m.start_date).toISOString();
      const endDateStr = m.end_date instanceof Date ? m.end_date.toISOString() : new Date(m.end_date).toISOString();

      modulesData.push({
        module: {
          id: m.id,
          cohortId: m.cohort_id,
          order: m.order_index,
          title: { en: m.title_en, fr: m.title_fr },
          description: { en: m.description_en, fr: m.description_fr },
          startDate: startDateStr,
          endDate: endDateStr,
          estimatedHours: m.estimated_hours,
          requiredCompletion: m.required_completion,
          passingScore: m.passing_score,
          lessons: evaluatedLessons,
          quiz: {
            id: m.quiz_id || "",
            moduleId: m.id,
            title: { en: m.quiz_title_en || "", fr: m.quiz_title_fr || "" },
            description: { en: "", fr: "" },
            passingScore: m.quiz_passing_score || m.passing_score,
            attemptsAllowed: m.attempts_allowed || 3,
            questions: [],
            published: true,
          },
          resources: [],
        },
        state: access.state,
        doneLessons,
        totalLessons: lessonsRes.rows.length,
        completionPercent: lessonsRes.rows.length
          ? Math.round((doneLessons / lessonsRes.rows.length) * 100)
          : 0,
        bestScore,
        hours: Math.max(1, Math.round(minutes / 60)),
      });
    }

    if (!currentActiveModuleId && modulesData.length > 0) {
      currentActiveModuleId = modulesData[0].module.id;
    }

    // 4. Overall Progress
    const overallProgress = totalLessonsCount
      ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
      : 0;

    // 5. Quiz average score & recent attempts
    const attemptsRes = await pool.query(
      `SELECT id, quiz_id, module_id, attempt_number, score, percentage, passed, started_at, submitted_at
       FROM quiz_attempts
       WHERE user_id = $1
       ORDER BY submitted_at DESC
       LIMIT 10`,
      [userId]
    );

    const avgScore = attemptsRes.rows.length
      ? Math.round(attemptsRes.rows.reduce((acc, a) => acc + a.percentage, 0) / attemptsRes.rows.length)
      : 0;

    // 6. Upcoming live sessions for cohort
    const liveSessionsRes = await pool.query(
      `SELECT id, cohort_id, module_id, title_en, title_fr, description_en, description_fr,
              starts_at, ends_at, timezone, meet_url, recording_url, instructor_name, status
       FROM live_sessions
       WHERE cohort_id = $1
       ORDER BY starts_at ASC`,
      [en.cohort_id]
    );

    const upcomingLive = liveSessionsRes.rows.map((s) => ({
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

    // 7. Real attendance calculation from database
    const attendanceRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total_past_sessions,
         COUNT(*) FILTER (WHERE lsa.attended = TRUE)::int as attended_sessions
       FROM live_sessions ls
       LEFT JOIN live_session_attendees lsa ON lsa.live_session_id = ls.id AND lsa.user_id = $1
       WHERE ls.cohort_id = $2 AND ls.starts_at <= NOW()`,
      [userId, en.cohort_id]
    );
    const totalPast = attendanceRes.rows[0]?.total_past_sessions || 0;
    const attendedCount = attendanceRes.rows[0]?.attended_sessions || 0;
    const attendancePercent = totalPast > 0 ? Math.round((attendedCount / totalPast) * 100) : 0;

    const attendanceTrendRes = await pool.query(
      `SELECT (CASE WHEN lsa.attended = TRUE THEN 100 ELSE 0 END)::int as score
       FROM live_sessions ls
       LEFT JOIN live_session_attendees lsa ON lsa.live_session_id = ls.id AND lsa.user_id = $1
       WHERE ls.cohort_id = $2 AND ls.starts_at <= NOW()
       ORDER BY ls.starts_at ASC
       LIMIT 10`,
      [userId, en.cohort_id]
    );
    const attendanceTrend = attendanceTrendRes.rows.map((r) => r.score);

    // 8. Real trend series derived strictly from database records
    const progressTrend = modulesData.map((m) => m.completionPercent);
    const completedModulesTrend = modulesData.map((_, idx) =>
      modulesData.slice(0, idx + 1).filter((m) => m.state === "COMPLETED").length
    );
    const quizScoresTrend = attemptsRes.rows.map((a) => a.percentage).reverse();

    return {
      student: {
        id: u.id,
        firstName: u.first_name || u.name.split(" ")[0] || "",
        lastName: u.last_name || u.name.split(" ").slice(1).join(" ") || "",
        email: u.email,
        phone: u.phone,
        country: u.country,
        city: u.city,
        locale: u.locale || "en",
        role: u.role,
        firstLogin: u.first_login,
        onboardingCompleted: u.onboarding_completed ?? false,
      },
      program: {
        id: en.program_id,
        slug: en.program_slug,
        title: { en: en.prog_title_en, fr: en.prog_title_fr },
        tagline: { en: en.tagline_en || "", fr: en.tagline_fr || "" },
        description: { en: en.description_en || "", fr: en.description_fr || "" },
        audience: [],
        outcomes: [],
        durationWeeks: en.duration_weeks,
        moduleCount: en.module_count,
        format: { en: "Online cohort", fr: "Cohorte en ligne" },
        price: Number(en.price),
        priceEur: en.price_eur ? Number(en.price_eur) : Math.round(Number(en.price) * 0.92),
        currency: en.currency,
      },
      cohort: {
        id: en.cohort_id,
        programId: en.program_id,
        name: { en: en.cohort_name_en, fr: en.cohort_name_fr },
        startDate: en.start_date.toISOString().split("T")[0],
        endDate: en.end_date.toISOString().split("T")[0],
        capacity: en.capacity,
        enrolled: parseInt(en.enrolled_count || "0", 10),
        status: en.cohort_status,
        passingScore: en.cohort_passing_score,
        feeAmount: Number(en.fee_amount || 0),
        feeCurrency: en.fee_currency || "USD",
        timezone: en.timezone || "UTC",
      },
      enrolledCohorts,
      overallProgress,
      completedModulesCount,
      lessonsDoneCount: completedLessonsCount,
      lessonsTotalCount: totalLessonsCount,
      avgScore,
      attendancePercent,
      currentModuleId: currentActiveModuleId,
      modules: modulesData,
      upcomingLiveSessions: upcomingLive,
      recentAttempts: attemptsRes.rows.map((a) => ({
        id: a.id,
        quizId: a.quiz_id,
        moduleId: a.module_id,
        participantId: userId,
        startedAt: a.started_at.toISOString(),
        submittedAt: a.submitted_at.toISOString(),
        score: a.score,
        percentage: a.percentage,
        passed: a.passed,
        attemptNumber: a.attempt_number,
      })),
      progressTrend,
      completedModulesTrend,
      quizScoresTrend,
      attendanceTrend,
    };
  }
}
