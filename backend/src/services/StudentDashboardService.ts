import { pool } from "../database/pool.js";
import { StudentDashboardDTO } from "../types/domain.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

interface StudentDashboardCacheEntry {
  data: StudentDashboardDTO;
  expiresAt: number;
}

const studentDashboardServiceCache = new Map<string, StudentDashboardCacheEntry>();
const DASHBOARD_SERVICE_CACHE_TTL_MS = 20_000; // 20 seconds TTL

export function invalidateStudentDashboardServiceCache(userId?: string) {
  if (!userId) {
    studentDashboardServiceCache.clear();
    return;
  }
  for (const key of studentDashboardServiceCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      studentDashboardServiceCache.delete(key);
    }
  }
}

export class StudentDashboardService {
  /**
   * Fetches the complete aggregated dashboard payload for the authenticated student.
   * High performance implementation: performs batch parallel queries with in-memory caching
   * to bring response time down to <50ms.
   */
  static async getDashboard(userId: string, targetCohortId?: string): Promise<StudentDashboardDTO> {
    const cacheKey = `${userId}:${targetCohortId || ""}`;
    const nowMs = Date.now();
    const cached = studentDashboardServiceCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      return cached.data;
    }

    // 1. Fetch user & all active/completed enrollments in parallel
    const [userRes, enrollRes] = await Promise.all([
      pool.query(
        `SELECT u.id, u.email, u.name, u.role, u.first_login, u.locale,
                p.first_name, p.last_name, p.phone, p.country, p.city, p.onboarding_completed
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT e.id as enrollment_id, e.status as enrollment_status, e.payment_status,
                c.id as cohort_id, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
                c.start_date, c.end_date, c.capacity, c.status as cohort_status, c.passing_score as cohort_passing_score,
                c.fee_amount, c.fee_currency, c.timezone,
                c.thumbnail_url as cohort_thumbnail_url,
                p.thumbnail_url as program_thumbnail_url,
                (SELECT COUNT(*) FROM enrollments en WHERE en.cohort_id = c.id AND en.status = 'ACTIVE') as enrolled_count,
                p.id as program_id, p.slug as program_slug, p.title_en as prog_title_en, p.title_fr as prog_title_fr,
                p.tagline_en, p.tagline_fr, p.description_en, p.description_fr,
                p.duration_weeks, p.module_count, p.price, p.price_eur, p.currency
         FROM enrollments e
         JOIN cohorts c ON c.id = e.cohort_id
         JOIN programs p ON p.id = c.program_id
         WHERE e.user_id = $1
           AND e.status IN ('ACTIVE', 'COMPLETED', 'DISQUALIFIED')
           AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
         ORDER BY 
           CASE WHEN e.status = 'ACTIVE' THEN 1 WHEN e.status = 'COMPLETED' THEN 2 ELSE 3 END,
           c.start_date DESC`,
        [userId]
      ),
    ]);

