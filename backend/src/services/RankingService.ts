import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export interface StudentRankingEntryDTO {
  userId: string;
  name: string;
  avatarUrl: string | null;
  rank: number | null;
  average: number;
  points: number;
  maxPossiblePoints: number;
  completedLessons: number;
  totalLessons: number;
  completedModules?: number;
  totalModules?: number;
  isEligible: boolean;
  ineligibilityReason: string | null;
  rankChange: number | null;
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  isCurrentStudent?: boolean;
}

export interface ModuleRankingDTO {
  moduleId: string;
  orderIndex: number;
  title: { en: string; fr: string };
  totalLessons: number;
  studentScore?: number | null;
  studentRank?: number | null;
  studentCompletedLessons?: number;
  entries?: StudentRankingEntryDTO[];
}

export interface CohortRankingSnapshotDTO {
  id: string;
  cohortId: string;
  cohortName: { en: string; fr: string };
  academicRuleVersion: string;
  status: "CALCULATING" | "PUBLISHED" | "FAILED";
  totalStudents: number;
  eligibleStudents: number;
  cohortAverage: number;
  calculatedAt: string;
  calculatedBy: string;
  totalLessons?: number;
  totalRequiredModules?: number;
  studentEntry?: StudentRankingEntryDTO | null;
  topPerformers?: StudentRankingEntryDTO[];
  entries?: StudentRankingEntryDTO[];
  modules?: ModuleRankingDTO[];
}

export class RankingService {
  private static activeRecalculations = new Set<string>();

  /**
   * Helper to assign medals based on rank
   */
  public static getMedal(rank: number | null): "GOLD" | "SILVER" | "BRONZE" | null {
    if (rank === 1) return "GOLD";
    if (rank === 2) return "SILVER";
    if (rank === 3) return "BRONZE";
    return null;
  }

