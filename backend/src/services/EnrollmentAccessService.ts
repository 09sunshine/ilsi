import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export interface CohortEnrollmentRecord {
  id: string;
  userId: string;
  cohortId: string;
  status: string;
  paymentStatus: string;
  certificationStatus: string;
  enrolledAt: Date;
  startAt?: Date;
  endAt?: Date;
  completedAt?: Date;
  cohortNameEn: string;
  cohortNameFr: string;
  cohortStatus: string;
  cohortStartDate: Date;
  cohortEndDate: Date;
  programId: string;
  programTitleEn: string;
  programTitleFr: string;
  programSlug: string;
}

export class EnrollmentAccessService {
  /**
   * Retrieves the current primary cohort for an authenticated student.
   * Priority:
   * 1. An enrollment with status 'ACTIVE' and payment_status in ('PAID', 'NOT_REQUIRED')
   * 2. Closest current or upcoming date
   */
  static async getCurrentCohort(userId: string): Promise<CohortEnrollmentRecord | null> {
    const res = await pool.query(
      `SELECT e.id, e.user_id, e.cohort_id, e.status, e.payment_status, e.certification_status,
              e.enrolled_at, e.start_at, e.end_at, e.completed_at,
              c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
              c.status as cohort_status, c.start_date as cohort_start_date, c.end_date as cohort_end_date,
              p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr, p.slug as program_slug
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = $1 
         AND e.status IN ('ACTIVE', 'COMPLETED')
         AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
       ORDER BY 
         CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 2 END,
         c.start_date DESC
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      // Fallback: check if student has any enrollment (e.g. PAYMENT_PENDING or PENDING) to return context
      const anyRes = await pool.query(
        `SELECT e.id, e.user_id, e.cohort_id, e.status, e.payment_status, e.certification_status,
                e.enrolled_at, e.start_at, e.end_at, e.completed_at,
                c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
                c.status as cohort_status, c.start_date as cohort_start_date, c.end_date as cohort_end_date,
                p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr, p.slug as program_slug
         FROM enrollments e
         JOIN cohorts c ON c.id = e.cohort_id
         JOIN programs p ON p.id = c.program_id
         WHERE e.user_id = $1
         ORDER BY e.enrolled_at DESC
         LIMIT 1`,
        [userId]
      );
      if (anyRes.rows.length === 0) return null;
      return this.mapEnrollmentRow(anyRes.rows[0]);
    }

    return this.mapEnrollmentRow(res.rows[0]);
  }

  /**
   * Retrieves all cohort enrollments for a student.
   */
  static async getUserEnrollments(userId: string): Promise<CohortEnrollmentRecord[]> {
    const res = await pool.query(
      `SELECT e.id, e.user_id, e.cohort_id, e.status, e.payment_status, e.certification_status,
              e.enrolled_at, e.start_at, e.end_at, e.completed_at,
              c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
              c.status as cohort_status, c.start_date as cohort_start_date, c.end_date as cohort_end_date,
              p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr, p.slug as program_slug
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at DESC`,
      [userId]
    );

    return res.rows.map((row) => this.mapEnrollmentRow(row));
  }

  /**
   * Asserts that a student has an ACTIVE and PAID enrollment in the specified cohort.
   * Throws 403 or 402 if unauthorized.
   */
  static async assertCohortAccess(userId: string, cohortId: string): Promise<CohortEnrollmentRecord> {
    const res = await pool.query(
      `SELECT e.id, e.user_id, e.cohort_id, e.status, e.payment_status, e.certification_status,
              e.enrolled_at, e.start_at, e.end_at, e.completed_at,
              c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
              c.status as cohort_status, c.start_date as cohort_start_date, c.end_date as cohort_end_date,
              p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr, p.slug as program_slug
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = $1 AND e.cohort_id = $2`,
      [userId, cohortId]
    );

    if (res.rows.length === 0) {
      throw new AppError(
        403,
        ErrorCodes.FORBIDDEN,
        "You are not enrolled in this cohort."
      );
    }

    const enrollment = res.rows[0];

    if (enrollment.status !== "ACTIVE" && enrollment.status !== "COMPLETED") {
      throw new AppError(
        403,
        ErrorCodes.INVALID_ENROLLMENT_STATUS,
        `Your enrollment status (${enrollment.status}) does not permit access to this cohort.`
      );
    }

    if (enrollment.payment_status !== "PAID" && enrollment.payment_status !== "NOT_REQUIRED") {
      throw new AppError(
        402,
        ErrorCodes.PAYMENT_REQUIRED,
        "Payment is required to access content for this cohort."
      );
    }

    return this.mapEnrollmentRow(enrollment);
  }

  private static mapEnrollmentRow(row: any): CohortEnrollmentRecord {
    return {
      id: row.id,
      userId: row.user_id,
      cohortId: row.cohort_id,
      status: row.status,
      paymentStatus: row.payment_status,
      certificationStatus: row.certification_status,
      enrolledAt: row.enrolled_at,
      startAt: row.start_at,
      endAt: row.end_at,
      completedAt: row.completed_at,
      cohortNameEn: row.cohort_name_en,
      cohortNameFr: row.cohort_name_fr,
      cohortStatus: row.cohort_status,
      cohortStartDate: row.cohort_start_date,
      cohortEndDate: row.cohort_end_date,
      programId: row.program_id,
      programTitleEn: row.program_title_en,
      programTitleFr: row.program_title_fr,
      programSlug: row.program_slug,
    };
  }
}