    if (userRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.USER_NOT_FOUND, "User not found");
    }

    const u = userRes.rows[0];

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
          locale: u.locale || "fr",
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

    const en = selectedEnrollment;
    const allCohortIds = enrollRes.rows.map((r) => r.cohort_id);

    // 2. High-speed batch parallel queries for all cohort assets, progress, attempts, and sessions
    const [
      modulesRes,
      lessonsRes,
      modProgRes,
      attemptsRes,
      liveSessionsRes,
      cohortSummariesRes,
    ] = await Promise.all([
      // Modules in current cohort or parent program
      pool.query(
        `SELECT m.id, COALESCE(m.cohort_id, $1) as cohort_id, m.order_index, m.title_en, m.title_fr,
                m.description_en, m.description_fr,
                COALESCE(m.start_date, $3) as start_date,
                COALESCE(m.end_date, $4) as end_date,
                m.estimated_hours, m.required_completion, m.passing_score,
                q.id as quiz_id, q.title_en as quiz_title_en, q.title_fr as quiz_title_fr,
                q.passing_score as quiz_passing_score, q.attempts_allowed
         FROM modules m
         LEFT JOIN quizzes q ON q.module_id = m.id AND (q.published = TRUE OR q.status = 'PUBLISHED')
         WHERE (m.cohort_id = $1 OR (m.program_id = $2 AND m.cohort_id IS NULL))
           AND m.status = 'PUBLISHED'
         ORDER BY m.order_index ASC`,
        [en.cohort_id, en.program_id, en.start_date, en.end_date]
      ),

      // All lessons in these modules with user's lesson_progress and attached lesson quizzes
      pool.query(
        `SELECT l.id, l.module_id, l.order_index, l.type, l.title_en, l.title_fr,
                l.duration_minutes, l.mandatory,
                COALESCE(lp.completed, FALSE) as is_done,
                COALESCE(lp.video_percent, 0) as video_percent,
                q.id as lesson_quiz_id, q.title_en as lesson_quiz_title_en, q.title_fr as lesson_quiz_title_fr,
                q.passing_score as lesson_quiz_passing_score, q.attempts_allowed as lesson_quiz_attempts_allowed
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1 AND (lp.cohort_id = $2 OR lp.cohort_id IS NULL)
         LEFT JOIN quizzes q ON q.lesson_id = l.id AND (q.published = TRUE OR q.status = 'PUBLISHED')
         WHERE (m.cohort_id = $2 OR (m.program_id = $3 AND m.cohort_id IS NULL))
           AND l.status = 'PUBLISHED'
         ORDER BY m.order_index ASC, l.order_index ASC`,
        [userId, en.cohort_id, en.program_id]
      ),

      // Module progress for this user
      pool.query(
        `SELECT module_id, completed, quiz_passed
         FROM module_progress
         WHERE user_id = $1`,
        [userId]
      ),

      // Quiz attempts for this user (both module and lesson quizzes)
      pool.query(
        `SELECT id, quiz_id, module_id, lesson_id, attempt_number, score, percentage, passed, started_at, submitted_at
         FROM quiz_attempts
         WHERE user_id = $1 AND (cohort_id = $2 OR cohort_id IS NULL)
         ORDER BY submitted_at DESC`,
        [userId, en.cohort_id]
      ),

      // Live sessions with attendance
      pool.query(
        `SELECT ls.id, ls.cohort_id, ls.module_id, ls.title_en, ls.title_fr, ls.description_en, ls.description_fr,
                ls.starts_at, ls.ends_at, ls.timezone, ls.meet_url, ls.recording_url, ls.instructor_name, ls.status,
                COALESCE(lsa.attended, FALSE) as attended
         FROM live_sessions ls
         LEFT JOIN live_session_attendees lsa ON lsa.live_session_id = ls.id AND lsa.user_id = $1
         WHERE ls.cohort_id = $2
         ORDER BY ls.starts_at ASC`,
        [userId, en.cohort_id]
      ),

      // Enrolled cohorts summary calculation in 1 single bulk query
      pool.query(
        `SELECT m.cohort_id,
                COUNT(m.id)::int as total_modules,
                COUNT(mp.id) FILTER (WHERE mp.completed = TRUE)::int as done_modules
         FROM modules m
         LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.user_id = $1
         WHERE m.cohort_id = ANY($2::uuid[])
         GROUP BY m.cohort_id`,
        [userId, allCohortIds]
      ),
    ]);

    // 3. Fast In-Memory Map Assembly
    const cohortProgressMap = new Map<string, { total: number; done: number }>();
    for (const row of cohortSummariesRes.rows) {
      cohortProgressMap.set(row.cohort_id, {
        total: row.total_modules || 0,
        done: row.done_modules || 0,
      });
    }

    const enrolledCohorts = enrollRes.rows.map((row) => {
      const summary = cohortProgressMap.get(row.cohort_id) || { total: 0, done: 0 };
      const progress = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
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
        completedModulesCount: summary.done,
        totalModulesCount: summary.total,
        isCurrent: row.cohort_id === selectedEnrollment.cohort_id,
        thumbnailUrl: row.cohort_thumbnail_url || row.program_thumbnail_url || null,
      };
    });

    // Group lessons by module_id
    const lessonsByModule = new Map<string, any[]>();
    for (const l of lessonsRes.rows) {
      const list = lessonsByModule.get(l.module_id) || [];
      list.push(l);
      lessonsByModule.set(l.module_id, list);
    }

    // Map module_progress by module_id
    const moduleProgMap = new Map<string, any>();
    for (const mp of modProgRes.rows) {
      moduleProgMap.set(mp.module_id, mp);
    }

    // Group attempts by quiz_id
    const attemptsByQuiz = new Map<string, any[]>();
    for (const att of attemptsRes.rows) {
      const list = attemptsByQuiz.get(att.quiz_id) || [];
      list.push(att);
      attemptsByQuiz.set(att.quiz_id, list);
    }

    const now = new Date();
    const isCohortActive = en.cohort_status === "ACTIVE";
    const modulesData: Array<any> = [];
    let totalLessonsCount = 0;
    let completedLessonsCount = 0;
    let completedModulesCount = 0;
    let currentActiveModuleId: string | null = null;

    // Evaluate access for each module sequentially in-memory
    const sortedModules = modulesRes.rows;

    const isParticipantDisqualified = en.enrollment_status === "DISQUALIFIED";

    for (let i = 0; i < sortedModules.length; i++) {
      const m = sortedModules[i];
      const mLessons = lessonsByModule.get(m.id) || [];
      const doneLessons = mLessons.filter((l) => l.is_done).length;
      totalLessonsCount += mLessons.length;
      completedLessonsCount += doneLessons;

      // Best score for module quiz
      let bestScore = 0;
      const mQuizAttempts = m.quiz_id ? attemptsByQuiz.get(m.quiz_id) || [] : [];
      if (mQuizAttempts.length > 0) {
        bestScore = Math.max(...mQuizAttempts.map((a) => a.percentage || 0));
      }

      // Check module access state in-memory
      let moduleState: "LOCKED" | "UPCOMING" | "ACTIVE" | "COMPLETED" | "FAILED" | "EXPIRED" = isParticipantDisqualified ? "LOCKED" : "ACTIVE";
      const isCompletedInProg = moduleProgMap.get(m.id)?.completed;

      if (!isParticipantDisqualified && i > 0) {
        // Prerequisite check from previous module
        const prevM = sortedModules[i - 1];
        const prevLessons = lessonsByModule.get(prevM.id) || [];
        const prevDone = prevLessons.filter((l) => l.is_done).length;
        const prevMandatoryDone = prevLessons.filter((l) => l.mandatory).every((l) => l.is_done);
        const prevPercent = prevLessons.length ? Math.round((prevDone / prevLessons.length) * 100) : 100;
        const prevProg = moduleProgMap.get(prevM.id);

        let prevQuizSatisfied = true;
        if (prevM.quiz_id && !prevProg?.completed) {
          const prevAttempts = attemptsByQuiz.get(prevM.quiz_id) || [];
          const prevPassed = prevAttempts.some((a) => a.passed);
          const prevExhausted = prevAttempts.length >= (prevM.attempts_allowed || 3);
          prevQuizSatisfied = prevPassed || prevExhausted;
        }

        const prevSatisfied =
          prevMandatoryDone &&
          prevPercent >= (prevM.required_completion || 0) &&
          prevQuizSatisfied;

        if (!prevSatisfied) {
          moduleState = "LOCKED";
        }
      }

      if (moduleState !== "LOCKED") {
        const startDate = new Date(m.start_date);
        const endDate = new Date(m.end_date);

        if (isCompletedInProg) {
          moduleState = "COMPLETED";
        } else if (
          m.quiz_id &&
          mQuizAttempts.length > 0 &&
          !mQuizAttempts[0].passed &&
          mQuizAttempts.length >= (m.attempts_allowed || 3)
        ) {
          moduleState = "FAILED";
        } else if (startDate > now && !isCohortActive) {
          moduleState = "UPCOMING";
        } else if (endDate < now) {
          moduleState = "EXPIRED";
        } else {
          moduleState = "ACTIVE";
        }
      }

      if (moduleState === "COMPLETED") completedModulesCount++;
      if (moduleState === "ACTIVE" && !currentActiveModuleId) {
        currentActiveModuleId = m.id;
      }

      const minutes = mLessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
      const startDateStr = m.start_date instanceof Date ? m.start_date.toISOString() : new Date(m.start_date).toISOString();
      const endDateStr = m.end_date instanceof Date ? m.end_date.toISOString() : new Date(m.end_date).toISOString();

      // Evaluate lesson access in-memory
      const evaluatedLessons = mLessons.map((l, lIdx) => {
        let isLessonLocked = isParticipantDisqualified || moduleState === "LOCKED";
        if (!isLessonLocked && moduleState === "ACTIVE" && lIdx > 0) {
          const prevL = mLessons[lIdx - 1];
          if (prevL && !prevL.is_done) {
            isLessonLocked = true;
          }
        }

        const lQuizAttempts = l.lesson_quiz_id ? attemptsByQuiz.get(l.lesson_quiz_id) || [] : [];
        const lPassed = lQuizAttempts.some((a) => a.passed);
        const lBestScore = lQuizAttempts.length > 0 ? Math.max(...lQuizAttempts.map((a) => a.percentage || 0)) : null;

        const lockReason = isParticipantDisqualified
          ? "DISQUALIFIED"
          : isLessonLocked && !l.is_done
          ? "PREREQUISITE_INCOMPLETE"
          : undefined;

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
          quiz: l.lesson_quiz_id
            ? {
                id: l.lesson_quiz_id,
                title: { en: l.lesson_quiz_title_en, fr: l.lesson_quiz_title_fr },
                passingScore: l.lesson_quiz_passing_score,
                attemptsAllowed: l.lesson_quiz_attempts_allowed,
                hasPassed: lPassed,
                bestScore: lBestScore,
                attemptsCount: lQuizAttempts.length,
              }
            : null,
          access: {
            lessonId: l.id,
            cohortId: en.cohort_id,
            state: isParticipantDisqualified ? "LOCKED" : l.is_done ? "COMPLETED" : isLessonLocked ? "LOCKED" : "ACTIVE",
            isLocked: isParticipantDisqualified || (isLessonLocked && !l.is_done),
            lockReason,
            availableFrom: startDateStr,
            availableUntil: endDateStr,
            progress: l.video_percent,
          },
          resources: [],
        };
      });

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
        state: moduleState,
        doneLessons,
        totalLessons: mLessons.length,
        completionPercent: mLessons.length ? Math.round((doneLessons / mLessons.length) * 100) : 0,
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

    // 5. Quiz average score
    const avgScore = attemptsRes.rows.length
      ? Math.round(attemptsRes.rows.reduce((acc, a) => acc + (a.percentage || 0), 0) / attemptsRes.rows.length)
      : 0;

    // 6. Live sessions
    const upcomingLive = liveSessionsRes.rows.map((s) => ({
      id: s.id,
      cohortId: s.cohort_id,
      moduleId: s.module_id,
      title: { en: s.title_en, fr: s.title_fr },
      description: { en: s.description_en, fr: s.description_fr },
      date: s.starts_at instanceof Date ? s.starts_at.toISOString().split("T")[0] : new Date(s.starts_at).toISOString().split("T")[0],
      startTime: s.starts_at instanceof Date ? s.starts_at.toTimeString().substring(0, 5) : new Date(s.starts_at).toTimeString().substring(0, 5),
      endTime: s.ends_at instanceof Date ? s.ends_at.toTimeString().substring(0, 5) : new Date(s.ends_at).toTimeString().substring(0, 5),
      timezone: s.timezone,
      meetingUrl: s.meet_url || (s.id ? `https://meet.jit.si/ilsi-live-${s.id.substring(0, 8)}` : "https://meet.jit.si/ilsi-live"),
      recordingUrl: s.recording_url,
      instructor: s.instructor_name,
      status: s.status,
    }));

    // 7. Attendance calculation in-memory from liveSessionsRes
    const pastSessions = liveSessionsRes.rows.filter((s) => new Date(s.starts_at) <= now);
    const attendedSessions = pastSessions.filter((s) => s.attended);
    const totalPast = pastSessions.length;
    const attendedCount = attendedSessions.length;
    const attendancePercent = totalPast > 0 ? Math.round((attendedCount / totalPast) * 100) : 0;
    const attendanceTrend = pastSessions.slice(0, 10).map((s) => (s.attended ? 100 : 0));

    // 8. Trends
    const progressTrend = modulesData.map((m) => m.completionPercent);
    const completedModulesTrend = modulesData.map((_, idx) =>
      modulesData.slice(0, idx + 1).filter((m) => m.state === "COMPLETED").length
    );
    const quizScoresTrend = attemptsRes.rows.map((a) => a.percentage).reverse();

    const result: StudentDashboardDTO = {
      student: {
        id: u.id,
        firstName: u.first_name || u.name.split(" ")[0] || "",
        lastName: u.last_name || u.name.split(" ").slice(1).join(" ") || "",
        email: u.email,
        phone: u.phone,
        country: u.country,
        city: u.city,
        locale: u.locale || "fr",
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
        thumbnailUrl: en.program_thumbnail_url || en.cohort_thumbnail_url || null,
      },
      cohort: {
        id: en.cohort_id,
        programId: en.program_id,
        name: { en: en.cohort_name_en, fr: en.cohort_name_fr },
        startDate: en.start_date instanceof Date ? en.start_date.toISOString().split("T")[0] : new Date(en.start_date).toISOString().split("T")[0],
        endDate: en.end_date instanceof Date ? en.end_date.toISOString().split("T")[0] : new Date(en.end_date).toISOString().split("T")[0],
        capacity: en.capacity,
        enrolled: parseInt(en.enrolled_count || "0", 10),
        status: en.cohort_status,
        passingScore: en.cohort_passing_score,
        feeAmount: Number(en.fee_amount || 0),
        feeCurrency: en.fee_currency || "USD",
        timezone: en.timezone || "UTC",
        thumbnailUrl: en.cohort_thumbnail_url || en.program_thumbnail_url || null,
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
      recentAttempts: attemptsRes.rows.slice(0, 10).map((a) => ({
        id: a.id,
        quizId: a.quiz_id,
        moduleId: a.module_id,
        participantId: userId,
        startedAt: a.started_at instanceof Date ? a.started_at.toISOString() : new Date(a.started_at).toISOString(),
        submittedAt: a.submitted_at instanceof Date ? a.submitted_at.toISOString() : new Date(a.submitted_at).toISOString(),
        score: a.score,
        percentage: a.percentage,
        passed: a.passed,
        attemptNumber: a.attempt_number,
      })),
      progressTrend,
      completedModulesTrend,
      quizScoresTrend,
      attendanceTrend,
      isDisqualified: isParticipantDisqualified,
      enrollmentStatus: en.enrollment_status,
      disqualificationMessage: isParticipantDisqualified
        ? {
            en: "You have been disqualified from this cohort after failing all quiz attempts and cannot continue the rest of the cohort.",
            fr: "Vous avez été disqualifié(e) de cette cohorte après avoir échoué à toutes les tentatives de quiz et ne pouvez plus poursuivre le reste de la cohorte.",
          }
        : null,
    };

    studentDashboardServiceCache.set(cacheKey, {
      data: result,
      expiresAt: nowMs + DASHBOARD_SERVICE_CACHE_TTL_MS,
    });

    return result;
  }
}