  /**
   * Safely formats display name from user and profile data
   */
  private static formatDisplayName(row: any): string {
    const profileName = `${row.first_name || ""} ${row.last_name || ""}`.trim();
    if (profileName) return profileName;
    if (row.name && row.name.trim()) return row.name.trim();
    if (row.email) {
      const parts = row.email.split("@")[0].split(/[._-]/);
      return parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
    return "Student";
  }

  /**
   * Recalculates cohort academic rankings deterministically and records an immutable snapshot.
   * Concurrency-safe: drops redundant simultaneous triggers for the same cohort.
   */
  static async recalculateCohortRanking(
    cohortId: string,
    triggeredBy: string = "SYSTEM"
  ): Promise<CohortRankingSnapshotDTO | null> {
    if (!cohortId) return null;

    if (this.activeRecalculations.has(cohortId)) {
      console.log(`[RankingService] Recalculation already in progress for cohort ${cohortId}. Skipping duplicate.`);
      return null;
    }

    this.activeRecalculations.add(cohortId);

    const client = await pool.connect();
    try {
      // 1. Fetch cohort details
      const cohortRes = await client.query(
        `SELECT c.id, c.program_id, c.name_en, c.name_fr, c.passing_score
         FROM cohorts c
         WHERE c.id = $1`,
        [cohortId]
      );

      if (cohortRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
      }

      const cohort = cohortRes.rows[0];

      // 2. Fetch all published modules in this cohort or its parent program
      const modulesRes = await client.query(
        `SELECT m.id, m.order_index, m.title_en, m.title_fr, m.passing_score
         FROM modules m
         WHERE (m.cohort_id = $1 OR (m.program_id = $2 AND m.cohort_id IS NULL))
           AND (m.status IS NULL OR m.status = 'PUBLISHED')
         ORDER BY m.order_index ASC`,
        [cohortId, cohort.program_id]
      );

      const moduleIds = modulesRes.rows.map((m) => m.id);
      const totalRequiredModules = moduleIds.length;

      // 3. Fetch all published lessons across these modules
      const lessonsRes = moduleIds.length > 0
        ? await client.query(
            `SELECT l.id, l.module_id, l.order_index, l.title_en, l.title_fr, l.mandatory
             FROM lessons l
             WHERE l.module_id = ANY($1::uuid[])
               AND (l.status IS NULL OR l.status != 'ARCHIVED')
             ORDER BY l.module_id, l.order_index ASC`,
            [moduleIds]
          )
        : { rows: [] };

      const allLessons = lessonsRes.rows;
      const lessonIds = allLessons.map((l) => l.id);
      const totalCohortLessons = allLessons.length;
      const maxCohortPoints = totalCohortLessons * 100.0;

      // Group lessons by module
      const lessonsByModule = new Map<string, any[]>();
      for (const mId of moduleIds) {
        lessonsByModule.set(mId, []);
      }
      for (const l of allLessons) {
        const list = lessonsByModule.get(l.module_id) || [];
        list.push(l);
        lessonsByModule.set(l.module_id, list);
      }

      // 4. Fetch all enrolled students
      const studentsRes = await client.query(
        `SELECT e.user_id, e.status as enrollment_status, e.payment_status,
                u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE e.cohort_id = $1`,
        [cohortId]
      );

      const enrolledStudents = studentsRes.rows;

      // 5. Fetch lesson progress for these lessons
      const lessonProgressRes = lessonIds.length > 0
        ? await client.query(
            `SELECT lp.user_id, lp.lesson_id, lp.module_id, lp.completed, lp.video_percent
             FROM lesson_progress lp
             WHERE lp.lesson_id = ANY($1::uuid[])`,
            [lessonIds]
          )
        : { rows: [] };

      // Map: user_id -> lesson_id -> lesson_progress
      const lessonProgressByUser = new Map<string, Map<string, any>>();
      for (const row of lessonProgressRes.rows) {
        let uMap = lessonProgressByUser.get(row.user_id);
        if (!uMap) {
          uMap = new Map<string, any>();
          lessonProgressByUser.set(row.user_id, uMap);
        }
        uMap.set(row.lesson_id, row);
      }

      // 6. Fetch attached quizzes on lessons and modules
      const quizzesRes = (lessonIds.length > 0 || moduleIds.length > 0)
        ? await client.query(
            `SELECT q.id, q.lesson_id, q.module_id, q.passing_score
             FROM quizzes q
             WHERE (q.lesson_id = ANY($1::uuid[]) OR q.module_id = ANY($2::uuid[]))
               AND (q.published = TRUE OR q.status = 'PUBLISHED')`,
            [lessonIds, moduleIds]
          )
        : { rows: [] };

      const quizzesByLessonId = new Map<string, any>();
      const quizzesByModuleId = new Map<string, any>();
      const allQuizIds: string[] = [];

      for (const q of quizzesRes.rows) {
        allQuizIds.push(q.id);
        if (q.lesson_id) quizzesByLessonId.set(q.lesson_id, q);
        if (q.module_id) quizzesByModuleId.set(q.module_id, q);
      }

      // 7. Fetch best quiz attempt scores per user
      const quizAttemptsRes = (allQuizIds.length > 0 || lessonIds.length > 0 || moduleIds.length > 0)
        ? await client.query(
            `SELECT qa.user_id, qa.quiz_id, qa.lesson_id, qa.module_id,
                    MAX(qa.percentage) as best_score,
                    BOOL_OR(qa.passed) as has_passed
             FROM quiz_attempts qa
             WHERE (qa.cohort_id = $1 OR qa.cohort_id IS NULL)
               AND (
                 qa.quiz_id = ANY($2::uuid[])
                 OR qa.lesson_id = ANY($3::uuid[])
                 OR qa.module_id = ANY($4::uuid[])
               )
             GROUP BY qa.user_id, qa.quiz_id, qa.lesson_id, qa.module_id`,
            [cohortId, allQuizIds, lessonIds, moduleIds]
          )
        : { rows: [] };

      // Map: user_id -> quiz_id / lesson_id -> attempt
      const attemptsByUserLesson = new Map<string, Map<string, any>>();
      const attemptsByUserQuiz = new Map<string, Map<string, any>>();

      for (const row of quizAttemptsRes.rows) {
        if (row.lesson_id) {
          let map = attemptsByUserLesson.get(row.user_id);
          if (!map) {
            map = new Map<string, any>();
            attemptsByUserLesson.set(row.user_id, map);
          }
          map.set(row.lesson_id, row);
        }
        if (row.quiz_id) {
          let map = attemptsByUserQuiz.get(row.user_id);
          if (!map) {
            map = new Map<string, any>();
            attemptsByUserQuiz.set(row.user_id, map);
          }
          map.set(row.quiz_id, row);
        }
      }

      // 8. Helper to determine individual lesson score and completion for a user
      const evaluateLesson = (userId: string, lesson: any) => {
        const uProgMap = lessonProgressByUser.get(userId);
        const lp = uProgMap ? uProgMap.get(lesson.id) : null;
        const attachedQuiz = quizzesByLessonId.get(lesson.id);

        let isCompleted = false;
        let score = 0; // provisional 0 for unfinished lessons

        if (attachedQuiz) {
          const attempt =
            attemptsByUserLesson.get(userId)?.get(lesson.id) ||
            attemptsByUserQuiz.get(userId)?.get(attachedQuiz.id);

          if (attempt) {
            score = Math.min(100, Math.max(0, Number(attempt.best_score) || 0));
            isCompleted = attempt.has_passed || (lp && lp.completed) || (lp && Number(lp.video_percent) >= 80);
          } else if (lp && (lp.completed || Number(lp.video_percent) >= 80)) {
            // Lesson marked complete before quiz attempt
            score = 100;
            isCompleted = true;
          }
        } else {
          // Standard lesson (video / reading / activity without quiz)
          if (lp && (lp.completed || Number(lp.video_percent) >= 80)) {
            score = 100;
            isCompleted = true;
          }
        }

        return { score, isCompleted };
      };

      // 9. Evaluate each student's Overall and Per-Module performance
      interface EvaluatedStudentOverall {
        userId: string;
        name: string;
        avatarUrl: string | null;
        isEligible: boolean;
        ineligibilityReason: string | null;
        completedLessons: number;
        totalLessons: number;
        points: number;
        maxPossiblePoints: number;
        average: number; // Formula: total points / total lessons
        rank: number | null;
      }

      interface EvaluatedStudentModule {
        moduleId: string;
        userId: string;
        name: string;
        avatarUrl: string | null;
        isEligible: boolean;
        ineligibilityReason: string | null;
        completedLessons: number;
        totalLessons: number;
        points: number;
        maxPossiblePoints: number;
        score: number; // Formula: module points / module total lessons
        rank: number | null;
      }

      const evaluatedOverall: EvaluatedStudentOverall[] = [];
      const evaluatedByModule = new Map<string, EvaluatedStudentModule[]>();

      for (const mId of moduleIds) {
        evaluatedByModule.set(mId, []);
      }

      for (const st of enrolledStudents) {
        const displayName = this.formatDisplayName(st);

        // Check administrative and financial eligibility
        let isEligible = true;
        let ineligibilityReason: string | null = null;

        if (st.enrollment_status === "DISQUALIFIED") {
          isEligible = false;
          ineligibilityReason = "DISQUALIFIED";
        } else if (st.enrollment_status === "DROPPED") {
          isEligible = false;
          ineligibilityReason = "DROPPED";
        } else if (st.enrollment_status === "SUSPENDED") {
          isEligible = false;
          ineligibilityReason = "SUSPENDED";
        } else if (st.payment_status !== "PAID" && st.payment_status !== "NOT_REQUIRED") {
          isEligible = false;
          ineligibilityReason = "PAYMENT_PENDING";
        }

        let overallPoints = 0;
        let overallCompletedLessons = 0;

        // Evaluate each module for this student
        for (const m of modulesRes.rows) {
          const modLessons = lessonsByModule.get(m.id) || [];
          const modTotal = modLessons.length;
          let modPoints = 0;
          let modCompleted = 0;

          for (const l of modLessons) {
            const res = evaluateLesson(st.user_id, l);
            modPoints += res.score;
            if (res.isCompleted) {
              modCompleted++;
            }
          }

          overallPoints += modPoints;
          overallCompletedLessons += modCompleted;

          const modScore = modTotal > 0 ? Number((modPoints / modTotal).toFixed(2)) : 0.0;
          const modMaxPts = modTotal * 100.0;

          const modEntries = evaluatedByModule.get(m.id)!;
          modEntries.push({
            moduleId: m.id,
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible,
            ineligibilityReason,
            completedLessons: modCompleted,
            totalLessons: modTotal,
            points: Number(modPoints.toFixed(2)),
            maxPossiblePoints: modMaxPts,
            score: modScore,
            rank: null,
          });
        }

        // Formula: Overall average = Total points obtained ÷ Total curriculum lessons
        // (Unfinished lessons count as 0 provisional points)
        const overallAvg = totalCohortLessons > 0 ? Number((overallPoints / totalCohortLessons).toFixed(2)) : 0.0;

        evaluatedOverall.push({
          userId: st.user_id,
          name: displayName,
          avatarUrl: st.avatar_url || null,
          isEligible,
          ineligibilityReason,
          completedLessons: overallCompletedLessons,
          totalLessons: totalCohortLessons,
          points: Number(overallPoints.toFixed(2)),
          maxPossiblePoints: maxCohortPoints,
          average: overallAvg,
          rank: null,
        });
      }

      // 10. Apply Standard Competition Ranking ("1224" rule) for Overall Cohort
      const eligibleOverall = evaluatedOverall.filter((s) => s.isEligible);
      eligibleOverall.sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        if (b.points !== a.points) return b.points - a.points;
        return b.completedLessons - a.completedLessons;
      });

      for (let i = 0; i < eligibleOverall.length; i++) {
        if (i > 0) {
          const prev = eligibleOverall[i - 1];
          const curr = eligibleOverall[i];
          if (curr.average === prev.average) {
            curr.rank = prev.rank; // Shared rank
          } else {
            curr.rank = i + 1; // Standard competition jump (1, 2, 2, 4...)
          }
        } else {
          eligibleOverall[0].rank = 1;
        }
      }

      // 11. Apply Standard Competition Ranking for Each Module
      for (const m of modulesRes.rows) {
        const modEntries = evaluatedByModule.get(m.id) || [];
        const eligibleMod = modEntries.filter((s) => s.isEligible);
        eligibleMod.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.points !== a.points) return b.points - a.points;
          return b.completedLessons - a.completedLessons;
        });

        for (let i = 0; i < eligibleMod.length; i++) {
          if (i > 0) {
            const prev = eligibleMod[i - 1];
            const curr = eligibleMod[i];
            if (curr.score === prev.score) {
              curr.rank = prev.rank;
            } else {
              curr.rank = i + 1;
            }
          } else {
            eligibleMod[0].rank = 1;
          }
        }
      }

      // 12. Calculate summary statistics
      const totalStudentsCount = enrolledStudents.length;
      const eligibleStudentsCount = eligibleOverall.length;
      const cohortAverage =
        eligibleStudentsCount > 0
          ? Number(
              (
                eligibleOverall.reduce((acc, s) => acc + s.average, 0) /
                eligibleStudentsCount
              ).toFixed(2)
            )
          : 0.0;

      // 13. Fetch previous snapshot for movement tracking
      const priorSnapshotRes = await client.query(
        `SELECT id 
         FROM cohort_ranking_snapshots
         WHERE cohort_id = $1 AND status = 'PUBLISHED'
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [cohortId]
      );

      const previousRankMap = new Map<string, number>();
      const previousModuleRankMap = new Map<string, Map<string, number>>();

      if (priorSnapshotRes.rows.length > 0) {
        const priorId = priorSnapshotRes.rows[0].id;

        // Prior overall ranks
        const priorEntriesRes = await client.query(
          `SELECT user_id, rank
           FROM cohort_ranking_entries
           WHERE snapshot_id = $1 AND is_eligible = TRUE AND rank IS NOT NULL`,
          [priorId]
        );
        for (const row of priorEntriesRes.rows) {
          previousRankMap.set(row.user_id, Number(row.rank));
        }

        // Prior module ranks
        const priorModEntriesRes = await client.query(
          `SELECT module_id, user_id, rank
           FROM cohort_module_ranking_entries
           WHERE snapshot_id = $1 AND is_eligible = TRUE AND rank IS NOT NULL`,
          [priorId]
        );
        for (const row of priorModEntriesRes.rows) {
          let modMap = previousModuleRankMap.get(row.module_id);
          if (!modMap) {
            modMap = new Map<string, number>();
            previousModuleRankMap.set(row.module_id, modMap);
          }
          modMap.set(row.user_id, Number(row.rank));
        }
      }

      // 14. Persist snapshot, overall entries, and module entries in atomic transaction
      await client.query("BEGIN");

      const insertSnapshotRes = await client.query(
        `INSERT INTO cohort_ranking_snapshots (
           cohort_id, academic_rule_version, status, total_students, eligible_students,
           cohort_average, calculated_at, calculated_by
         )
         VALUES ($1, 'v2.0-lesson-weighted-competition', 'PUBLISHED', $2, $3, $4, NOW(), $5)
         RETURNING id, calculated_at`,
        [cohortId, totalStudentsCount, eligibleStudentsCount, cohortAverage, triggeredBy]
      );

      const snapshotId = insertSnapshotRes.rows[0].id;
      const calculatedAt = insertSnapshotRes.rows[0].calculated_at.toISOString();

      const finalOverallEntries: StudentRankingEntryDTO[] = [];

      for (const st of evaluatedOverall) {
        let rankChange: number | null = null;
        if (st.isEligible && st.rank !== null) {
          if (previousRankMap.has(st.userId)) {
            const prevRank = previousRankMap.get(st.userId)!;
            rankChange = prevRank - st.rank; // Positive = gained places, Negative = lost places
          } else {
            rankChange = null; // New to ranking
          }
        }

        await client.query(
          `INSERT INTO cohort_ranking_entries (
             snapshot_id, cohort_id, user_id, rank, average, points,
             completed_modules, total_required_modules,
             completed_lessons, total_lessons, max_possible_points,
             is_eligible, ineligibility_reason, rank_change
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            snapshotId,
            cohortId,
            st.userId,
            st.rank,
            st.average,
            st.points,
            0,
            totalRequiredModules,
            st.completedLessons,
            st.totalLessons,
            st.maxPossiblePoints,
            st.isEligible,
            st.ineligibilityReason,
            rankChange,
          ]
        );

        finalOverallEntries.push({
          userId: st.userId,
          name: st.name,
          avatarUrl: st.avatarUrl,
          rank: st.rank,
          average: st.average,
          points: st.points,
          maxPossiblePoints: st.maxPossiblePoints,
          completedLessons: st.completedLessons,
          totalLessons: st.totalLessons,
          completedModules: 0,
          totalModules: totalRequiredModules,
          isEligible: st.isEligible,
          ineligibilityReason: st.ineligibilityReason,
          rankChange,
          medal: this.getMedal(st.rank),
        });
      }

      // Persist module entries
      for (const m of modulesRes.rows) {
        const modEntries = evaluatedByModule.get(m.id) || [];
        const priorModRanks = previousModuleRankMap.get(m.id);

        for (const st of modEntries) {
          let modRankChange: number | null = null;
          if (st.isEligible && st.rank !== null) {
            if (priorModRanks && priorModRanks.has(st.userId)) {
              modRankChange = priorModRanks.get(st.userId)! - st.rank;
            } else {
              modRankChange = null;
            }
          }

          await client.query(
            `INSERT INTO cohort_module_ranking_entries (
               snapshot_id, cohort_id, module_id, user_id, rank, score, points,
               completed_lessons, total_lessons, max_possible_points,
               is_eligible, ineligibility_reason, rank_change
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              snapshotId,
              cohortId,
              m.id,
              st.userId,
              st.rank,
              st.score,
              st.points,
              st.completedLessons,
              st.totalLessons,
              st.maxPossiblePoints,
              st.isEligible,
              st.ineligibilityReason,
              modRankChange,
            ]
          );
        }
      }

      await client.query("COMMIT");

      return {
        id: snapshotId,
        cohortId,
        cohortName: { en: cohort.name_en, fr: cohort.name_fr },
        academicRuleVersion: "v2.0-lesson-weighted-competition",
        status: "PUBLISHED",
        totalStudents: totalStudentsCount,
        eligibleStudents: eligibleStudentsCount,
        cohortAverage,
        totalLessons: totalCohortLessons,
        totalRequiredModules,
        calculatedAt,
        calculatedBy: triggeredBy,
        entries: finalOverallEntries,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[RankingService] Failed to calculate rankings for cohort ${cohortId}:`, error);
      throw error;
    } finally {
      this.activeRecalculations.delete(cohortId);
      client.release();
    }
  }

  /**
   * Retrieves or automatically calculates the latest published snapshot for a cohort
   */
  static async getLatestSnapshot(cohortId: string): Promise<any | null> {
    const snapshotRes = await pool.query(
      `SELECT s.*, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr
       FROM cohort_ranking_snapshots s
       JOIN cohorts c ON c.id = s.cohort_id
       WHERE s.cohort_id = $1 AND s.status = 'PUBLISHED'
       ORDER BY s.calculated_at DESC
       LIMIT 1`,
      [cohortId]
    );

    if (snapshotRes.rows.length === 0) {
      return await this.recalculateCohortRanking(cohortId, "INITIAL_SYSTEM");
    }

    const s = snapshotRes.rows[0];
    return {
      id: s.id,
      cohortId: s.cohort_id,
      cohortName: { en: s.cohort_name_en, fr: s.cohort_name_fr },
      academicRuleVersion: s.academic_rule_version,
      status: s.status,
      totalStudents: s.total_students,
      eligibleStudents: s.eligible_students,
      cohortAverage: Number(s.cohort_average),
      calculatedAt: s.calculated_at.toISOString(),
      calculatedBy: s.calculated_by,
    };
  }

  /**
   * Returns authenticated student's personalized ranking performance summary
   * Supports optional targetModuleId to retrieve specific module ranking
   */
  static async getStudentRankingSummary(
    userId: string,
    targetCohortId?: string,
    targetModuleId?: string
  ) {
    let cohortId = targetCohortId;
    if (!cohortId) {
      const enrollRes = await pool.query(
        `SELECT cohort_id 
         FROM enrollments 
         WHERE user_id = $1 AND status IN ('ACTIVE', 'COMPLETED')
         ORDER BY enrolled_at DESC 
         LIMIT 1`,
        [userId]
      );
      if (enrollRes.rows.length === 0) {
        return null;
      }
      cohortId = enrollRes.rows[0].cohort_id;
    }

    let snapshot = await this.getLatestSnapshot(cohortId!);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId!, "STUDENT_REQUEST");
    }

    if (!snapshot) {
      return null;
    }

    // Fetch cohort modules list with per-module student performance
    const modulesRes = await pool.query(
      `SELECT m.id, m.order_index, m.title_en, m.title_fr,
              (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id AND (l.status IS NULL OR l.status != 'ARCHIVED'))::int as total_lessons,
              cm.score, cm.rank, cm.completed_lessons, cm.points
       FROM modules m
       JOIN cohorts c ON c.id = $1
       LEFT JOIN cohort_module_ranking_entries cm ON cm.snapshot_id = $2 AND cm.module_id = m.id AND cm.user_id = $3
       WHERE (m.cohort_id = $1 OR (m.program_id = c.program_id AND m.cohort_id IS NULL))
         AND (m.status IS NULL OR m.status = 'PUBLISHED')
       ORDER BY m.order_index ASC`,
      [cohortId, snapshot.id, userId]
    );

    const modules: ModuleRankingDTO[] = modulesRes.rows.map((row) => ({
      moduleId: row.id,
      orderIndex: row.order_index,
      title: { en: row.title_en, fr: row.title_fr },
      totalLessons: row.total_lessons || 0,
      studentScore: row.score !== null ? Number(row.score) : null,
      studentRank: row.rank !== null ? Number(row.rank) : null,
      studentCompletedLessons: row.completed_lessons || 0,
    }));

    // Is a specific module selected?
    const isModuleScoped = targetModuleId && targetModuleId !== "all";

    let studentEntry: StudentRankingEntryDTO | null = null;
    let topPerformers: StudentRankingEntryDTO[] = [];

    if (isModuleScoped) {
      // Query specific module entry
      const modStudentRes = await pool.query(
        `SELECT cm.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_module_ranking_entries cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE cm.snapshot_id = $1 AND cm.module_id = $2 AND cm.user_id = $3`,
        [snapshot.id, targetModuleId, userId]
      );

      const se = modStudentRes.rows[0];
      if (se) {
        studentEntry = {
          userId: se.user_id,
          name: this.formatDisplayName(se),
          avatarUrl: se.avatar_url,
          rank: se.rank !== null ? Number(se.rank) : null,
          average: Number(se.score),
          points: Number(se.points),
          maxPossiblePoints: Number(se.max_possible_points),
          completedLessons: se.completed_lessons,
          totalLessons: se.total_lessons,
          isEligible: se.is_eligible,
          ineligibilityReason: se.ineligibility_reason,
          rankChange: se.rank_change !== null ? Number(se.rank_change) : null,
          medal: this.getMedal(se.rank !== null ? Number(se.rank) : null),
          isCurrentStudent: true,
        };
      }

      // Top performers in this module
      const topRes = await pool.query(
        `SELECT cm.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_module_ranking_entries cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE cm.snapshot_id = $1 AND cm.module_id = $2 AND cm.is_eligible = TRUE AND cm.rank <= 3
         ORDER BY cm.rank ASC, cm.score DESC, cm.points DESC`,
        [snapshot.id, targetModuleId]
      );

      topPerformers = topRes.rows.map((row) => ({
        userId: row.user_id,
        name: this.formatDisplayName(row),
        avatarUrl: row.avatar_url,
        rank: Number(row.rank),
        average: Number(row.score),
        points: Number(row.points),
        maxPossiblePoints: Number(row.max_possible_points),
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        isEligible: true,
        ineligibilityReason: null,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(Number(row.rank)),
        isCurrentStudent: row.user_id === userId,
      }));
    } else {
      // Overall Cohort Entry
      const studentEntryRes = await pool.query(
        `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_ranking_entries e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE e.snapshot_id = $1 AND e.user_id = $2`,
        [snapshot.id, userId]
      );

      const se = studentEntryRes.rows[0];
      if (se) {
        studentEntry = {
          userId: se.user_id,
          name: this.formatDisplayName(se),
          avatarUrl: se.avatar_url,
          rank: se.rank !== null ? Number(se.rank) : null,
          average: Number(se.average),
          points: Number(se.points),
          maxPossiblePoints: Number(se.max_possible_points),
          completedLessons: se.completed_lessons,
          totalLessons: se.total_lessons,
          completedModules: se.completed_modules,
          totalModules: se.total_required_modules,
          isEligible: se.is_eligible,
          ineligibilityReason: se.ineligibility_reason,
          rankChange: se.rank_change !== null ? Number(se.rank_change) : null,
          medal: this.getMedal(se.rank !== null ? Number(se.rank) : null),
          isCurrentStudent: true,
        };
      }

      // Top 3 Overall performers
      const topPerformersRes = await pool.query(
        `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_ranking_entries e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE e.snapshot_id = $1 AND e.is_eligible = TRUE AND e.rank <= 3
         ORDER BY e.rank ASC, e.average DESC, e.points DESC`,
        [snapshot.id]
      );

      topPerformers = topPerformersRes.rows.map((row) => ({
        userId: row.user_id,
        name: this.formatDisplayName(row),
        avatarUrl: row.avatar_url,
        rank: Number(row.rank),
        average: Number(row.average),
        points: Number(row.points),
        maxPossiblePoints: Number(row.max_possible_points),
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        isEligible: true,
        ineligibilityReason: null,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(Number(row.rank)),
        isCurrentStudent: row.user_id === userId,
      }));
    }

    return {
      cohortId,
      cohortName: snapshot.cohortName,
      snapshotId: snapshot.id,
      calculatedAt: snapshot.calculatedAt,
      totalStudents: snapshot.totalStudents,
      eligibleStudents: snapshot.eligibleStudents,
      cohortAverage: snapshot.cohortAverage,
      totalLessons: snapshot.totalLessons || modules.reduce((a, b) => a + b.totalLessons, 0),
      studentEntry,
      topPerformers,
      modules,
    };
  }

  /**
   * Retrieves safe, scoped cohort leaderboard data for students and instructors
   * Supports optional targetModuleId for per-module filtering
   */
  static async getCohortLeaderboard(
    cohortId: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 50,
    targetModuleId?: string
  ) {
    let snapshot = await this.getLatestSnapshot(cohortId);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId, "LEADERBOARD_REQUEST");
    }

    if (!snapshot) {
      return { entries: [], total: 0, snapshot: null };
    }

    const offset = Math.max(0, (page - 1) * limit);
    const isModuleScoped = targetModuleId && targetModuleId !== "all";

    if (isModuleScoped) {
      // Query per-module ranking table
      const countRes = await pool.query(
        `SELECT COUNT(*) as total
         FROM cohort_module_ranking_entries
         WHERE snapshot_id = $1 AND module_id = $2 AND is_eligible = TRUE`,
        [snapshot.id, targetModuleId]
      );
      const total = parseInt(countRes.rows[0]?.total || "0", 10);

      const entriesRes = await pool.query(
        `SELECT cm.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_module_ranking_entries cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE cm.snapshot_id = $1 AND cm.module_id = $2 AND cm.is_eligible = TRUE
         ORDER BY cm.rank ASC, cm.score DESC, cm.points DESC
         LIMIT $3 OFFSET $4`,
        [snapshot.id, targetModuleId, limit, offset]
      );

      const entries: StudentRankingEntryDTO[] = entriesRes.rows.map((row) => ({
        userId: row.user_id,
        name: this.formatDisplayName(row),
        avatarUrl: row.avatar_url,
        rank: Number(row.rank),
        average: Number(row.score),
        points: Number(row.points),
        maxPossiblePoints: Number(row.max_possible_points),
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        isEligible: true,
        ineligibilityReason: null,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(Number(row.rank)),
        isCurrentStudent: row.user_id === currentUserId,
      }));

      return {
        snapshot: {
          id: snapshot.id,
          cohortId: snapshot.cohortId,
          cohortName: snapshot.cohortName,
          totalStudents: snapshot.totalStudents,
          eligibleStudents: snapshot.eligibleStudents,
          cohortAverage: snapshot.cohortAverage,
          calculatedAt: snapshot.calculatedAt,
        },
        entries,
        total,
        page,
        limit,
        moduleId: targetModuleId,
      };
    }

    // Default: Overall Cohort Leaderboard
    const entriesRes = await pool.query(
      `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
       FROM cohort_ranking_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE e.snapshot_id = $1 AND e.is_eligible = TRUE
       ORDER BY e.rank ASC, e.average DESC, e.points DESC
       LIMIT $2 OFFSET $3`,
      [snapshot.id, limit, offset]
    );

    const entries: StudentRankingEntryDTO[] = entriesRes.rows.map((row) => ({
      userId: row.user_id,
      name: this.formatDisplayName(row),
      avatarUrl: row.avatar_url,
      rank: Number(row.rank),
      average: Number(row.average),
      points: Number(row.points),
      maxPossiblePoints: Number(row.max_possible_points),
      completedLessons: row.completed_lessons,
      totalLessons: row.total_lessons,
      completedModules: row.completed_modules,
      totalModules: row.total_required_modules,
      isEligible: true,
      ineligibilityReason: null,
      rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
      medal: this.getMedal(Number(row.rank)),
      isCurrentStudent: row.user_id === currentUserId,
    }));

    return {
      snapshot: {
        id: snapshot.id,
        cohortId: snapshot.cohortId,
        cohortName: snapshot.cohortName,
        totalStudents: snapshot.totalStudents,
        eligibleStudents: snapshot.eligibleStudents,
        cohortAverage: snapshot.cohortAverage,
        calculatedAt: snapshot.calculatedAt,
      },
      entries,
      total: snapshot.eligibleStudents,
      page,
      limit,
      moduleId: "all",
    };
  }

  /**
   * Admin-only overview of cohort rankings including eligible & ineligible students
   */
  static async getAdminCohortRankings(cohortId: string, targetModuleId?: string) {
    let snapshot = await this.getLatestSnapshot(cohortId);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId, "ADMIN_VIEW");
    }

    if (!snapshot) {
      return null;
    }

    // Fetch cohort modules list
    const modulesRes = await pool.query(
      `SELECT m.id, m.order_index, m.title_en, m.title_fr,
              (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id AND (l.status IS NULL OR l.status != 'ARCHIVED'))::int as total_lessons
       FROM modules m
       JOIN cohorts c ON c.id = $1
       WHERE (m.cohort_id = $1 OR (m.program_id = c.program_id AND m.cohort_id IS NULL))
         AND (m.status IS NULL OR m.status = 'PUBLISHED')
       ORDER BY m.order_index ASC`,
      [cohortId]
    );

    const modules = modulesRes.rows.map((row) => ({
      moduleId: row.id,
      orderIndex: row.order_index,
      title: { en: row.title_en, fr: row.title_fr },
      totalLessons: row.total_lessons || 0,
    }));

    const isModuleScoped = targetModuleId && targetModuleId !== "all";

    let eligibleList: StudentRankingEntryDTO[] = [];
    let ineligibleList: StudentRankingEntryDTO[] = [];

    if (isModuleScoped) {
      const allEntriesRes = await pool.query(
        `SELECT cm.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_module_ranking_entries cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE cm.snapshot_id = $1 AND cm.module_id = $2
         ORDER BY 
           CASE WHEN cm.is_eligible THEN 0 ELSE 1 END,
           cm.rank ASC NULLS LAST,
           cm.score DESC`,
        [snapshot.id, targetModuleId]
      );

      for (const row of allEntriesRes.rows) {
        const entry: StudentRankingEntryDTO = {
          userId: row.user_id,
          name: this.formatDisplayName(row),
          avatarUrl: row.avatar_url,
          rank: row.rank !== null ? Number(row.rank) : null,
          average: Number(row.score),
          points: Number(row.points),
          maxPossiblePoints: Number(row.max_possible_points),
          completedLessons: row.completed_lessons,
          totalLessons: row.total_lessons,
          isEligible: row.is_eligible,
          ineligibilityReason: row.ineligibility_reason,
          rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
          medal: this.getMedal(row.rank !== null ? Number(row.rank) : null),
        };

        if (row.is_eligible) eligibleList.push(entry);
        else ineligibleList.push(entry);
      }
    } else {
      const allEntriesRes = await pool.query(
        `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
         FROM cohort_ranking_entries e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE e.snapshot_id = $1
         ORDER BY 
           CASE WHEN e.is_eligible THEN 0 ELSE 1 END,
           e.rank ASC NULLS LAST,
           e.average DESC`,
        [snapshot.id]
      );

      for (const row of allEntriesRes.rows) {
        const entry: StudentRankingEntryDTO = {
          userId: row.user_id,
          name: this.formatDisplayName(row),
          avatarUrl: row.avatar_url,
          rank: row.rank !== null ? Number(row.rank) : null,
          average: Number(row.average),
          points: Number(row.points),
          maxPossiblePoints: Number(row.max_possible_points),
          completedLessons: row.completed_lessons,
          totalLessons: row.total_lessons,
          completedModules: row.completed_modules,
          totalModules: row.total_required_modules,
          isEligible: row.is_eligible,
          ineligibilityReason: row.ineligibility_reason,
          rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
          medal: this.getMedal(row.rank !== null ? Number(row.rank) : null),
        };

        if (row.is_eligible) eligibleList.push(entry);
        else ineligibleList.push(entry);
      }
    }

    const snapshotsListRes = await pool.query(
      `SELECT id, academic_rule_version, status, total_students, eligible_students, cohort_average, calculated_at, calculated_by
       FROM cohort_ranking_snapshots
       WHERE cohort_id = $1
       ORDER BY calculated_at DESC
       LIMIT 15`,
      [cohortId]
    );

    return {
      snapshot: {
        id: snapshot.id,
        cohortId: snapshot.cohortId,
        cohortName: snapshot.cohortName,
        academicRuleVersion: snapshot.academicRuleVersion,
        totalStudents: snapshot.totalStudents,
        eligibleStudents: snapshot.eligibleStudents,
        cohortAverage: snapshot.cohortAverage,
        calculatedAt: snapshot.calculatedAt,
        calculatedBy: snapshot.calculatedBy,
      },
      eligible: eligibleList,
      ineligible: ineligibleList,
      modules,
      historicalSnapshots: snapshotsListRes.rows.map((s) => ({
        id: s.id,
        version: s.academic_rule_version,
        status: s.status,
        totalStudents: s.total_students,
        eligibleStudents: s.eligible_students,
        cohortAverage: Number(s.cohort_average),
        calculatedAt: s.calculated_at.toISOString(),
        calculatedBy: s.calculated_by,
      })),
    };
  }

  /**
   * Retrieves entries for a specific historical snapshot
   */
  static async getSnapshotDetails(snapshotId: string) {
    const snapshotRes = await pool.query(
      `SELECT s.*, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr
       FROM cohort_ranking_snapshots s
       JOIN cohorts c ON c.id = s.cohort_id
       WHERE s.id = $1`,
      [snapshotId]
    );

    if (snapshotRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Snapshot not found");
    }

    const s = snapshotRes.rows[0];

    const entriesRes = await pool.query(
      `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
       FROM cohort_ranking_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE e.snapshot_id = $1
       ORDER BY 
         CASE WHEN e.is_eligible THEN 0 ELSE 1 END,
         e.rank ASC NULLS LAST,
         e.average DESC`,
      [snapshotId]
    );

    return {
      snapshot: {
        id: s.id,
        cohortId: s.cohort_id,
        cohortName: { en: s.cohort_name_en, fr: s.cohort_name_fr },
        academicRuleVersion: s.academic_rule_version,
        status: s.status,
        totalStudents: s.total_students,
        eligibleStudents: s.eligible_students,
        cohortAverage: Number(s.cohort_average),
        calculatedAt: s.calculated_at.toISOString(),
        calculatedBy: s.calculated_by,
      },
      entries: entriesRes.rows.map((row) => ({
        userId: row.user_id,
        name: this.formatDisplayName(row),
        avatarUrl: row.avatar_url,
        rank: row.rank !== null ? Number(row.rank) : null,
        average: Number(row.average),
        points: Number(row.points),
        maxPossiblePoints: Number(row.max_possible_points),
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        isEligible: row.is_eligible,
        ineligibilityReason: row.ineligibility_reason,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(row.rank !== null ? Number(row.rank) : null),
      })),
    };
  }
}
