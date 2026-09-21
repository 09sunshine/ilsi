import { pool } from "../database/pool.js";

export class AdminDashboardService {
  /**
   * Fetches high-level KPI counts and activity for the admin overview,
   * with optional filtering by cohort.
   */
  static async getOverview(cohortId?: string) {
    const isFiltered = Boolean(cohortId && cohortId !== "ALL");
    const cohortFilterParam = isFiltered ? [cohortId] : [];

    // 1. Applications KPI
    const appQuery = isFiltered
      ? `SELECT 
           COUNT(*) FILTER (WHERE status IN ('PENDING', 'UNDER_REVIEW')) as pending_apps,
           COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted_apps,
           COUNT(*) as total_apps
         FROM applications
         WHERE cohort_id = $1`
      : `SELECT 
           COUNT(*) FILTER (WHERE status IN ('PENDING', 'UNDER_REVIEW')) as pending_apps,
           COUNT(*) FILTER (WHERE status = 'ACCEPTED') as accepted_apps,
           COUNT(*) as total_apps
         FROM applications`;

    const appCountRes = await pool.query(appQuery, cohortFilterParam);

    // 2. Cohorts & Students KPI
    const cohortRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_cohorts,
        COUNT(*) as total_cohorts
      FROM cohorts
    `);

    const studentQuery = isFiltered
      ? `SELECT 
           COUNT(*) as total_students,
           COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_students,
           COUNT(*) FILTER (WHERE payment_status = 'PAID') as paid_students,
           COUNT(*) FILTER (WHERE payment_status = 'PENDING') as pending_payment_students,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_students
         FROM enrollments
         WHERE cohort_id = $1`
      : `SELECT 
           (SELECT COUNT(*) FROM users WHERE role IN ('PARTICIPANT', 'STUDENT')) as total_students,
           COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_students,
           COUNT(*) FILTER (WHERE payment_status = 'PAID') as paid_students,
           COUNT(*) FILTER (WHERE payment_status = 'PENDING') as pending_payment_students,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_students
         FROM enrollments`;

    const studentCountRes = await pool.query(studentQuery, cohortFilterParam);

    // 3. Payments KPI (multi-currency USD & EUR support)
    const paymentQuery = isFiltered
      ? `SELECT 
           COUNT(*) FILTER (WHERE status = 'PENDING') as pending_payments,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND (currency = 'USD' OR currency IS NULL)), 0) as revenue_usd,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND currency = 'EUR'), 0) as revenue_eur,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) as total_revenue
         FROM payments
         WHERE cohort_id = $1`
      : `SELECT 
           COUNT(*) FILTER (WHERE status = 'PENDING') as pending_payments,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND (currency = 'USD' OR currency IS NULL)), 0) as revenue_usd,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND currency = 'EUR'), 0) as revenue_eur,
           COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) as total_revenue
         FROM payments`;

    const paymentRes = await pool.query(paymentQuery, cohortFilterParam);

    // 4. Cohorts summary with enrolled counts & fee info
    const cohortsListRes = await pool.query(`
      SELECT c.id, c.name_en, c.name_fr, c.start_date, c.end_date, c.capacity, c.status,
             c.fee_amount, c.fee_currency, c.timezone,
             p.title_en as program_title_en, p.title_fr as program_title_fr,
             (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id) as enrolled_count,
             (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.payment_status = 'PAID') as paid_count
      FROM cohorts c
      JOIN programs p ON p.id = c.program_id
      ORDER BY c.start_date DESC
    `);

    // 5. Recent applications
    const recentAppsQuery = isFiltered
      ? `SELECT a.id, a.first_name, a.last_name, a.email, a.country, a.status, a.review_score, a.submitted_at
         FROM applications a
         WHERE a.cohort_id = $1
         ORDER BY a.submitted_at DESC
         LIMIT 10`
      : `SELECT a.id, a.first_name, a.last_name, a.email, a.country, a.status, a.review_score, a.submitted_at
         FROM applications a
         ORDER BY a.submitted_at DESC
         LIMIT 10`;

    const recentAppsRes = await pool.query(recentAppsQuery, cohortFilterParam);

    // 6. Recent payments
    const recentPaymentsQuery = isFiltered
      ? `SELECT p.id, p.amount, p.currency, p.status, p.created_at, p.provider,
                COALESCE(u.name, CONCAT(a.first_name, ' ', a.last_name), 'Participant') as payer_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN applications a ON a.id = p.application_id
         WHERE p.cohort_id = $1
         ORDER BY p.created_at DESC
         LIMIT 10`
      : `SELECT p.id, p.amount, p.currency, p.status, p.created_at, p.provider,
                COALESCE(u.name, CONCAT(a.first_name, ' ', a.last_name), 'Participant') as payer_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN applications a ON a.id = p.application_id
         ORDER BY p.created_at DESC
         LIMIT 10`;

    const recentPaymentsRes = await pool.query(recentPaymentsQuery, cohortFilterParam);

    // 7. Real trends aggregated directly from database tables
    const participantsTrendRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM enrollments
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
      LIMIT 6
    `);
    const participantsTrend = participantsTrendRes.rows.map((r) => r.count);

    const activeCohortsTrendRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM cohorts
      WHERE status = 'ACTIVE'
      GROUP BY DATE_TRUNC('month', start_date)
      ORDER BY DATE_TRUNC('month', start_date) ASC
      LIMIT 6
    `);
    const activeCohortsTrend = activeCohortsTrendRes.rows.map((r) => r.count);

    const applicationsTrendRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM applications
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY DATE_TRUNC('week', submitted_at) ASC
      LIMIT 6
    `);
    const applicationsTrend = applicationsTrendRes.rows.map((r) => r.count);

    const revenueTrendRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0)::numeric as total
      FROM payments
      WHERE status = 'PAID'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
      LIMIT 6
    `);
    const revenueTrend = revenueTrendRes.rows.map((r) => Number(r.total));

    const totalStudents = parseInt(studentCountRes.rows[0]?.total_students || 0, 10);
    const completedStudents = parseInt(studentCountRes.rows[0]?.completed_students || 0, 10);
    const completionRate = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;

    return {
      kpis: {
        pendingApplications: parseInt(appCountRes.rows[0]?.pending_apps || 0, 10),
        acceptedApplications: parseInt(appCountRes.rows[0]?.accepted_apps || 0, 10),
        totalApplications: parseInt(appCountRes.rows[0]?.total_apps || 0, 10),
        activeCohorts: parseInt(cohortRes.rows[0]?.active_cohorts || 0, 10),
        totalStudents,
        activeStudents: parseInt(studentCountRes.rows[0]?.active_students || 0, 10),
        paidStudents: parseInt(studentCountRes.rows[0]?.paid_students || 0, 10),
        pendingPayments: parseInt(studentCountRes.rows[0]?.pending_payment_students || paymentRes.rows[0]?.pending_payments || 0, 10),
        completionRate,
        revenueUsd: parseFloat(paymentRes.rows[0]?.revenue_usd || 0),
        revenueEur: parseFloat(paymentRes.rows[0]?.revenue_eur || 0),
        revenue: parseFloat(paymentRes.rows[0]?.total_revenue || 0),
      },
      trends: {
        participants: participantsTrend,
        activeCohorts: activeCohortsTrend,
        applications: applicationsTrend,
        revenue: revenueTrend,
      },
      cohorts: cohortsListRes.rows.map((c) => ({
        id: c.id,
        name: { en: c.name_en, fr: c.name_fr },
        programTitle: { en: c.program_title_en, fr: c.program_title_fr },
        startDate: c.start_date.toISOString().split("T")[0],
        endDate: c.end_date.toISOString().split("T")[0],
        capacity: c.capacity,
        enrolled: parseInt(c.enrolled_count, 10),
        paidCount: parseInt(c.paid_count, 10),
        feeAmount: Number(c.fee_amount || 0),
        feeCurrency: c.fee_currency || "USD",
        status: c.status,
      })),
      recentApplications: recentAppsRes.rows,
      recentPayments: recentPaymentsRes.rows,
    };
  }
}
