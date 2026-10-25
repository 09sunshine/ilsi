import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export interface StudentRankingEntryDTO {
  userId: string;
  name: string;
  avatarUrl: string | null;
  rank: number | null;
  average: number;
  points: number;
  completedModules: number;
  totalModules: number;
  isEligible: boolean;
  ineligibilityReason: string | null;
  rankChange: number | null;
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  isCurrentStudent?: boolean;
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
  studentEntry?: StudentRankingEntryDTO | null;
  topPerformers?: StudentRankingEntryDTO[];
  entries?: StudentRankingEntryDTO[];
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
        `SELECT m.id, m.order_index, m.passing_score
         FROM modules m
         WHERE (m.cohort_id = $1 OR (m.program_id = $2 AND m.cohort_id IS NULL))
           AND (m.status IS NULL OR m.status = 'PUBLISHED')
         ORDER BY m.order_index ASC`,
        [cohortId, cohort.program_id]
      );

      const moduleIds = modulesRes.rows.map((m) => m.id);
      const totalRequiredModules = moduleIds.length;

      // 3. Fetch all enrolled students
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

      // 4. Fetch validated module progress and quiz scores for these modules
      const progressRes = moduleIds.length > 0
        ? await client.query(
            `SELECT mp.user_id, mp.module_id, mp.completed, mp.best_quiz_score, mp.quiz_passed,
                    COALESCE(
                      (
                        SELECT MAX(qa.percentage)
                        FROM quiz_attempts qa
                        WHERE qa.user_id = mp.user_id
                          AND qa.module_id = mp.module_id
                          AND (qa.cohort_id = $1 OR qa.cohort_id IS NULL)
                      ),
                      mp.best_quiz_score,
                      0
                    ) as validated_score
             FROM module_progress mp
             WHERE mp.module_id = ANY($2::uuid[])`,
            [cohortId, moduleIds]
          )
        : { rows: [] };

      // Map progress by user_id -> module_id -> record
      const progressByUser = new Map<string, Map<string, any>>();
      for (const row of progressRes.rows) {
        let userMap = progressByUser.get(row.user_id);
        if (!userMap) {
          userMap = new Map<string, any>();
          progressByUser.set(row.user_id, userMap);
        }
        userMap.set(row.module_id, row);
      }

      // 5. Calculate eligibility and scores for each student
      interface StudentScoreData {
        userId: string;
        name: string;
        avatarUrl: string | null;
        isEligible: boolean;
        ineligibilityReason: string | null;
        completedModules: number;
        average: number;
        points: number;
        rank: number | null;
      }

      const evaluatedStudents: StudentScoreData[] = [];

      for (const st of enrolledStudents) {
        const displayName = this.formatDisplayName(st);
        const userProgress = progressByUser.get(st.user_id);

        // Check administrative and cohort eligibility
        if (st.enrollment_status === "DISQUALIFIED") {
          evaluatedStudents.push({
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible: false,
            ineligibilityReason: "DISQUALIFIED",
            completedModules: 0,
            average: 0.0,
            points: 0.0,
            rank: null,
          });
          continue;
        }

        if (st.enrollment_status === "DROPPED") {
          evaluatedStudents.push({
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible: false,
            ineligibilityReason: "DROPPED",
            completedModules: 0,
            average: 0.0,
            points: 0.0,
            rank: null,
          });
          continue;
        }

        if (st.enrollment_status === "SUSPENDED") {
          evaluatedStudents.push({
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible: false,
            ineligibilityReason: "SUSPENDED",
            completedModules: 0,
            average: 0.0,
            points: 0.0,
            rank: null,
          });
          continue;
        }

        if (st.payment_status !== "PAID" && st.payment_status !== "NOT_REQUIRED") {
          evaluatedStudents.push({
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible: false,
            ineligibilityReason: "PAYMENT_PENDING",
            completedModules: 0,
            average: 0.0,
            points: 0.0,
            rank: null,
          });
          continue;
        }

        // Count completed modules and accumulate validated scores
        let completedCount = 0;
        let scoreSum = 0;

        if (userProgress) {
          for (const mId of moduleIds) {
            const mProg = userProgress.get(mId);
            if (mProg && (mProg.completed || mProg.quiz_passed)) {
              completedCount++;
              const score = Number(mProg.validated_score) || 0;
              scoreSum += score;
            }
          }
        }

        if (completedCount === 0) {
          evaluatedStudents.push({
            userId: st.user_id,
            name: displayName,
            avatarUrl: st.avatar_url || null,
            isEligible: false,
            ineligibilityReason: "NO_COMPLETED_MODULES",
            completedModules: 0,
            average: 0.0,
            points: 0.0,
            rank: null,
          });
          continue;
        }

        const unroundedAvg = scoreSum / completedCount;
        const roundedAvg = Number(unroundedAvg.toFixed(2));
        const totalPoints = Number(scoreSum.toFixed(2));

        evaluatedStudents.push({
          userId: st.user_id,
          name: displayName,
          avatarUrl: st.avatar_url || null,
          isEligible: true,
          ineligibilityReason: null,
          completedModules: completedCount,
          average: roundedAvg,
          points: totalPoints,
          rank: null,
        });
      }

      // 6. Apply Standard Competition Ranking ("1224" ranking)
      const eligibleStudents = evaluatedStudents.filter((s) => s.isEligible);
      eligibleStudents.sort((a, b) => {
        if (b.average !== a.average) {
          return b.average - a.average;
        }
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return b.completedModules - a.completedModules;
      });

      for (let i = 0; i < eligibleStudents.length; i++) {
        if (i > 0) {
          const prev = eligibleStudents[i - 1];
          const curr = eligibleStudents[i];
          if (curr.average === prev.average) {
            curr.rank = prev.rank; // Shared competition rank
          } else {
            curr.rank = i + 1; // Standard competition jump: 1, 2, 2, 4
          }
        } else {
          eligibleStudents[0].rank = 1;
        }
      }

      // 7. Calculate cohort summary statistics
      const totalStudentsCount = enrolledStudents.length;
      const eligibleStudentsCount = eligibleStudents.length;
      const cohortAverage = eligibleStudentsCount > 0
        ? Number(
            (
              eligibleStudents.reduce((acc, s) => acc + s.average, 0) /
              eligibleStudentsCount
            ).toFixed(2)
          )
        : 0.0;

      // 8. Fetch the latest prior published snapshot to calculate movement
      const priorSnapshotRes = await client.query(
        `SELECT id 
         FROM cohort_ranking_snapshots
         WHERE cohort_id = $1 AND status = 'PUBLISHED'
         ORDER BY calculated_at DESC
         LIMIT 1`,
        [cohortId]
      );

      const previousRankMap = new Map<string, number>();
      if (priorSnapshotRes.rows.length > 0) {
        const priorId = priorSnapshotRes.rows[0].id;
        const priorEntriesRes = await client.query(
          `SELECT user_id, rank
           FROM cohort_ranking_entries
           WHERE snapshot_id = $1 AND is_eligible = TRUE AND rank IS NOT NULL`,
          [priorId]
        );
        for (const row of priorEntriesRes.rows) {
          previousRankMap.set(row.user_id, Number(row.rank));
        }
      }

      // 9. Persist snapshot and entries in database transaction
      await client.query("BEGIN");

      const insertSnapshotRes = await client.query(
        `INSERT INTO cohort_ranking_snapshots (
           cohort_id, academic_rule_version, status, total_students, eligible_students,
           cohort_average, calculated_at, calculated_by
         )
         VALUES ($1, 'v1.0-standard-competition', 'PUBLISHED', $2, $3, $4, NOW(), $5)
         RETURNING id, calculated_at`,
        [cohortId, totalStudentsCount, eligibleStudentsCount, cohortAverage, triggeredBy]
      );

      const snapshotId = insertSnapshotRes.rows[0].id;
      const calculatedAt = insertSnapshotRes.rows[0].calculated_at.toISOString();

      const finalEntries: StudentRankingEntryDTO[] = [];

      for (const st of evaluatedStudents) {
        let rankChange: number | null = null;
        if (st.isEligible && st.rank !== null) {
          if (previousRankMap.has(st.userId)) {
            const prevRank = previousRankMap.get(st.userId)!;
            rankChange = prevRank - st.rank; // Positive = gained places, Negative = lost places, 0 = unchanged
          } else {
            rankChange = null; // New to ranking
          }
        }

        await client.query(
          `INSERT INTO cohort_ranking_entries (
             snapshot_id, cohort_id, user_id, rank, average, points,
             completed_modules, total_required_modules, is_eligible,
             ineligibility_reason, rank_change
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            snapshotId,
            cohortId,
            st.userId,
            st.rank,
            st.average,
            st.points,
            st.completedModules,
            totalRequiredModules,
            st.isEligible,
            st.ineligibilityReason,
            rankChange,
          ]
        );

        finalEntries.push({
          userId: st.userId,
          name: st.name,
          avatarUrl: st.avatarUrl,
          rank: st.rank,
          average: st.average,
          points: st.points,
          completedModules: st.completedModules,
          totalModules: totalRequiredModules,
          isEligible: st.isEligible,
          ineligibilityReason: st.ineligibilityReason,
          rankChange,
          medal: this.getMedal(st.rank),
        });
      }

      await client.query("COMMIT");

      return {
        id: snapshotId,
        cohortId,
        cohortName: { en: cohort.name_en, fr: cohort.name_fr },
        academicRuleVersion: "v1.0-standard-competition",
        status: "PUBLISHED",
        totalStudents: totalStudentsCount,
        eligibleStudents: eligibleStudentsCount,
        cohortAverage,
        calculatedAt,
        calculatedBy: triggeredBy,
        entries: finalEntries,
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
      // Calculate first snapshot automatically if none exists yet
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
   */
  static async getStudentRankingSummary(userId: string, targetCohortId?: string) {
    // 1. Resolve student's cohort
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

    // 2. Fetch latest snapshot
    let snapshot = await this.getLatestSnapshot(cohortId!);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId!, "STUDENT_REQUEST");
    }

    if (!snapshot) {
      return null;
    }

    // 3. Fetch student's entry in this snapshot
    const studentEntryRes = await pool.query(
      `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
       FROM cohort_ranking_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE e.snapshot_id = $1 AND e.user_id = $2`,
      [snapshot.id, userId]
    );

    const se = studentEntryRes.rows[0];
    const studentEntry: StudentRankingEntryDTO | null = se
      ? {
          userId: se.user_id,
          name: this.formatDisplayName(se),
          avatarUrl: se.avatar_url,
          rank: se.rank !== null ? Number(se.rank) : null,
          average: Number(se.average),
          points: Number(se.points),
          completedModules: se.completed_modules,
          totalModules: se.total_required_modules,
          isEligible: se.is_eligible,
          ineligibilityReason: se.ineligibility_reason,
          rankChange: se.rank_change !== null ? Number(se.rank_change) : null,
          medal: this.getMedal(se.rank !== null ? Number(se.rank) : null),
          isCurrentStudent: true,
        }
      : null;

    // 4. Fetch top 3 performers for Gold/Silver/Bronze recognition
    const topPerformersRes = await pool.query(
      `SELECT e.*, u.name, u.email, p.first_name, p.last_name, p.avatar_url
       FROM cohort_ranking_entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE e.snapshot_id = $1 AND e.is_eligible = TRUE AND e.rank <= 3
       ORDER BY e.rank ASC, e.average DESC, e.points DESC`,
      [snapshot.id]
    );

    const topPerformers: StudentRankingEntryDTO[] = topPerformersRes.rows.map((row) => ({
      userId: row.user_id,
      name: this.formatDisplayName(row),
      avatarUrl: row.avatar_url,
      rank: Number(row.rank),
      average: Number(row.average),
      points: Number(row.points),
      completedModules: row.completed_modules,
      totalModules: row.total_required_modules,
      isEligible: true,
      ineligibilityReason: null,
      rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
      medal: this.getMedal(Number(row.rank)),
      isCurrentStudent: row.user_id === userId,
    }));

    return {
      cohortId,
      cohortName: snapshot.cohortName,
      snapshotId: snapshot.id,
      calculatedAt: snapshot.calculatedAt,
      totalStudents: snapshot.totalStudents,
      eligibleStudents: snapshot.eligibleStudents,
      cohortAverage: snapshot.cohortAverage,
      studentEntry,
      topPerformers,
    };
  }

  /**
   * Retrieves safe, scoped cohort leaderboard data for students and instructors
   */
  static async getCohortLeaderboard(
    cohortId: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 50
  ) {
    let snapshot = await this.getLatestSnapshot(cohortId);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId, "LEADERBOARD_REQUEST");
    }

    if (!snapshot) {
      return { entries: [], total: 0, snapshot: null };
    }

    const offset = Math.max(0, (page - 1) * limit);

    // Fetch ranked eligible entries
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
    };
  }

  /**
   * Admin-only overview of cohort rankings including eligible & ineligible students
   */
  static async getAdminCohortRankings(cohortId: string) {
    let snapshot = await this.getLatestSnapshot(cohortId);
    if (!snapshot) {
      snapshot = await this.recalculateCohortRanking(cohortId, "ADMIN_VIEW");
    }

    if (!snapshot) {
      return null;
    }

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

    const eligibleList: StudentRankingEntryDTO[] = [];
    const ineligibleList: StudentRankingEntryDTO[] = [];

    for (const row of allEntriesRes.rows) {
      const entry: StudentRankingEntryDTO = {
        userId: row.user_id,
        name: this.formatDisplayName(row),
        avatarUrl: row.avatar_url,
        rank: row.rank !== null ? Number(row.rank) : null,
        average: Number(row.average),
        points: Number(row.points),
        completedModules: row.completed_modules,
        totalModules: row.total_required_modules,
        isEligible: row.is_eligible,
        ineligibilityReason: row.ineligibility_reason,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(row.rank !== null ? Number(row.rank) : null),
      };

      if (row.is_eligible) {
        eligibleList.push(entry);
      } else {
        ineligibleList.push(entry);
      }
    }

    // Historical snapshots list for admin dropdown
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
        completedModules: row.completed_modules,
        totalModules: row.total_required_modules,
        isEligible: row.is_eligible,
        ineligibilityReason: row.ineligibility_reason,
        rankChange: row.rank_change !== null ? Number(row.rank_change) : null,
        medal: this.getMedal(row.rank !== null ? Number(row.rank) : null),
      })),
    };
  }
}
