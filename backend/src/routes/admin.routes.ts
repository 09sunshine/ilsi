import fs from "fs";
import path from "path";
import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requireRole } from "../middleware/rbac.js";
import { validateRequest } from "../middleware/validate.js";
import { adminSchemas } from "../validators/schemas.js";
import { AdminDashboardService } from "../services/AdminDashboardService.js";
import { PaymentService } from "../services/PaymentService.js";
import { GoogleMeetService, generateValidGoogleMeetUrl } from "../integrations/google/meet.js";
import { auth } from "../config/auth.js";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { NotificationService } from "../services/NotificationService.js";
import { supabaseAdmin } from "../integrations/supabase/client.js";

const router = Router();

// Protect all admin endpoints with RBAC
router.use(requireAuth);
router.use(requireRole(["ADMIN", "SUPER_ADMIN"]));

/**
 * GET /api/admin/dashboard
 */
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.query;
    const data = await AdminDashboardService.getOverview(cohortId as string);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/notifications
 */
router.get("/notifications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const notifications = await NotificationService.getUserNotifications(req.user!.id, limit);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/notifications/mark-all-read
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
 * PATCH /api/admin/notifications/:id/read
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
 * DELETE /api/admin/notifications/:id
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

/**
 * GET /api/admin/cohorts
 */
router.get("/cohorts", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortsRes = await pool.query(`
      SELECT c.id, c.program_id, c.name_en, c.name_fr, c.start_date, c.end_date,
             c.capacity, c.status, c.passing_score, c.fee_amount, c.fee_currency,
             c.timezone, c.description_en, c.description_fr, c.max_participants,
             c.thumbnail_url,
             COALESCE(c.thumbnail_url, p.thumbnail_url) as effective_thumbnail,
             COALESCE(p.title_en, c.name_en) as program_title_en,
             COALESCE(p.title_fr, c.name_fr) as program_title_fr,
             (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id) as enrolled_count,
             (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.payment_status = 'PAID') as paid_count
      FROM cohorts c
      LEFT JOIN programs p ON p.id = c.program_id
      ORDER BY c.created_at DESC NULLS LAST, c.start_date DESC
    `);

    // Fetch modules for each cohort
    const result = [];
    for (const c of cohortsRes.rows) {
      const modulesRes = await pool.query(
        `SELECT id, order_index, title_en, title_fr, start_date, end_date, passing_score,
                (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) as lesson_count
         FROM modules m
         WHERE m.cohort_id = $1
         ORDER BY m.order_index ASC`,
        [c.id]
      );

      const formatDate = (val: any) => {
        if (!val) return "";
        if (val instanceof Date) return val.toISOString().split("T")[0];
        return String(val).split("T")[0];
      };

      result.push({
        id: c.id,
        programId: c.program_id,
        programTitle: { en: c.program_title_en || c.name_en, fr: c.program_title_fr || c.name_fr },
        name: { en: c.name_en, fr: c.name_fr },
        description: { en: c.description_en || "", fr: c.description_fr || "" },
        startDate: formatDate(c.start_date),
        endDate: formatDate(c.end_date),
        capacity: c.capacity,
        maxParticipants: c.max_participants || c.capacity,
        enrolled: parseInt(c.enrolled_count, 10),
        paidCount: parseInt(c.paid_count, 10),
        feeAmount: Number(c.fee_amount || 0),
        feeCurrency: c.fee_currency || "USD",
        timezone: c.timezone,
        status: c.status,
        passingScore: c.passing_score,
        thumbnailUrl: c.thumbnail_url || c.effective_thumbnail || null,
        modules: modulesRes.rows.map((m) => ({
          id: m.id,
          order: m.order_index,
          title: { en: m.title_en, fr: m.title_fr },
          startDate: formatDate(m.start_date),
          endDate: formatDate(m.end_date),
          lessonCount: parseInt(m.lesson_count, 10),
          passingScore: m.passing_score,
        })),
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/cohorts/:id
 */
router.get("/cohorts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const cohortRes = await pool.query(
      `SELECT c.*, p.title_en as program_title_en, p.title_fr as program_title_fr,
              (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id) as enrolled_count,
              (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = c.id AND e.payment_status = 'PAID') as paid_count
       FROM cohorts c
       JOIN programs p ON p.id = c.program_id
       WHERE c.id = $1`,
      [id]
    );

    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }

    const c = cohortRes.rows[0];
    const modulesRes = await pool.query(
      `SELECT id, order_index, title_en, title_fr, start_date, end_date, passing_score,
              (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) as lesson_count
       FROM modules m
       WHERE m.cohort_id = $1
       ORDER BY m.order_index ASC`,
      [id]
    );

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
        maxParticipants: c.max_participants || c.capacity,
        enrolled: parseInt(c.enrolled_count, 10),
        paidCount: parseInt(c.paid_count, 10),
        feeAmount: Number(c.fee_amount || 0),
        feeCurrency: c.fee_currency || "USD",
        timezone: c.timezone,
        status: c.status,
        passingScore: c.passing_score,
        modules: modulesRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/cohorts/:id
 */
router.patch("/cohorts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const {
      nameEn,
      nameFr,
      startDate,
      endDate,
      capacity,
      passingScore,
      feeAmount,
      feeCurrency,
      status,
      timezone,
      descriptionEn,
      descriptionFr,
      maxParticipants,
      applicationOpen,
      thumbnailUrl,
    } = req.body;

    const resRow = await pool.query(
      `UPDATE cohorts SET
         name_en = COALESCE($1, name_en),
         name_fr = COALESCE($2, name_fr),
         start_date = COALESCE($3, start_date),
         end_date = COALESCE($4, end_date),
         capacity = COALESCE($5, capacity),
         passing_score = COALESCE($6, passing_score),
         fee_amount = COALESCE($7, fee_amount),
         fee_currency = COALESCE($8, fee_currency),
         status = COALESCE($9, status),
         timezone = COALESCE($10, timezone),
         description_en = COALESCE($11, description_en),
         description_fr = COALESCE($12, description_fr),
         max_participants = COALESCE($13, max_participants),
         application_open = COALESCE($14, application_open),
         thumbnail_url = COALESCE($15, thumbnail_url),
         updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        nameEn,
        nameFr,
        startDate,
        endDate,
        capacity,
        passingScore,
        feeAmount,
        feeCurrency,
        status,
        timezone,
        descriptionEn,
        descriptionFr,
        maxParticipants,
        applicationOpen,
        thumbnailUrl !== undefined ? thumbnailUrl : null,
        id,
      ]
    );

    if (resRow.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }

    // Sync program thumbnail if provided
    if (thumbnailUrl && resRow.rows[0].program_id) {
      await pool.query(
        `UPDATE programs SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2`,
        [thumbnailUrl, resRow.rows[0].program_id]
      );
    }

    res.json({ success: true, data: resRow.rows[0], message: "Cohort updated successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper to extract Supabase Storage key from either full CDN URLs or relative paths.
 */
function extractStoragePath(rawPathOrUrl: string | null | undefined, bucket: string): string | null {
  if (!rawPathOrUrl || typeof rawPathOrUrl !== "string") return null;
  const trimmed = rawPathOrUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const pattern = new RegExp(`/${bucket}/([^?#]+)`);
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  // If already relative, strip leading slash
  return trimmed.replace(/^\/+/, "");
}

/**
 * DELETE /api/admin/cohorts/:id
 * Permanently deletes an active or inactive cohort, its database records (enrollments, payments,
 * certificates, modules, lessons, quizzes, progress, live sessions), and purges all related media
 * (videos, thumbnails, resources) from Supabase Storage and local disk.
 */
router.delete("/cohorts/:id", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const cohortId = req.params.id as string;

    // 1. Verify cohort existence and fetch metadata
    const cohortRes = await pool.query(
      `SELECT id, name_en, name_fr, program_id, thumbnail_url FROM cohorts WHERE id = $1`,
      [cohortId]
    );

    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }

    const cohort = cohortRes.rows[0];

    // 2. Query all media storage assets associated with this cohort before deleting DB rows
    // a) Videos and their thumbnails
    const videosRes = await pool.query(
      `SELECT v.storage_path, v.thumbnail_path
       FROM videos v
       JOIN lessons l ON v.lesson_id = l.id
       JOIN modules m ON l.module_id = m.id
       WHERE m.cohort_id = $1`,
      [cohortId]
    );

    // b) Resources (module-level and lesson-level)
    const resourcesRes = await pool.query(
      `SELECT r.storage_path
       FROM resources r
       WHERE r.module_id IN (SELECT id FROM modules WHERE cohort_id = $1)
          OR r.lesson_id IN (
            SELECT l.id FROM lessons l 
            JOIN modules m ON l.module_id = m.id 
            WHERE m.cohort_id = $1
          )`,
      [cohortId]
    );

    // c) Live session recordings
    const liveSessionsRes = await pool.query(
      `SELECT recording_storage_path FROM live_sessions 
       WHERE cohort_id = $1 AND recording_storage_path IS NOT NULL`,
      [cohortId]
    );

    // d) Certificates
    const certsRes = await pool.query(
      `SELECT storage_path FROM certificates 
       WHERE cohort_id = $1 AND storage_path IS NOT NULL`,
      [cohortId]
    );

    // 3. Collect storage keys per bucket
    const videoKeys: string[] = [];
    const thumbnailKeys: string[] = [];
    const resourceKeys: string[] = [];
    const localFilesToDelete: string[] = [];

    // Helper to register local file path if present
    const checkLocalFile = (rawPath: string | null | undefined) => {
      if (!rawPath || typeof rawPath !== "string") return;
      if (rawPath.includes("/uploads/") || rawPath.startsWith("uploads/")) {
        const relativePart = rawPath.replace(/^.*\/uploads\//, "");
        const localPath = path.join(process.cwd(), "public", "uploads", relativePart);
        localFilesToDelete.push(localPath);
      }
    };

    // Cohort thumbnail
    if (cohort.thumbnail_url) {
      checkLocalFile(cohort.thumbnail_url);
      const k = extractStoragePath(cohort.thumbnail_url, "course-thumbnails");
      if (k) thumbnailKeys.push(k);
    }

    // Videos
    for (const row of videosRes.rows) {
      if (row.storage_path) {
        checkLocalFile(row.storage_path);
        const vk = extractStoragePath(row.storage_path, "course-videos");
        if (vk) videoKeys.push(vk);
      }
      if (row.thumbnail_path) {
        checkLocalFile(row.thumbnail_path);
        const tk =
          extractStoragePath(row.thumbnail_path, "course-thumbnails") ||
          extractStoragePath(row.thumbnail_path, "course-videos");
        if (tk) thumbnailKeys.push(tk);
      }
    }

    // Resources
    for (const row of resourcesRes.rows) {
      if (row.storage_path) {
        checkLocalFile(row.storage_path);
        const rk = extractStoragePath(row.storage_path, "course-resources");
        if (rk) resourceKeys.push(rk);
      }
    }

    // Live session recordings
    for (const row of liveSessionsRes.rows) {
      if (row.recording_storage_path) {
        checkLocalFile(row.recording_storage_path);
        const lk =
          extractStoragePath(row.recording_storage_path, "course-videos") ||
          extractStoragePath(row.recording_storage_path, "course-resources");
        if (lk) videoKeys.push(lk);
      }
    }

    // Certificates
    for (const row of certsRes.rows) {
      if (row.storage_path) {
        checkLocalFile(row.storage_path);
        const ck = extractStoragePath(row.storage_path, "course-resources");
        if (ck) resourceKeys.push(ck);
      }
    }

    // 4. Purge storage objects from Supabase Storage
    const purgeBucket = async (bucket: string, keys: string[]) => {
      if (keys.length === 0) return;
      try {
        const uniqueKeys = Array.from(new Set(keys));
        const { error } = await supabaseAdmin.storage.from(bucket).remove(uniqueKeys);
        if (error) {
          console.warn(`[Supabase Storage Purge] Warning removing from '${bucket}':`, error.message);
        }
      } catch (storageErr: any) {
        console.warn(`[Supabase Storage Purge] Error removing from '${bucket}':`, storageErr?.message);
      }
    };

    await Promise.all([
      purgeBucket("course-videos", videoKeys),
      purgeBucket("course-thumbnails", thumbnailKeys),
      purgeBucket("course-resources", resourceKeys),
    ]);

    // Cleanup local files if any exist
    for (const filePath of localFilesToDelete) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkErr) {
        console.warn(`[Local cleanup] Could not remove file ${filePath}:`, unlinkErr);
      }
    }

    // 5. Atomic database deletion inside transaction
    await client.query("BEGIN");

    // a) Remove certificates referencing this cohort
    await client.query(`DELETE FROM certificates WHERE cohort_id = $1`, [cohortId]);

    // b) Remove payments referencing this cohort
    await client.query(`DELETE FROM payments WHERE cohort_id = $1`, [cohortId]);

    // c) Remove enrollments referencing this cohort
    await client.query(`DELETE FROM enrollments WHERE cohort_id = $1`, [cohortId]);

    // d) Detach any applications associated with this cohort
    await client.query(`UPDATE applications SET cohort_id = NULL WHERE cohort_id = $1`, [cohortId]);

    // e) Delete the cohort (PostgreSQL ON DELETE CASCADE will cleanly remove modules,
    //    lessons, videos, resources, quizzes, quiz_questions, quiz_options, quiz_attempts,
    //    quiz_answers, lesson_progress, module_progress, live_sessions, live_session_attendees)
    await client.query(`DELETE FROM cohorts WHERE id = $1`, [cohortId]);

    // f) If the parent program has no remaining cohorts, clean up the orphaned program and its thumbnail
    let purgedProgram = false;
    if (cohort.program_id) {
      const remainingRes = await client.query(
        `SELECT COUNT(*) as count FROM cohorts WHERE program_id = $1`,
        [cohort.program_id]
      );
      const remainingCount = parseInt(remainingRes.rows[0]?.count || "0", 10);
      if (remainingCount === 0) {
        const progRes = await client.query(
          `SELECT thumbnail_url FROM programs WHERE id = $1`,
          [cohort.program_id]
        );
        if (progRes.rows.length > 0 && progRes.rows[0].thumbnail_url) {
          const progThumb = progRes.rows[0].thumbnail_url;
          checkLocalFile(progThumb);
          const pk = extractStoragePath(progThumb, "course-thumbnails");
          if (pk) {
            await purgeBucket("course-thumbnails", [pk]);
          }
        }
        await client.query(`DELETE FROM applications WHERE program_id = $1`, [cohort.program_id]);
        await client.query(`DELETE FROM programs WHERE id = $1`, [cohort.program_id]);
        purgedProgram = true;
      }
    }

    // g) Log administrative action in audit_logs
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'DELETE_COHORT', 'cohort', $2, $3)`,
      [
        req.user?.id || null,
        cohortId,
        JSON.stringify({
          nameEn: cohort.name_en,
          deletedAt: new Date().toISOString(),
          purgedVideos: videoKeys.length,
          purgedThumbnails: thumbnailKeys.length,
          purgedResources: resourceKeys.length,
          purgedProgram,
        }),
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Cohort "${cohort.name_en}" and all associated database records and storage assets were successfully deleted.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/cohorts/:id/students
 */
router.get("/cohorts/:id/students", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.id as string;
    const studentsRes = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, u.role, u.status as user_status, u.first_login,
              p.first_name, p.last_name, p.phone, p.country, p.city, p.onboarding_completed,
              e.id as enrollment_id, e.status as enrollment_status, e.payment_status,
              e.enrolled_at, e.start_at, e.end_at, e.completed_at,
              COALESCE(
                (SELECT ROUND(AVG(CASE WHEN lp.completed THEN 100 ELSE 0 END))
                 FROM lessons l
                 JOIN modules m ON m.id = l.module_id
                 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = u.id
                 WHERE m.cohort_id = $1),
                0
              ) as progress_percentage
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE e.cohort_id = $1
       ORDER BY e.enrolled_at DESC`,
      [cohortId]
    );

    res.json({ success: true, data: studentsRes.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/cohorts/:id/progress
 */
router.get("/cohorts/:id/progress", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.id as string;
    const modulesProgressRes = await pool.query(
      `SELECT m.id, m.order_index, m.title_en, m.title_fr, m.passing_score,
              COUNT(DISTINCT e.user_id) as total_enrolled,
              COUNT(DISTINCT mp.user_id) FILTER (WHERE mp.completed) as completed_students,
              ROUND(AVG(COALESCE(mp.completion_percentage, 0))) as avg_completion_percent,
              ROUND(AVG(COALESCE(mp.best_quiz_score, 0))) as avg_quiz_score
       FROM modules m
       JOIN cohorts c ON c.id = m.cohort_id
       LEFT JOIN enrollments e ON e.cohort_id = c.id AND e.status = 'ACTIVE'
       LEFT JOIN module_progress mp ON mp.module_id = m.id AND mp.user_id = e.user_id
       WHERE m.cohort_id = $1
       GROUP BY m.id, m.order_index, m.title_en, m.title_fr, m.passing_score
       ORDER BY m.order_index ASC`,
      [cohortId]
    );

    res.json({ success: true, data: modulesProgressRes.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/cohorts/:id/bulk-students
 * Bulk onboarding for first cohort participants (Prepaid offline)
 */
router.post(
  "/cohorts/:id/bulk-students",
  validateRequest({ body: adminSchemas.bulkStudentImport }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cohortId = req.params.id as string;
      const { students } = req.body;

      const cohortRes = await pool.query(
        `SELECT id, fee_amount, fee_currency FROM cohorts WHERE id = $1`,
        [cohortId]
      );
      if (cohortRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
      }
      const cohort = cohortRes.rows[0];

      const createdStudents = [];

      for (const s of students) {
        const email = s.email.trim().toLowerCase();
        const firstName = s.firstName.trim();
        const lastName = s.lastName.trim();
        const tempPass = `ILSI_${Math.random().toString(36).substring(2, 8)}!`;

        let userId: string;
        const existingUser = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
        } else {
          const newUser = await auth.api.signUpEmail({
            body: {
              email,
              password: tempPass,
              name: `${firstName} ${lastName}`,
            },
          });
          if (!newUser?.user) {
            continue;
          }
          userId = newUser.user.id;
        }

        // Set role & first_login = TRUE
        await pool.query(
          `UPDATE users SET role = 'PARTICIPANT', first_login = TRUE, updated_at = NOW() WHERE id = $1`,
          [userId]
        );

        // Upsert profile
        await pool.query(
          `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)
           ON CONFLICT (user_id) DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             phone = COALESCE(EXCLUDED.phone, profiles.phone),
             country = COALESCE(EXCLUDED.country, profiles.country),
             city = COALESCE(EXCLUDED.city, profiles.city),
             updated_at = NOW()`,
          [userId, firstName, lastName, s.phone || null, s.country || null, s.city || null]
        );

        // Create enrollment with ACTIVE & PAID (First-Cohort Special Case)
        const enrollRes = await pool.query(
          `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
           VALUES ($1, $2, 'ACTIVE', 'PAID', NOW())
           ON CONFLICT (user_id, cohort_id) DO UPDATE SET
             status = 'ACTIVE',
             payment_status = 'PAID',
             updated_at = NOW()
           RETURNING id`,
          [userId, cohortId]
        );

        const enrollmentId = enrollRes.rows[0].id;

        // Record MANUAL payment as PAID
        await pool.query(
          `INSERT INTO payments (
             user_id, enrollment_id, cohort_id, amount, currency,
             provider, provider_payment_id, status, type, paid_at, metadata
           )
           VALUES ($1, $2, $3, $4, $5, 'MANUAL', $6, 'PAID', 'COHORT_FEE', NOW(), $7)
           ON CONFLICT DO NOTHING`,
          [
            userId,
            enrollmentId,
            cohortId,
            Number(cohort.fee_amount || 0),
            cohort.fee_currency || "USD",
            `bulk_manual_${Date.now()}_${userId.substring(0, 6)}`,
            JSON.stringify({ note: "Bulk first-cohort prepaid onboarding", manual: true }),
          ]
        );

        createdStudents.push({
          userId,
          email,
          name: `${firstName} ${lastName}`,
          temporaryPassword: tempPass,
          enrollmentId,
          status: "ACTIVE",
          paymentStatus: "PAID",
        });
      }

      res.status(201).json({
        success: true,
        count: createdStudents.length,
        data: createdStudents,
        message: "First cohort participants successfully onboarded with ACTIVE enrollments and pre-marked PAID payments.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/cohorts/:id/enrollments & POST /api/admin/enrollments
 */
const handleAdminCreateEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = (req.params.id || req.body.cohortId) as string;
    const { userId, status = "ACTIVE", paymentStatus = "PAID" } = req.body;

    if (!cohortId || !userId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "cohortId and userId are required");
    }

    const insertRes = await pool.query(
      `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, cohort_id) DO UPDATE SET
         status = EXCLUDED.status,
         payment_status = EXCLUDED.payment_status,
         updated_at = NOW()
       RETURNING *`,
      [userId, cohortId, status, paymentStatus]
    );

    res.status(201).json({ success: true, data: insertRes.rows[0], message: "Enrollment created successfully" });
  } catch (error) {
    next(error);
  }
};
router.post("/cohorts/:id/enrollments", handleAdminCreateEnrollment);
router.post("/enrollments", handleAdminCreateEnrollment);

/**
 * PATCH /api/admin/enrollments/:id
 */
router.patch("/enrollments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, paymentStatus } = req.body;

    const resRow = await pool.query(
      `UPDATE enrollments SET
         status = COALESCE($1, status),
         payment_status = COALESCE($2, payment_status),
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, paymentStatus, id]
    );

    if (resRow.rows.length === 0) {
      throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
    }

    res.json({ success: true, data: resRow.rows[0], message: "Enrollment updated successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/enrollments/:id/payment-status
 */
router.patch("/enrollments/:id/payment-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { paymentStatus } = req.body;

    const resRow = await pool.query(
      `UPDATE enrollments SET
         payment_status = $1,
         status = CASE WHEN $1 = 'PAID' AND status = 'PAYMENT_PENDING' THEN 'ACTIVE' ELSE status END,
         updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [paymentStatus, id]
    );

    if (resRow.rows.length === 0) {
      throw new AppError(404, ErrorCodes.ENROLLMENT_NOT_FOUND, "Enrollment not found");
    }

    res.json({ success: true, data: resRow.rows[0], message: "Enrollment payment status updated" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/enrollments/:id/manual-payment
 * Marks payment as PAID, creates payment record with provider = MANUAL, activates enrollment
 */
router.post("/enrollments/:id/manual-payment", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { amount, currency, notes } = req.body;

    const result = await PaymentService.recordManualPayment({
      enrollmentId: id,
      amount,
      currency,
      notes: notes || "Manually recorded by administrator",
    });

    res.json({
      success: true,
      data: result,
      message: "Manual payment recorded and enrollment activated.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/cohorts
 */
router.post(
  "/cohorts",
  validateRequest({ body: adminSchemas.createCohort }),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      programId,
      nameEn,
      nameFr,
      startDate,
      endDate,
      capacity,
      passingScore,
      feeAmount,
      feeCurrency,
      descriptionEn,
      descriptionFr,
      timezone,
      maxParticipants,
      status,
      thumbnailUrl,
    } = req.body;

    const resRow = await pool.query(
      `INSERT INTO cohorts (
         program_id, name_en, name_fr, start_date, end_date, capacity, passing_score,
         fee_amount, fee_currency, description_en, description_fr, timezone, max_participants, status, thumbnail_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        programId,
        nameEn,
        nameFr,
        startDate,
        endDate,
        capacity || 30,
        passingScore || 70,
        feeAmount || 0,
        feeCurrency || "USD",
        descriptionEn || null,
        descriptionFr || null,
        timezone || "UTC",
        maxParticipants || capacity || 30,
        status || "ACTIVE",
        thumbnailUrl || null,
      ]
    );

    // Sync program thumbnail if provided and program currently has none
    if (thumbnailUrl && programId) {
      await pool.query(
        `UPDATE programs SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2 AND (thumbnail_url IS NULL OR thumbnail_url = '')`,
        [thumbnailUrl, programId]
      );
    }

    res.status(201).json({ success: true, data: resRow.rows[0] });
  } catch (error) {
    next(error);
  }
});

function normalizeDate(val?: string | null, offsetMinutes: number = 0): string {
  if (!val) {
    return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
  }
  const trimmed = String(val).trim();
  const ddmmyyyyMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ddmmyyyyMatch) {
    const [_, d, m, y, h = "00", min = "00", s = "00"] = ddmmyyyyMatch;
    const date = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(val);
  if (!isNaN(date.getTime())) return date.toISOString();
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();
}

/**
 * POST /api/admin/programs/full
 * Creates an entire course curriculum atomically: program, initial cohort, modules, lessons, resources, quizzes, and live sessions
 */
router.post(
  "/programs/full",
  validateRequest({ body: adminSchemas.createFullCourse }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const {
        slug,
        titleEn,
        titleFr,
        taglineEn,
        taglineFr,
        descriptionEn,
        descriptionFr,
        durationWeeks,
        price,
        priceEur,
        currency,
        thumbnailUrl,
        cohort,
        modules,
      } = req.body;

      const effectiveThumbnail = thumbnailUrl || cohort?.thumbnailUrl || null;

      // 1. Insert program
      const moduleCount = modules && Array.isArray(modules) ? modules.length : 0;
      const progRes = await client.query(
        `INSERT INTO programs (
          slug, title_en, title_fr, tagline_en, tagline_fr, description_en, description_fr,
          duration_weeks, module_count, price, price_eur, currency, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (slug) DO UPDATE SET
          title_en = EXCLUDED.title_en,
          title_fr = EXCLUDED.title_fr,
          description_en = EXCLUDED.description_en,
          description_fr = EXCLUDED.description_fr,
          price = EXCLUDED.price,
          price_eur = EXCLUDED.price_eur,
          thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, programs.thumbnail_url)
        RETURNING id`,
        [
          slug,
          titleEn,
          titleFr,
          taglineEn || "",
          taglineFr || "",
          descriptionEn,
          descriptionFr,
          durationWeeks || 12,
          moduleCount,
          price || 180,
          priceEur || 165,
          currency || "USD",
          effectiveThumbnail,
        ]
      );
      const programId = progRes.rows[0].id;

      // 2. Insert initial cohort
      const cohortNameEn = cohort?.nameEn || `${titleEn} — Cohort 1`;
      const cohortNameFr = cohort?.nameFr || `${titleFr} — Cohorte 1`;
      const cohortStartDate = normalizeDate(cohort?.startDate, 0);
      const defaultEndDate = normalizeDate(null, (durationWeeks || 12) * 7 * 24 * 60);
      const cohortEndDate = cohort?.endDate ? normalizeDate(cohort.endDate) : defaultEndDate;

      const cohortRes = await client.query(
        `INSERT INTO cohorts (program_id, name_en, name_fr, start_date, end_date, capacity, status, passing_score, thumbnail_url)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8)
         RETURNING id`,
        [
          programId,
          cohortNameEn,
          cohortNameFr,
          cohortStartDate,
          cohortEndDate,
          cohort?.capacity || 30,
          cohort?.passingScore || 70,
          effectiveThumbnail,
        ]
      );
      const cohortId = cohortRes.rows[0].id;

      // 3. Insert modules
      if (modules && Array.isArray(modules)) {
        for (const m of modules) {
          const modStartDate = normalizeDate(m.startDate || cohortStartDate, 0);
          const modEndDate = normalizeDate(m.endDate || cohortEndDate, 0);
          const modRes = await client.query(
            `INSERT INTO modules (
              cohort_id, order_index, title_en, title_fr, description_en, description_fr,
              start_date, end_date, estimated_hours, required_completion, passing_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`,
            [
              cohortId,
              m.orderIndex,
              m.titleEn,
              m.titleFr,
              m.descriptionEn || "",
              m.descriptionFr || "",
              modStartDate,
              modEndDate,
              m.estimatedHours || 10,
              m.requiredCompletion || 80,
              m.passingScore || 70,
            ]
          );
          const moduleId = modRes.rows[0].id;

          // 3a. Insert Lessons
          if (m.lessons && Array.isArray(m.lessons)) {
            for (const l of m.lessons) {
              const lessonStartAt = l.startAt || l.startDate ? new Date(l.startAt || l.startDate) : modStartDate;
              const lessonEndAt = l.endAt || l.endDate ? new Date(l.endAt || l.endDate) : modEndDate;

              const lessonRes = await client.query(
                `INSERT INTO lessons (
                  module_id, order_index, type, title_en, title_fr, description_en, description_fr,
                  body_en, body_fr, duration_minutes, mandatory, start_date, end_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id`,
                [
                  moduleId,
                  l.orderIndex,
                  l.type || "VIDEO",
                  l.titleEn,
                  l.titleFr,
                  l.descriptionEn || "",
                  l.descriptionFr || "",
                  l.bodyEn || "",
                  l.bodyFr || "",
                  l.durationMinutes || 20,
                  l.mandatory !== false,
                  lessonStartAt,
                  lessonEndAt,
                ]
              );
              const lessonId = lessonRes.rows[0].id;

              // Insert cohort_lessons assignment immediately
              await client.query(
                `INSERT INTO cohort_lessons (
                  cohort_id, lesson_id, order_index, start_at, end_at, duration_minutes,
                  is_required, is_published, status, passing_score
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'PUBLISHED', $8)
                ON CONFLICT (cohort_id, lesson_id) DO UPDATE SET
                  start_at = EXCLUDED.start_at,
                  end_at = EXCLUDED.end_at,
                  order_index = EXCLUDED.order_index,
                  duration_minutes = EXCLUDED.duration_minutes`,
                [
                  cohortId,
                  lessonId,
                  l.orderIndex,
                  lessonStartAt,
                  lessonEndAt,
                  l.durationMinutes || 20,
                  l.mandatory !== false,
                  m.passingScore || 70,
                ]
              );

              // Insert video record if videoUrl provided
              if (l.videoUrl) {
                await client.query(
                  `INSERT INTO videos (lesson_id, storage_path, file_name, mime_type, status)
                   VALUES ($1, $2, $3, 'video/mp4', 'READY')
                   ON CONFLICT (lesson_id) DO UPDATE SET
                     storage_path = EXCLUDED.storage_path,
                     file_name = EXCLUDED.file_name,
                     status = 'READY'`,
                  [lessonId, l.videoUrl, `${l.titleEn}.mp4`]
                );
              }

              // Insert resources / downloadable docs
              if (l.resources && Array.isArray(l.resources)) {
                for (const r of l.resources) {
                  await client.query(
                    `INSERT INTO resources (lesson_id, module_id, name_en, name_fr, type, url, size_kb, downloadable)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                      lessonId,
                      moduleId,
                      r.nameEn,
                      r.nameFr,
                      r.type || "PDF",
                      r.url,
                      r.sizeKb || 500,
                      r.downloadable !== false,
                    ]
                  );
                }
              }

              // 3a-1. Insert lesson-level quiz if present
              if (l.quiz) {
                const lq = l.quiz;
                const lqRes = await client.query(
                  `INSERT INTO quizzes (module_id, lesson_id, title_en, title_fr, description_en, description_fr, time_limit_minutes, passing_score)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   ON CONFLICT (lesson_id) WHERE lesson_id IS NOT NULL DO NOTHING
                   RETURNING id`,
                  [
                    moduleId,
                    lessonId,
                    lq.titleEn,
                    lq.titleFr,
                    lq.descriptionEn || "",
                    lq.descriptionFr || "",
                    lq.timeLimitMinutes || null,
                    lq.passingScore || 70,
                  ]
                );

                if (lqRes.rows.length > 0 && lq.questions && Array.isArray(lq.questions)) {
                  const lqId = lqRes.rows[0].id;
                  for (const question of lq.questions) {
                    const questRes = await client.query(
                      `INSERT INTO quiz_questions (quiz_id, order_index, type, prompt_en, prompt_fr, correct_text, points, required)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                       RETURNING id`,
                      [
                        lqId,
                        question.orderIndex,
                        question.type || "MULTIPLE_CHOICE",
                        question.promptEn,
                        question.promptFr,
                        question.correctText || null,
                        question.points || 1,
                      ]
                    );

                    const questionId = questRes.rows[0].id;
                    if (question.options && Array.isArray(question.options)) {
                      for (const opt of question.options) {
                        await client.query(
                          `INSERT INTO quiz_options (question_id, order_index, label_en, label_fr, correct)
                           VALUES ($1, $2, $3, $4, $5)`,
                          [questionId, opt.orderIndex, opt.labelEn, opt.labelFr, opt.correct === true]
                        );
                      }
                    }
                  }
                }
              }

              // 3a-2. Insert lesson-level live session if present
              if (l.liveSession) {
                const lls = l.liveSession;
                await client.query(
                  `INSERT INTO live_sessions (
                    cohort_id, module_id, lesson_id, title_en, title_fr, description_en, description_fr,
                    starts_at, ends_at, meet_url, instructor_name, status
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SCHEDULED')`,
                  [
                    cohortId,
                    moduleId,
                    lessonId,
                    lls.titleEn,
                    lls.titleFr,
                    lls.descriptionEn || "",
                    lls.descriptionFr || "",
                    normalizeDate(lls.startsAt, 0),
                    normalizeDate(lls.endsAt, 60),
                    lls.meetUrl || generateValidGoogleMeetUrl(),
                    lls.instructorName || "ILSI Faculty Lead",
                  ]
                );
              }
            }
          }

          // 3b. Insert Module Quiz
          if (m.quiz) {
            const q = m.quiz;
            const quizRes = await client.query(
              `INSERT INTO quizzes (module_id, title_en, title_fr, description_en, description_fr, time_limit_minutes, passing_score)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (module_id) WHERE module_id IS NOT NULL AND lesson_id IS NULL DO NOTHING
               RETURNING id`,
              [
                moduleId,
                q.titleEn,
                q.titleFr,
                q.descriptionEn || "",
                q.descriptionFr || "",
                q.timeLimitMinutes || null,
                q.passingScore || 70,
              ]
            );

            if (quizRes.rows.length > 0 && q.questions && Array.isArray(q.questions)) {
              const quizId = quizRes.rows[0].id;
              for (const question of q.questions) {
                const questRes = await client.query(
                  `INSERT INTO quiz_questions (quiz_id, order_index, type, prompt_en, prompt_fr, correct_text, points, required)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
                   RETURNING id`,
                  [
                    quizId,
                    question.orderIndex,
                    question.type || "MULTIPLE_CHOICE",
                    question.promptEn,
                    question.promptFr,
                    question.correctText || null,
                    question.points || 1,
                  ]
                );

                const questionId = questRes.rows[0].id;
                if (question.options && Array.isArray(question.options)) {
                  for (const opt of question.options) {
                    await client.query(
                      `INSERT INTO quiz_options (question_id, order_index, label_en, label_fr, correct)
                       VALUES ($1, $2, $3, $4, $5)`,
                      [questionId, opt.orderIndex, opt.labelEn, opt.labelFr, opt.correct === true]
                    );
                  }
                }
              }
            }
          }

          // 3c. Insert Live Session
          if (m.liveSession) {
            const ls = m.liveSession;
            await client.query(
              `INSERT INTO live_sessions (
                cohort_id, module_id, title_en, title_fr, description_en, description_fr,
                starts_at, ends_at, meet_url, instructor_name, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SCHEDULED')`,
              [
                cohortId,
                moduleId,
                ls.titleEn,
                ls.titleFr,
                ls.descriptionEn || "",
                ls.descriptionFr || "",
                normalizeDate(ls.startsAt, 0),
                normalizeDate(ls.endsAt, 60),
                ls.meetUrl || generateValidGoogleMeetUrl(),
                ls.instructorName || "ILSI Faculty Lead",
              ]
            );
          }
        }
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Full course curriculum, cohort, modules, lessons and quizzes created successfully.",
        data: {
          programId,
          cohortId,
          slug,
          titleEn,
          titleFr,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);


/**
 * GET /api/admin/participants
 */
router.get("/participants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.query;

    // Aggregate all cohorts per user into a JSON array so each user appears exactly once
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.status, u.first_login, u.created_at,
             p.first_name, p.last_name, p.phone, p.country, p.city,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'cohortId',   e.cohort_id,
                   'nameEn',     c.name_en,
                   'nameFr',     c.name_fr,
                   'paymentStatus', e.payment_status,
                   'certStatus',    e.certification_status,
                   'enrollStatus',  e.status
                 ) ORDER BY e.created_at ASC
               ) FILTER (WHERE e.id IS NOT NULL),
               '[]'
             ) AS cohorts,
             MAX(e.payment_status) FILTER (WHERE e.payment_status = 'PAID') AS any_paid,
             BOOL_OR(e.payment_status = 'PAID') AS has_paid,
             (ARRAY_AGG(e.certification_status ORDER BY e.created_at ASC))[1] AS first_cert_status
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN enrollments e ON e.user_id = u.id
      LEFT JOIN cohorts c ON c.id = e.cohort_id
      WHERE (u.role = 'PARTICIPANT' OR u.role = 'STUDENT')
    `;
    const params: any[] = [];

    if (cohortId && cohortId !== "ALL") {
      params.push(cohortId);
      query += ` AND e.cohort_id = $1`;
    }
    query += ` GROUP BY u.id, u.name, u.email, u.role, u.status, u.first_login, u.created_at,
                        p.first_name, p.last_name, p.phone, p.country, p.city
               ORDER BY u.created_at DESC`;

    const participantsRes = await pool.query(query, params);

    const list = participantsRes.rows.map((r) => {
      const nameParts = (r.name || "").split(" ");
      const cohorts: Array<{ cohortId: string; nameEn: string; nameFr: string; paymentStatus: string; certStatus: string; enrollStatus: string }> =
        Array.isArray(r.cohorts) ? r.cohorts : [];
      // Primary cohort = first enrollment (for backward compat)
      const primary = cohorts[0] || null;
      return {
        id: r.id,
        firstName: r.first_name || nameParts[0] || "",
        lastName: r.last_name || nameParts.slice(1).join(" ") || "",
        email: r.email,
        country: r.country || "",
        city: r.city || "",
        role: r.role,
        // Keep single-cohort fields for backward compatibility
        cohortId: primary?.cohortId || null,
        cohortName: primary ? { en: primary.nameEn, fr: primary.nameFr } : null,
        // NEW: full list of all enrolled cohorts
        cohorts: cohorts.map((c) => ({
          cohortId: c.cohortId,
          name: { en: c.nameEn, fr: c.nameFr },
          paymentStatus: c.paymentStatus || "UNPAID",
          certStatus: c.certStatus || "NOT_CERTIFIED",
          enrollStatus: c.enrollStatus,
        })),
        paymentStatus: r.has_paid ? "PAID" : (primary?.paymentStatus || "UNPAID"),
        certification: r.first_cert_status || "NOT_CERTIFIED",
        suspended: r.status === "SUSPENDED",
        firstLogin: r.first_login,
        joinedAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
      };
    });

    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/participants
 * Creates student account manually with temporary password and enrolls them
 */
router.post("/participants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, cohortId, temporaryPassword } = req.body;
    if (!email || !firstName || !lastName || !cohortId) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Missing required participant fields");
    }

    const tempPass = temporaryPassword || `ILSI_${Math.random().toString(36).substring(2, 8)}!`;

    // 1. Create or retrieve user
    let userId: string;
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      try {
        await (auth.api as any).setPassword({
          body: {
            userId,
            newPassword: tempPass,
          },
        });
      } catch (err) {
        console.warn("Notice: setPassword on existing user:", err);
      }
    } else {
      const newUser = await auth.api.signUpEmail({
        body: {
          email,
          password: tempPass,
          name: `${firstName} ${lastName}`,
        },
      });

      if (!newUser?.user) {
        throw new AppError(500, ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to create user");
      }
      userId = newUser.user.id;
    }


    // 2. Set role, first_login and create profile
    await pool.query(
      `UPDATE users SET role = 'PARTICIPANT', first_login = TRUE WHERE id = $1`,
      [userId]
    );

    await pool.query(
      `INSERT INTO profiles (user_id, first_name, last_name, onboarding_completed)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
      [userId, firstName, lastName]
    );

    // 3. Enroll into cohort
    await pool.query(
      `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
       VALUES ($1, $2, 'ACTIVE', 'PAID', NOW())
       ON CONFLICT (user_id, cohort_id) DO UPDATE SET
         status = 'ACTIVE',
         payment_status = 'PAID',
         enrolled_at = NOW()`,
      [userId, cohortId]
    );

    const cohortInfo = await pool.query(
      `SELECT c.id, c.name_en, c.name_fr, p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr
       FROM cohorts c
       LEFT JOIN programs p ON p.id = c.program_id
       WHERE c.id = $1`,
      [cohortId]
    );
    const coh = cohortInfo.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: userId,
        email,
        name: `${firstName} ${lastName}`,
        cohortId,
        cohortName: coh ? { en: coh.name_en, fr: coh.name_fr } : null,
        programId: coh?.program_id || null,
        temporaryPassword: tempPass,
      },
      message: "Student account created and enrolled successfully.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/participants/:id
 * Permanently deletes a registered participant from database
 */
router.delete("/participants/:id", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Missing participant ID");
    }

    // 1. Verify participant exists and check role
    const userRes = await client.query(
      `SELECT u.id, u.email, u.name, u.role, p.first_name, p.last_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.USER_NOT_FOUND, "Participant not found");
    }

    const participant = userRes.rows[0];

    // Safety guard: Cannot delete ADMIN or SUPER_ADMIN through participant route
    if (participant.role !== "PARTICIPANT" && participant.role !== "STUDENT") {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "Cannot delete administrative accounts via participant management");
    }

    await client.query("BEGIN");

    // 2. Remove issued certificates if any (due to ON DELETE RESTRICT on certificates)
    await client.query(`DELETE FROM certificates WHERE user_id = $1`, [id]);

    // 3. Delete from application users table (cascades to enrollments, profiles, progress, quiz attempts, activity, notifications, sessions, accounts)
    await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    // 4. Also delete from Better Auth "user" table if present
    try {
      await client.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    } catch {
      // "user" table may not exist or row already synced
    }

    // 5. Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'DELETE_PARTICIPANT', 'participant', $2, $3)`,
      [
        (req as any).user?.id || null,
        id,
        JSON.stringify({
          email: participant.email,
          name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim() || participant.name,
          deletedAt: new Date().toISOString(),
        }),
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Participant successfully deleted from database.",
      data: { id, email: participant.email },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/applications
 */
router.get("/applications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT a.*, p.title_en as program_title_en, p.title_fr as program_title_fr
      FROM applications a
      JOIN programs p ON p.id = a.program_id
    `;
    const params: any[] = [];
    if (status && status !== "ALL") {
      params.push(status);
      query += ` WHERE a.status = $1`;
    }
    query += ` ORDER BY a.submitted_at DESC`;

    const resRows = await pool.query(query, params);
    res.json({
      success: true,
      data: resRows.rows.map((a) => ({
        id: a.id,
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email,
        phone: a.phone,
        country: a.country,
        city: a.city,
        dateOfBirth: a.date_of_birth ? a.date_of_birth.toISOString().split("T")[0] : undefined,
        education: a.education,
        occupation: a.occupation,
        organization: a.organization,
        motivation: a.motivation,
        experience: a.experience,
        programId: a.program_id,
        programTitle: { en: a.program_title_en, fr: a.program_title_fr },
        status: a.status,
        submittedAt: a.submitted_at.toISOString().split("T")[0],
        reviewScore: a.review_score,
        notes: a.notes,
        paymentStatus: a.payment_status,
      })),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/applications/:id/status
 */
router.patch(
  "/applications/:id/status",
  validateRequest({ body: adminSchemas.updateApplicationStatus }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const { status, reviewScore, notes } = req.body;

      const resRow = await pool.query(
        `UPDATE applications 
         SET status = COALESCE($1, status),
             review_score = COALESCE($2, review_score),
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, reviewScore, notes, id]
      );

      if (resRow.rows.length === 0) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Application not found");
      }

      const updatedApp = resRow.rows[0];

      // If application is accepted or selected, create enrollment with PAYMENT_PENDING
      if (status === "ACCEPTED" || status === "SELECTED") {
        let cohortId = updatedApp.cohort_id;
        if (!cohortId) {
          const findCohort = await pool.query(
            `SELECT id FROM cohorts 
             WHERE program_id = $1 AND status IN ('ACTIVE', 'APPLICATION_OPEN', 'UPCOMING') 
             ORDER BY start_date ASC LIMIT 1`,
            [updatedApp.program_id]
          );
          cohortId = findCohort.rows[0]?.id;
        }

        if (cohortId) {
          let userId: string | undefined;
          const userRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [updatedApp.email.toLowerCase()]);
          if (userRes.rows.length > 0) {
            userId = userRes.rows[0].id;
          } else {
            try {
              const tempPass = `ILSI_${Math.random().toString(36).substring(2, 8)}!`;
              const newUser = await auth.api.signUpEmail({
                body: {
                  email: updatedApp.email.toLowerCase(),
                  password: tempPass,
                  name: `${updatedApp.first_name} ${updatedApp.last_name}`,
                },
              });
              if (newUser?.user) {
                userId = newUser.user.id;
                await pool.query(`UPDATE users SET role = 'PARTICIPANT', first_login = TRUE WHERE id = $1`, [userId]);
                await pool.query(
                  `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
                   VALUES ($1, $2, $3, $4, $5, $6, FALSE)
                   ON CONFLICT (user_id) DO NOTHING`,
                  [userId, updatedApp.first_name, updatedApp.last_name, updatedApp.phone, updatedApp.country, updatedApp.city]
                );
              }
            } catch (signupErr) {
              console.warn("Could not auto-create user on acceptance:", signupErr);
            }
          }

          if (userId) {
            await pool.query(
              `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
               VALUES ($1, $2, 'PAYMENT_PENDING', 'PENDING', NOW())
               ON CONFLICT (user_id, cohort_id) DO UPDATE SET
                 status = CASE WHEN enrollments.status = 'ACTIVE' THEN enrollments.status ELSE 'PAYMENT_PENDING' END,
                 payment_status = CASE WHEN enrollments.payment_status = 'PAID' THEN enrollments.payment_status ELSE 'PENDING' END,
                 updated_at = NOW()`,
              [userId, cohortId]
            );

            // Notify student of acceptance
            void NotificationService.create({
              userId,
              type: "APPLICATION",
              titleEn: "Application Accepted!",
              titleFr: "Candidature acceptée !",
              bodyEn: "Congratulations! Your application has been accepted. Complete your enrollment to secure your seat.",
              bodyFr: "Félicitations ! Votre candidature a été acceptée. Finalisez votre inscription pour réserver votre place.",
            });
          }
        }
      }

      res.json({ success: true, data: updatedApp, message: "Application status updated" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/payments
 */
router.get("/payments", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const resRows = await pool.query(`
      SELECT p.*, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
             COALESCE(u.name, CONCAT(a.first_name, ' ', a.last_name), 'Participant') as participant_name
      FROM payments p
      JOIN cohorts c ON c.id = p.cohort_id
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN applications a ON a.id = p.application_id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      data: resRows.rows.map((r) => ({
        id: r.id,
        participantName: r.participant_name,
        cohortId: r.cohort_id,
        cohortName: { en: r.cohort_name_en, fr: r.cohort_name_fr },
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        provider: r.provider,
        transactionId: r.provider_payment_id || `tx-${r.id.substring(0, 8)}`,
        createdAt: r.created_at.toISOString().split("T")[0],
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/live-sessions
 * Creates Google Meet live session and invites cohort students
 */
router.post(
  "/live-sessions",
  validateRequest({ body: adminSchemas.createLiveSession }),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      cohortId,
      moduleId,
      titleEn,
      titleFr,
      descriptionEn,
      descriptionFr,
      startsAt,
      endsAt,
      timezone,
      instructorName,
      meetUrl,
    } = req.body;

    if (!cohortId || !titleEn || !startsAt || !endsAt || !instructorName) {
      throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Missing required live session fields");
    }

    const created = await GoogleMeetService.createLiveSession({
      organizerUserId: req.user!.id,
      cohortId,
      moduleId,
      titleEn,
      titleFr: titleFr || titleEn,
      descriptionEn: descriptionEn || "",
      descriptionFr: descriptionFr || descriptionEn || "",
      startsAt,
      endsAt,
      timezone: timezone || "UTC",
      instructorName,
      customMeetUrl: meetUrl,
    });

    res.status(201).json({
      success: true,
      data: created,
      message: "Live session scheduled successfully.",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/cohorts/:cohortId/live-sessions
 * Fetches all live sessions for a cohort
 */
router.get("/cohorts/:cohortId/live-sessions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.params;
    const sessionsRes = await pool.query(
      `SELECT ls.*, m.title_en as module_title_en, l.title_en as lesson_title_en
       FROM live_sessions ls
       LEFT JOIN modules m ON m.id = ls.module_id
       LEFT JOIN lessons l ON l.id = ls.lesson_id
       WHERE ls.cohort_id = $1
       ORDER BY ls.starts_at ASC`,
      [cohortId]
    );
    res.json({ success: true, data: sessionsRes.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/admin/live-sessions/:id
 * Updates a live session's meet URL, recording URL, dates, or details
 */
router.patch(
  "/live-sessions/:id",
  validateRequest({ body: adminSchemas.updateLiveSession }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { meetUrl, recordingUrl, startsAt, endsAt, titleEn, titleFr, instructorName, status } = req.body;

      const existing = await pool.query(`SELECT * FROM live_sessions WHERE id = $1`, [id]);
      if (existing.rows.length === 0) {
        throw new AppError(404, ErrorCodes.LIVE_SESSION_NOT_FOUND, "Live session not found");
      }

      const updated = await pool.query(
        `UPDATE live_sessions
         SET meet_url = COALESCE($1, meet_url),
             recording_url = COALESCE($2, recording_url),
             starts_at = COALESCE($3, starts_at),
             ends_at = COALESCE($4, ends_at),
             title_en = COALESCE($5, title_en),
             title_fr = COALESCE($6, title_fr),
             instructor_name = COALESCE($7, instructor_name),
             status = COALESCE($8, status),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          meetUrl ?? null,
          recordingUrl ?? null,
          startsAt ? new Date(startsAt).toISOString() : null,
          endsAt ? new Date(endsAt).toISOString() : null,
          titleEn ?? null,
          titleFr ?? null,
          instructorName ?? null,
          status ?? null,
          id,
        ]
      );

      res.json({
        success: true,
        data: updated.rows[0],
        message: "Live session updated successfully",
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/live-sessions/:id
 * Deletes a scheduled live session
 */
router.delete("/live-sessions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM live_sessions WHERE id = $1`, [id]);
    res.json({ success: true, message: "Live session deleted successfully" });
  } catch (err) {
    next(err);
  }
});

/**
 * GET & PUT /api/admin/settings
 */
router.get("/settings", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const resRows = await pool.query(`SELECT key, value FROM platform_settings`);
    const settings: Record<string, any> = {};
    for (const r of resRows.rows) {
      settings[r.key] = r.value;
    }
    res.json({
      success: true,
      data: {
        passingScore: settings.passingScore ?? 70,
        maxAttempts: settings.maxAttempts ?? 3,
        emailOnUnlock: settings.emailOnUnlock ?? true,
        emailOnDeadline: settings.emailOnDeadline ?? true,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { passingScore, maxAttempts, emailOnUnlock, emailOnDeadline } = req.body;

    const entries = [
      ["passingScore", passingScore],
      ["maxAttempts", maxAttempts],
      ["emailOnUnlock", emailOnUnlock],
      ["emailOnDeadline", emailOnDeadline],
    ];

    for (const [k, v] of entries) {
      if (v !== undefined) {
        await pool.query(
          `INSERT INTO platform_settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [k, JSON.stringify(v)]
        );
      }
    }

    res.json({ success: true, message: "Settings saved successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/donations
 * Retrieves all donation pledges and completed gifts
 */
router.get("/donations", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, amount, currency, frequency, message, status,
             paid_at, stripe_session_id, provider_payment_id, created_at, updated_at
      FROM donations
      ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/donations/:id/status
 * Updates donation status (PLEDGED, COMPLETED, CANCELLED)
 */
router.patch("/donations/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE donations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Donation record not found");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/volunteers
 * Retrieves all volunteer registrations
 */
router.get("/volunteers", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, area, availability, message, status, created_at
      FROM volunteers
      ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/volunteers/:id/status
 * Updates volunteer application status (PENDING, CONTACTED, ACCEPTED, DECLINED)
 */
router.patch("/volunteers/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE volunteers SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Volunteer record not found");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/contact-messages
 * Retrieves all contact submissions
 */
router.get("/contact-messages", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, subject, message, status, created_at
      FROM contact_messages
      ORDER BY created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/contact-messages/:id/status
 * Updates contact message status (UNREAD, READ, REPLIED, ARCHIVED)
 */
router.patch("/contact-messages/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE contact_messages SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/cohorts/:id/curriculum
 * Fetches modules and lessons for admin editing, supporting both legacy cohort-bound modules
 * and decoupled program-based modules with cohort lesson assignments.
 */
router.get("/cohorts/:id/curriculum", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohortId = req.params.id;
    const cohortRes = await pool.query(`SELECT program_id FROM cohorts WHERE id = $1`, [cohortId]);
    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }
    const programId = cohortRes.rows[0]?.program_id;

    const modulesRes = await pool.query(
      `SELECT m.id, m.order_index, m.title_en, m.title_fr, m.description_en, m.description_fr,
              m.start_date, m.end_date, m.estimated_hours, m.passing_score, m.status
       FROM modules m
       WHERE m.cohort_id = $1 OR (m.program_id = $2 AND m.program_id IS NOT NULL)
       ORDER BY m.order_index ASC`,
      [cohortId, programId]
    );

    if (modulesRes.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const moduleIds = modulesRes.rows.map((m) => m.id);

    // 1. Bulk query all lessons across all modules for this cohort
    const lessonsRes = await pool.query(
      `SELECT l.id, l.module_id, l.order_index, l.type, l.title_en, l.title_fr, l.description_en, l.description_fr,
              l.body_en, l.body_fr, l.duration_minutes, l.mandatory, l.status,
              l.start_date, l.end_date,
              v.storage_path as video_url, v.file_name as video_file_name,
              cl.id as cohort_lesson_id, cl.start_at as cohort_start_at, cl.end_at as cohort_end_at,
              cl.order_index as cohort_order_index, cl.is_published as cohort_is_published,
              cl.prerequisite_lesson_id, cl.passing_score as cohort_passing_score
       FROM lessons l
       LEFT JOIN videos v ON v.lesson_id = l.id
       LEFT JOIN cohort_lessons cl ON cl.lesson_id = l.id AND cl.cohort_id = $1
       WHERE l.module_id = ANY($2::uuid[])
       ORDER BY COALESCE(cl.order_index, l.order_index) ASC`,
      [cohortId, moduleIds]
    );

    const lessonIds = lessonsRes.rows.map((l) => l.id);

    // Maps for fast in-memory assembly
    const chaptersByLessonId = new Map<string, any[]>();
    const resourcesByLessonId = new Map<string, any[]>();
    const quizByLessonId = new Map<string, any>();

    if (lessonIds.length > 0) {
      // 2. Query chapters, resources, and latest quiz per lesson in parallel
      const [chapRes, resRes, quizRes] = await Promise.all([
        pool.query(
          `SELECT id, lesson_id, order_index, title_en, title_fr, description_en, description_fr, duration_minutes, video_url, status
           FROM chapters WHERE lesson_id = ANY($1::uuid[]) ORDER BY order_index ASC`,
          [lessonIds]
        ),
        pool.query(
          `SELECT id, lesson_id, name_en, name_fr, type, storage_path, url, size_kb, downloadable
           FROM resources WHERE lesson_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
          [lessonIds]
        ),
        pool.query(
          `SELECT DISTINCT ON (lesson_id)
                  id, lesson_id, title_en, title_fr, description_en, description_fr, passing_score, time_limit_minutes, attempts_allowed, published, status
           FROM quizzes WHERE lesson_id = ANY($1::uuid[]) ORDER BY lesson_id, created_at DESC`,
          [lessonIds]
        ),
      ]);

      for (const c of chapRes.rows) {
        if (!chaptersByLessonId.has(c.lesson_id)) chaptersByLessonId.set(c.lesson_id, []);
        chaptersByLessonId.get(c.lesson_id)!.push({
          id: c.id,
          orderIndex: c.order_index,
          titleEn: c.title_en,
          titleFr: c.title_fr,
          descriptionEn: c.description_en || "",
          descriptionFr: c.description_fr || "",
          durationMinutes: c.duration_minutes,
          videoUrl: c.video_url || "",
          status: c.status,
        });
      }

      for (const r of resRes.rows) {
        if (!resourcesByLessonId.has(r.lesson_id)) resourcesByLessonId.set(r.lesson_id, []);
        resourcesByLessonId.get(r.lesson_id)!.push({
          id: r.id,
          nameEn: r.name_en,
          nameFr: r.name_fr,
          type: r.type,
          storagePath: r.storage_path || null,
          url: r.url,
          sizeKb: r.size_kb,
          downloadable: r.downloadable,
        });
      }

      // 3. For any found quizzes, bulk fetch all questions with aggregated options in 1 query
      const quizIds = quizRes.rows.map((q) => q.id);
      const questionsByQuizId = new Map<string, any[]>();

      if (quizIds.length > 0) {
        const questionsRes = await pool.query(
          `SELECT qq.*,
                  COALESCE(
                    json_agg(
                      json_build_object(
                        'id', qo.id,
                        'orderIndex', qo.order_index,
                        'labelEn', qo.label_en,
                        'labelFr', qo.label_fr,
                        'correct', qo.correct
                      ) ORDER BY qo.order_index ASC
                    ) FILTER (WHERE qo.id IS NOT NULL),
                    '[]'
                  ) as options
           FROM quiz_questions qq
           LEFT JOIN quiz_options qo ON qo.question_id = qq.id
           WHERE qq.quiz_id = ANY($1::uuid[])
           GROUP BY qq.id
           ORDER BY qq.order_index ASC`,
          [quizIds]
        );

        for (const q of questionsRes.rows) {
          if (!questionsByQuizId.has(q.quiz_id)) questionsByQuizId.set(q.quiz_id, []);
          questionsByQuizId.get(q.quiz_id)!.push(q);
        }
      }

      for (const qRow of quizRes.rows) {
        quizByLessonId.set(qRow.lesson_id, {
          ...qRow,
          questions: questionsByQuizId.get(qRow.id) || [],
        });
      }
    }

    // 4. Group enriched lessons by module_id
    const lessonsByModuleId = new Map<string, any[]>();
    for (const l of lessonsRes.rows) {
      if (!lessonsByModuleId.has(l.module_id)) lessonsByModuleId.set(l.module_id, []);

      lessonsByModuleId.get(l.module_id)!.push({
        id: l.id,
        orderIndex: l.cohort_order_index || l.order_index,
        type: l.type,
        titleEn: l.title_en,
        titleFr: l.title_fr,
        descriptionEn: l.description_en,
        descriptionFr: l.description_fr,
        bodyEn: l.body_en || "",
        bodyFr: l.body_fr || "",
        durationMinutes: l.duration_minutes,
        mandatory: l.mandatory,
        status: l.status,
        videoUrl: l.video_url || "",
        videoFileName: l.video_file_name || "",
        cohortLessonId: l.cohort_lesson_id || null,
        cohortStartAt: l.cohort_start_at || l.start_date || null,
        cohortEndAt: l.cohort_end_at || l.end_date || null,
        startAt: l.cohort_start_at || l.start_date || null,
        endAt: l.cohort_end_at || l.end_date || null,
        startDate: l.cohort_start_at ? new Date(l.cohort_start_at).toISOString().slice(0, 10) : l.start_date ? new Date(l.start_date).toISOString().slice(0, 10) : "",
        endDate: l.cohort_end_at ? new Date(l.cohort_end_at).toISOString().slice(0, 10) : l.end_date ? new Date(l.end_date).toISOString().slice(0, 10) : "",
        cohortIsPublished: l.cohort_is_published !== null ? l.cohort_is_published : true,
        prerequisiteLessonId: l.prerequisite_lesson_id || null,
        passingScore: l.cohort_passing_score || null,
        chapters: chaptersByLessonId.get(l.id) || [],
        resources: resourcesByLessonId.get(l.id) || [],
        quiz: quizByLessonId.get(l.id) || null,
      });
    }

    // 5. Build final modules structure
    const modules = modulesRes.rows.map((m) => ({
      ...m,
      lessons: lessonsByModuleId.get(m.id) || [],
    }));

    res.json({ success: true, data: modules });
  } catch (error) {
    next(error);
  }
});

/**
 * ============================================================================
 * PROGRAM MANAGEMENT
 * ============================================================================
 */

/**
 * GET /api/admin/programs
 */
router.get("/programs", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             (SELECT COUNT(*) FROM cohorts c WHERE c.program_id = p.id) as cohort_count,
             (SELECT COUNT(*) FROM modules m WHERE m.program_id = p.id) as module_count,
             (SELECT COUNT(*) FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.program_id = p.id) as lesson_count
      FROM programs p
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/programs
 */
router.post(
  "/programs",
  validateRequest({ body: adminSchemas.createProgram }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        slug,
        titleEn,
        titleFr,
        taglineEn,
        taglineFr,
        descriptionEn,
        descriptionFr,
        durationWeeks,
        price,
        priceEur,
        currency,
        thumbnailUrl,
        status,
      } = req.body;

      const result = await pool.query(
        `INSERT INTO programs (
           slug, title_en, title_fr, tagline_en, tagline_fr,
           description_en, description_fr, duration_weeks,
           price, price_eur, currency, thumbnail_url, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          slug,
          titleEn,
          titleFr,
          taglineEn || null,
          taglineFr || null,
          descriptionEn,
          descriptionFr,
          durationWeeks,
          price,
          priceEur,
          currency,
          thumbnailUrl || null,
          status,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0], message: "Program created successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/programs/:id
 */
router.get("/programs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const progRes = await pool.query(`SELECT * FROM programs WHERE id = $1`, [id]);
    if (progRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Program not found");
    }

    const modulesRes = await pool.query(
      `SELECT m.*,
              (SELECT COUNT(*) FROM lessons l WHERE l.module_id = m.id) as lesson_count
       FROM modules m
       WHERE m.program_id = $1
       ORDER BY m.order_index ASC`,
      [id]
    );

    const cohortsRes = await pool.query(
      `SELECT id, name_en, name_fr, start_date, end_date, status, capacity
       FROM cohorts WHERE program_id = $1
       ORDER BY start_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...progRes.rows[0],
        modules: modulesRes.rows,
        cohorts: cohortsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/programs/:id
 */
router.patch(
  "/programs/:id",
  validateRequest({ body: adminSchemas.updateProgram }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        slug,
        titleEn,
        titleFr,
        taglineEn,
        taglineFr,
        descriptionEn,
        descriptionFr,
        durationWeeks,
        price,
        priceEur,
        currency,
        thumbnailUrl,
        status,
      } = req.body;

      const result = await pool.query(
        `UPDATE programs SET
           slug = COALESCE($1, slug),
           title_en = COALESCE($2, title_en),
           title_fr = COALESCE($3, title_fr),
           tagline_en = COALESCE($4, tagline_en),
           tagline_fr = COALESCE($5, tagline_fr),
           description_en = COALESCE($6, description_en),
           description_fr = COALESCE($7, description_fr),
           duration_weeks = COALESCE($8, duration_weeks),
           price = COALESCE($9, price),
           price_eur = COALESCE($10, price_eur),
           currency = COALESCE($11, currency),
           thumbnail_url = COALESCE($12, thumbnail_url),
           status = COALESCE($13, status),
           updated_at = NOW()
         WHERE id = $14
         RETURNING *`,
        [
          slug,
          titleEn,
          titleFr,
          taglineEn,
          taglineFr,
          descriptionEn,
          descriptionFr,
          durationWeeks,
          price,
          priceEur,
          currency,
          thumbnailUrl,
          status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Program not found");
      }

      res.json({ success: true, data: result.rows[0], message: "Program updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/programs/:id
 */
router.delete("/programs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cohortsRes = await pool.query(`SELECT 1 FROM cohorts WHERE program_id = $1 LIMIT 1`, [id]);
    if (cohortsRes.rows.length > 0) {
      throw new AppError(
        400,
        ErrorCodes.OPERATION_NOT_ALLOWED,
        "Cannot delete program with existing cohorts. Archive or delete associated cohorts first."
      );
    }

    const result = await pool.query(`DELETE FROM programs WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Program not found");
    }

    res.json({ success: true, message: "Program deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * ============================================================================
 * MODULE MANAGEMENT
 * ============================================================================
 */

/**
 * POST /api/admin/programs/:programId/modules
 */
router.post(
  "/programs/:programId/modules",
  validateRequest({ body: adminSchemas.createModule.omit({ programId: true }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { programId } = req.params;
      const {
        orderIndex = 1,
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        estimatedHours = 4,
        requiredCompletion = 80,
        passingScore = 70,
        status = "PUBLISHED",
      } = req.body;

      const result = await pool.query(
        `INSERT INTO modules (
           program_id, order_index, title_en, title_fr,
           description_en, description_fr, estimated_hours,
           required_completion, passing_score, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          programId,
          orderIndex,
          titleEn,
          titleFr,
          descriptionEn || null,
          descriptionFr || null,
          estimatedHours,
          requiredCompletion,
          passingScore,
          status,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0], message: "Module created successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/cohorts/:cohortId/modules
 * Directly attaches a new module to a cohort (and its program)
 */
router.post("/cohorts/:cohortId/modules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.params;
    const cohortRes = await pool.query(`SELECT program_id FROM cohorts WHERE id = $1`, [cohortId]);
    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }
    const programId = cohortRes.rows[0].program_id;
    const {
      orderIndex,
      titleEn,
      titleFr,
      descriptionEn,
      descriptionFr,
      estimatedHours = 4,
      requiredCompletion = 80,
      passingScore = 70,
      status = "PUBLISHED",
    } = req.body;

    let calculatedOrder = orderIndex;
    if (!calculatedOrder) {
      const maxOrderRes = await pool.query(
        `SELECT COALESCE(MAX(order_index), 0) + 1 as next_order
         FROM modules WHERE cohort_id = $1 OR (program_id = $2 AND program_id IS NOT NULL)`,
        [cohortId, programId]
      );
      calculatedOrder = maxOrderRes.rows[0].next_order;
    }

    const result = await pool.query(
      `INSERT INTO modules (
         program_id, cohort_id, order_index, title_en, title_fr,
         description_en, description_fr, estimated_hours,
         required_completion, passing_score, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        programId || null,
        cohortId,
        calculatedOrder,
        titleEn,
        titleFr,
        descriptionEn || null,
        descriptionFr || null,
        estimatedHours,
        requiredCompletion,
        passingScore,
        status,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: "Module created successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/modules/:id
 */
router.patch(
  "/modules/:id",
  validateRequest({ body: adminSchemas.updateModule }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        orderIndex,
        estimatedHours,
        requiredCompletion,
        passingScore,
        status,
      } = req.body;

      const result = await pool.query(
        `UPDATE modules SET
           title_en = COALESCE($1, title_en),
           title_fr = COALESCE($2, title_fr),
           description_en = COALESCE($3, description_en),
           description_fr = COALESCE($4, description_fr),
           order_index = COALESCE($5, order_index),
           estimated_hours = COALESCE($6, estimated_hours),
           required_completion = COALESCE($7, required_completion),
           passing_score = COALESCE($8, passing_score),
           status = COALESCE($9, status),
           updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          titleEn,
          titleFr,
          descriptionEn,
          descriptionFr,
          orderIndex,
          estimatedHours,
          requiredCompletion,
          passingScore,
          status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Module not found");
      }

      res.json({ success: true, data: result.rows[0], message: "Module updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/modules/:id
 * Safeguard: Archival if student progress exists, hard delete otherwise
 */
router.delete("/modules/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const progressRes = await pool.query(
      `SELECT 1 FROM module_progress WHERE module_id = $1
       UNION
       SELECT 1 FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE l.module_id = $1
       LIMIT 1`,
      [id]
    );

    if (progressRes.rows.length > 0) {
      await pool.query(`UPDATE modules SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1`, [id]);
      res.json({
        success: true,
        archived: true,
        message: "Module has student progress and was safely archived rather than deleted.",
      });
      return;
    }

    const result = await pool.query(`DELETE FROM modules WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Module not found");
    }

    res.json({ success: true, message: "Module deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/modules/reorder
 */
router.post(
  "/modules/reorder",
  validateRequest({ body: adminSchemas.reorderModules }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { orders } = req.body;
      await client.query("BEGIN");
      // Phase 1: Assign temporary negative values to avoid unique constraint collisions
      for (let i = 0; i < orders.length; i++) {
        await client.query(`UPDATE modules SET order_index = $1 WHERE id = $2`, [
          -(1000000 + i + 1),
          orders[i].id,
        ]);
      }
      // Phase 2: Set target order_index
      for (const item of orders) {
        await client.query(`UPDATE modules SET order_index = $1, updated_at = NOW() WHERE id = $2`, [
          item.orderIndex,
          item.id,
        ]);
      }
      await client.query("COMMIT");
      res.json({ success: true, message: "Modules reordered successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * ============================================================================
 * LESSON MANAGEMENT (REUSABLE CONTENT)
 * ============================================================================
 */

/**
 * POST /api/admin/modules/:moduleId/lessons
 */
router.post(
  "/modules/:moduleId/lessons",
  validateRequest({ body: adminSchemas.createLesson.omit({ moduleId: true }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleId } = req.params;
      const {
        orderIndex = 1,
        type = "VIDEO",
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        bodyEn,
        bodyFr,
        durationMinutes = 15,
        mandatory = true,
        status = "PUBLISHED",
        videoUrl,
        startDate,
        endDate,
        startAt,
        endAt,
      } = req.body;

      const modInfo = await pool.query(
        `SELECT cohort_id, program_id, start_date, end_date FROM modules WHERE id = $1`,
        [moduleId]
      );
      const mod = modInfo.rows[0] || {};
      const lessonStartAt = startAt || startDate ? new Date(startAt || startDate) : mod.start_date ? new Date(mod.start_date) : new Date();
      const lessonEndAt = endAt || endDate ? new Date(endAt || endDate) : mod.end_date ? new Date(mod.end_date) : new Date(Date.now() + 30 * 86400000);

      const result = await pool.query(
        `INSERT INTO lessons (
           module_id, order_index, type, title_en, title_fr,
           description_en, description_fr, body_en, body_fr,
           duration_minutes, mandatory, status, start_date, end_date
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          moduleId,
          orderIndex,
          type,
          titleEn,
          titleFr,
          descriptionEn || null,
          descriptionFr || null,
          bodyEn || null,
          bodyFr || null,
          durationMinutes,
          mandatory,
          status,
          lessonStartAt,
          lessonEndAt,
        ]
      );

      const lesson = result.rows[0];

      if (videoUrl) {
        await pool.query(
          `INSERT INTO videos (lesson_id, storage_path, file_name, mime_type, status)
           VALUES ($1, $2, $3, 'video/mp4', 'READY')
           ON CONFLICT (lesson_id) DO UPDATE SET storage_path = EXCLUDED.storage_path, status = 'READY'`,
          [lesson.id, videoUrl, `${titleEn}.mp4`]
        );
      }

      // Auto-schedule into cohort_lessons if module is tied to a cohort or cohorts
      if (modInfo.rows.length > 0) {
        const { cohort_id, program_id } = modInfo.rows[0];
        const targetCohortIds: string[] = [];
        if (cohort_id) targetCohortIds.push(cohort_id);
        if (program_id) {
          const chRes = await pool.query(`SELECT id FROM cohorts WHERE program_id = $1`, [program_id]);
          for (const r of chRes.rows) {
            if (!targetCohortIds.includes(r.id)) targetCohortIds.push(r.id);
          }
        }
        for (const cId of targetCohortIds) {
          await pool.query(
            `INSERT INTO cohort_lessons (cohort_id, lesson_id, order_index, start_at, end_at, duration_minutes, is_required, is_published, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'PUBLISHED')
             ON CONFLICT (cohort_id, lesson_id) DO UPDATE SET
               start_at = EXCLUDED.start_at,
               end_at = EXCLUDED.end_at,
               order_index = EXCLUDED.order_index`,
            [cId, lesson.id, orderIndex, lessonStartAt, lessonEndAt, durationMinutes, mandatory]
          );
        }
      }

      res.status(201).json({ success: true, data: lesson, message: "Lesson created successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/lessons/:id
 */
router.get("/lessons/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const lessonRes = await pool.query(
      `SELECT l.*, v.storage_path as video_url, v.file_name as video_file_name
       FROM lessons l
       LEFT JOIN videos v ON v.lesson_id = l.id
       WHERE l.id = $1`,
      [id]
    );

    if (lessonRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
    }

    const chaptersRes = await pool.query(
      `SELECT * FROM chapters WHERE lesson_id = $1 ORDER BY order_index ASC`,
      [id]
    );

    const quizzesRes = await pool.query(
      `SELECT id, title_en, title_fr, passing_score, time_limit_minutes, attempts_allowed, status
       FROM quizzes WHERE lesson_id = $1`,
      [id]
    );

    const cohortAssignmentsRes = await pool.query(
      `SELECT cl.*, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr
       FROM cohort_lessons cl
       JOIN cohorts c ON c.id = cl.cohort_id
       WHERE cl.lesson_id = $1
       ORDER BY cl.start_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...lessonRes.rows[0],
        chapters: chaptersRes.rows,
        quizzes: quizzesRes.rows,
        cohortAssignments: cohortAssignmentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/lessons/:id
 */
router.patch(
  "/lessons/:id",
  validateRequest({ body: adminSchemas.updateLesson }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        bodyEn,
        bodyFr,
        orderIndex,
        type,
        durationMinutes,
        mandatory,
        status,
        videoUrl,
        startDate,
        endDate,
        startAt,
        endAt,
      } = req.body;

      const result = await pool.query(
        `UPDATE lessons SET
           title_en = COALESCE($1, title_en),
           title_fr = COALESCE($2, title_fr),
           description_en = COALESCE($3, description_en),
           description_fr = COALESCE($4, description_fr),
           body_en = COALESCE($5, body_en),
           body_fr = COALESCE($6, body_fr),
           order_index = COALESCE($7, order_index),
           type = COALESCE($8, type),
           duration_minutes = COALESCE($9, duration_minutes),
           mandatory = COALESCE($10, mandatory),
           status = COALESCE($11, status),
           updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [
          titleEn,
          titleFr,
          descriptionEn,
          descriptionFr,
          bodyEn,
          bodyFr,
          orderIndex,
          type,
          durationMinutes,
          mandatory,
          status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
      }

      const startVal = startAt || startDate;
      if (startVal !== undefined) {
        await pool.query(`UPDATE lessons SET start_date = $1, updated_at = NOW() WHERE id = $2`, [
          startVal ? new Date(startVal) : null,
          id,
        ]);
        await pool.query(`UPDATE cohort_lessons SET start_at = $1, updated_at = NOW() WHERE lesson_id = $2`, [
          startVal ? new Date(startVal) : new Date(),
          id,
        ]);
      }

      const endVal = endAt || endDate;
      if (endVal !== undefined) {
        await pool.query(`UPDATE lessons SET end_date = $1, updated_at = NOW() WHERE id = $2`, [
          endVal ? new Date(endVal) : null,
          id,
        ]);
        await pool.query(`UPDATE cohort_lessons SET end_at = $1, updated_at = NOW() WHERE lesson_id = $2`, [
          endVal ? new Date(endVal) : new Date(Date.now() + 30 * 86400000),
          id,
        ]);
      }

      if (videoUrl !== undefined) {
        if (!videoUrl) {
          await pool.query(`DELETE FROM videos WHERE lesson_id = $1`, [id]);
        } else {
          await pool.query(
            `INSERT INTO videos (lesson_id, storage_path, file_name, mime_type, status)
             VALUES ($1, $2, $3, 'video/mp4', 'READY')
             ON CONFLICT (lesson_id) DO UPDATE SET storage_path = EXCLUDED.storage_path, status = 'READY'`,
            [id, videoUrl, `${result.rows[0].title_en || "lesson"}.mp4`]
          );
        }
      }

      res.json({ success: true, data: result.rows[0], message: "Lesson updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/lessons/:id
 * Safeguard: Archival if student progress/quiz attempts exist, hard delete otherwise
 */
router.delete("/lessons/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const progressRes = await pool.query(
      `SELECT 1 FROM lesson_progress WHERE lesson_id = $1
       UNION
       SELECT 1 FROM quiz_attempts WHERE lesson_id = $1
       LIMIT 1`,
      [id]
    );

    if (progressRes.rows.length > 0) {
      await pool.query(`UPDATE lessons SET status = 'ARCHIVED', updated_at = NOW() WHERE id = $1`, [id]);
      await pool.query(
        `UPDATE cohort_lessons SET status = 'ARCHIVED', is_published = FALSE, updated_at = NOW() WHERE lesson_id = $1`,
        [id]
      );
      res.json({
        success: true,
        archived: true,
        message: "Lesson has student progress and was safely archived rather than deleted.",
      });
      return;
    }

    const result = await pool.query(`DELETE FROM lessons WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
    }

    res.json({ success: true, message: "Lesson deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/lessons/reorder
 */
router.post(
  "/lessons/reorder",
  validateRequest({ body: adminSchemas.reorderLessons }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { orders } = req.body;
      await client.query("BEGIN");
      // Phase 1: Assign temporary negative values to avoid unique constraint collisions
      for (let i = 0; i < orders.length; i++) {
        await client.query(`UPDATE lessons SET order_index = $1 WHERE id = $2`, [
          -(1000000 + i + 1),
          orders[i].id,
        ]);
      }
      // Phase 2: Set target order_index and sync cohort_lessons
      for (const item of orders) {
        await client.query(`UPDATE lessons SET order_index = $1, updated_at = NOW() WHERE id = $2`, [
          item.orderIndex,
          item.id,
        ]);
        await client.query(`UPDATE cohort_lessons SET order_index = $1, updated_at = NOW() WHERE lesson_id = $2`, [
          item.orderIndex,
          item.id,
        ]);
      }
      await client.query("COMMIT");
      res.json({ success: true, message: "Lessons reordered successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * ============================================================================
 * CHAPTER MANAGEMENT
 * ============================================================================
 */

/**
 * POST /api/admin/lessons/:lessonId/chapters
 */
router.post(
  "/lessons/:lessonId/chapters",
  validateRequest({ body: adminSchemas.createChapter.omit({ lessonId: true }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lessonId } = req.params;
      const {
        orderIndex = 1,
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        bodyEn,
        bodyFr,
        durationMinutes = 5,
        videoUrl,
        status = "PUBLISHED",
      } = req.body;

      const result = await pool.query(
        `INSERT INTO chapters (
           lesson_id, order_index, title_en, title_fr,
           description_en, description_fr, body_en, body_fr,
           duration_minutes, video_url, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          lessonId,
          orderIndex,
          titleEn,
          titleFr,
          descriptionEn || null,
          descriptionFr || null,
          bodyEn || null,
          bodyFr || null,
          durationMinutes,
          videoUrl || null,
          status,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0], message: "Chapter created successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/chapters/:id
 */
router.patch(
  "/chapters/:id",
  validateRequest({ body: adminSchemas.updateChapter }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        bodyEn,
        bodyFr,
        orderIndex,
        durationMinutes,
        videoUrl,
        status,
      } = req.body;

      const result = await pool.query(
        `UPDATE chapters SET
           title_en = COALESCE($1, title_en),
           title_fr = COALESCE($2, title_fr),
           description_en = COALESCE($3, description_en),
           description_fr = COALESCE($4, description_fr),
           body_en = COALESCE($5, body_en),
           body_fr = COALESCE($6, body_fr),
           order_index = COALESCE($7, order_index),
           duration_minutes = COALESCE($8, duration_minutes),
           video_url = COALESCE($9, video_url),
           status = COALESCE($10, status),
           updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          titleEn,
          titleFr,
          descriptionEn,
          descriptionFr,
          bodyEn,
          bodyFr,
          orderIndex,
          durationMinutes,
          videoUrl,
          status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Chapter not found");
      }

      res.json({ success: true, data: result.rows[0], message: "Chapter updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/chapters/:id
 */
router.delete("/chapters/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM chapters WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Chapter not found");
    }
    res.json({ success: true, message: "Chapter deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/chapters/reorder
 */
router.post(
  "/chapters/reorder",
  validateRequest({ body: adminSchemas.reorderChapters }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { orders } = req.body;
      await client.query("BEGIN");
      // Phase 1: Assign temporary negative values to avoid unique constraint collisions
      for (let i = 0; i < orders.length; i++) {
        await client.query(`UPDATE chapters SET order_index = $1 WHERE id = $2`, [
          -(1000000 + i + 1),
          orders[i].id,
        ]);
      }
      // Phase 2: Set target order_index
      for (const item of orders) {
        await client.query(`UPDATE chapters SET order_index = $1, updated_at = NOW() WHERE id = $2`, [
          item.orderIndex,
          item.id,
        ]);
      }
      await client.query("COMMIT");
      res.json({ success: true, message: "Chapters reordered successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * ============================================================================
 * COHORT LESSON ASSIGNMENT & SCHEDULING
 * ============================================================================
 */

/**
 * GET /api/admin/cohorts/:cohortId/lessons
 */
router.get("/cohorts/:cohortId/lessons", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cohortId } = req.params;
    const result = await pool.query(
      `SELECT cl.*,
              l.title_en as lesson_title_en, l.title_fr as lesson_title_fr,
              l.type as lesson_type, l.duration_minutes as lesson_duration,
              l.module_id, m.title_en as module_title_en, m.title_fr as module_title_fr,
              pre.title_en as prerequisite_title_en, pre.title_fr as prerequisite_title_fr,
              (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.cohort_id = cl.cohort_id AND lp.lesson_id = cl.lesson_id AND lp.completed) as completed_count
       FROM cohort_lessons cl
       JOIN lessons l ON l.id = cl.lesson_id
       LEFT JOIN modules m ON m.id = l.module_id
       LEFT JOIN lessons pre ON pre.id = cl.prerequisite_lesson_id
       WHERE cl.cohort_id = $1
       ORDER BY cl.order_index ASC, cl.start_at ASC`,
      [cohortId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/cohorts/:cohortId/lessons
 * Assigns or re-schedules an individual reusable lesson to a specific cohort
 */
router.post(
  "/cohorts/:cohortId/lessons",
  validateRequest({ body: adminSchemas.assignCohortLesson }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cohortId } = req.params;
      const {
        lessonId,
        orderIndex = 1,
        startAt,
        endAt,
        durationMinutes,
        isRequired = true,
        isPublished = true,
        status = "PUBLISHED",
        passingScore = 70,
        prerequisiteLessonId = null,
        prerequisiteAssignmentId = null,
      } = req.body;

      const result = await pool.query(
        `INSERT INTO cohort_lessons (
           cohort_id, lesson_id, order_index, start_at, end_at,
           duration_minutes, is_required, is_published, status,
           passing_score, prerequisite_lesson_id, prerequisite_assignment_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (cohort_id, lesson_id) DO UPDATE SET
           order_index = EXCLUDED.order_index,
           start_at = EXCLUDED.start_at,
           end_at = EXCLUDED.end_at,
           duration_minutes = EXCLUDED.duration_minutes,
           is_required = EXCLUDED.is_required,
           is_published = EXCLUDED.is_published,
           status = EXCLUDED.status,
           passing_score = EXCLUDED.passing_score,
           prerequisite_lesson_id = EXCLUDED.prerequisite_lesson_id,
           prerequisite_assignment_id = EXCLUDED.prerequisite_assignment_id,
           updated_at = NOW()
         RETURNING *`,
        [
          cohortId,
          lessonId,
          orderIndex,
          startAt,
          endAt,
          durationMinutes || null,
          isRequired,
          isPublished,
          status,
          passingScore,
          prerequisiteLessonId || null,
          prerequisiteAssignmentId || null,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: "Lesson successfully assigned to cohort.",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/cohorts/:cohortId/lessons/bulk-assign
 * Convenient bulk assignment of all lessons from the parent program into the cohort
 */
router.post("/cohorts/:cohortId/lessons/bulk-assign", async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const { cohortId } = req.params;
    const cohortRes = await client.query(`SELECT start_date, end_date, program_id FROM cohorts WHERE id = $1`, [cohortId]);
    if (cohortRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.COHORT_NOT_FOUND, "Cohort not found");
    }
    const cohort = cohortRes.rows[0];

    const lessonsRes = await client.query(
      `SELECT l.id, l.order_index, m.order_index as mod_order
       FROM lessons l
       JOIN modules m ON m.id = l.module_id
       WHERE m.program_id = $1 OR m.cohort_id = $2
       ORDER BY m.order_index ASC, l.order_index ASC`,
      [cohort.program_id, cohortId]
    );

    if (lessonsRes.rows.length === 0) {
      res.json({ success: true, count: 0, message: "No lessons found to assign." });
      return;
    }

    await client.query("BEGIN");
    let assignedCount = 0;
    let seq = 1;
    for (const l of lessonsRes.rows) {
      await client.query(
        `INSERT INTO cohort_lessons (
           cohort_id, lesson_id, order_index, start_at, end_at, is_required, is_published, status
         )
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, 'PUBLISHED')
         ON CONFLICT (cohort_id, lesson_id) DO NOTHING`,
        [cohortId, l.id, seq++, cohort.start_date, cohort.end_date]
      );
      assignedCount++;
    }
    await client.query("COMMIT");

    res.json({ success: true, count: assignedCount, message: `Assigned ${assignedCount} lessons to cohort.` });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/admin/cohort-lessons/:id
 */
router.patch(
  "/cohort-lessons/:id",
  validateRequest({ body: adminSchemas.updateCohortLesson }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        startAt,
        endAt,
        orderIndex,
        durationMinutes,
        isRequired,
        isPublished,
        status,
        passingScore,
        prerequisiteLessonId,
        prerequisiteAssignmentId,
      } = req.body;

      const result = await pool.query(
        `UPDATE cohort_lessons SET
           start_at = COALESCE($1, start_at),
           end_at = COALESCE($2, end_at),
           order_index = COALESCE($3, order_index),
           duration_minutes = COALESCE($4, duration_minutes),
           is_required = COALESCE($5, is_required),
           is_published = COALESCE($6, is_published),
           status = COALESCE($7, status),
           passing_score = COALESCE($8, passing_score),
           prerequisite_lesson_id = CASE WHEN $9::text IS NOT NULL THEN $9 ELSE prerequisite_lesson_id END,
           prerequisite_assignment_id = CASE WHEN $10::text IS NOT NULL THEN $10 ELSE prerequisite_assignment_id END,
           updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          startAt,
          endAt,
          orderIndex,
          durationMinutes,
          isRequired,
          isPublished,
          status,
          passingScore,
          prerequisiteLessonId !== undefined ? prerequisiteLessonId : null,
          prerequisiteAssignmentId !== undefined ? prerequisiteAssignmentId : null,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Cohort lesson assignment not found");
      }

      res.json({ success: true, data: result.rows[0], message: "Cohort lesson schedule updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/cohort-lessons/:id
 * Safeguard: Archival if student progress exists in this cohort, hard delete otherwise
 */
router.delete("/cohort-lessons/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const clRes = await pool.query(`SELECT cohort_id, lesson_id FROM cohort_lessons WHERE id = $1`, [id]);
    if (clRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Cohort lesson assignment not found");
    }
    const { cohort_id, lesson_id } = clRes.rows[0];

    const progressRes = await pool.query(
      `SELECT 1 FROM lesson_progress WHERE cohort_id = $1 AND lesson_id = $2
       UNION
       SELECT 1 FROM quiz_attempts WHERE cohort_id = $1 AND lesson_id = $2
       LIMIT 1`,
      [cohort_id, lesson_id]
    );

    if (progressRes.rows.length > 0) {
      await pool.query(
        `UPDATE cohort_lessons SET status = 'ARCHIVED', is_published = FALSE, updated_at = NOW() WHERE id = $1`,
        [id]
      );
      res.json({
        success: true,
        archived: true,
        message: "Cohort lesson has participant activity and was safely archived.",
      });
      return;
    }

    await pool.query(`DELETE FROM cohort_lessons WHERE id = $1`, [id]);
    res.json({ success: true, message: "Cohort lesson assignment removed successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/cohorts/:cohortId/lessons/reorder
 */
router.post(
  "/cohorts/:cohortId/lessons/reorder",
  validateRequest({ body: adminSchemas.reorderCohortLessons }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { orders } = req.body;
      await client.query("BEGIN");
      // Phase 1: Assign temporary negative values to avoid unique constraint collisions
      for (let i = 0; i < orders.length; i++) {
        await client.query(
          `UPDATE cohort_lessons SET order_index = $1 WHERE id = $2`,
          [-(1000000 + i + 1), orders[i].id]
        );
      }
      // Phase 2: Set target order_index
      for (const item of orders) {
        await client.query(
          `UPDATE cohort_lessons SET order_index = $1, updated_at = NOW() WHERE id = $2`,
          [item.orderIndex, item.id]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true, message: "Cohort lessons reordered successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * ============================================================================
 * QUIZ MANAGEMENT
 * ============================================================================
 */

/**
 * POST /api/admin/quizzes
 */
router.post(
  "/quizzes",
  validateRequest({ body: adminSchemas.createQuiz }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        moduleId,
        lessonId,
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        timeLimitMinutes,
        passingScore = 70,
        attemptsAllowed = 3,
        published = true,
        status = "PUBLISHED",
      } = req.body;

      const result = await pool.query(
        `INSERT INTO quizzes (
           module_id, lesson_id, title_en, title_fr,
           description_en, description_fr, time_limit_minutes,
           passing_score, attempts_allowed, published, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          moduleId || null,
          lessonId || null,
          titleEn,
          titleFr,
          descriptionEn || null,
          descriptionFr || null,
          timeLimitMinutes || null,
          passingScore,
          attemptsAllowed,
          published,
          status,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0], message: "Quiz created successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/admin/quizzes/:id
 */
router.get("/quizzes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const quizRes = await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [id]);
    if (quizRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.QUIZ_NOT_FOUND, "Quiz not found");
    }

    const questionsRes = await pool.query(
      `SELECT q.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', o.id,
                    'orderIndex', o.order_index,
                    'labelEn', o.label_en,
                    'labelFr', o.label_fr,
                    'correct', o.correct
                  ) ORDER BY o.order_index ASC
                ) FILTER (WHERE o.id IS NOT NULL),
                '[]'
              ) as options
       FROM quiz_questions q
       LEFT JOIN quiz_options o ON o.question_id = q.id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q.order_index ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...quizRes.rows[0],
        questions: questionsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/quizzes/:id
 */
router.patch(
  "/quizzes/:id",
  validateRequest({ body: adminSchemas.updateQuiz }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const {
        titleEn,
        titleFr,
        descriptionEn,
        descriptionFr,
        timeLimitMinutes,
        passingScore,
        attemptsAllowed,
        published,
        status,
      } = req.body;

      const result = await pool.query(
        `UPDATE quizzes SET
           title_en = COALESCE($1, title_en),
           title_fr = COALESCE($2, title_fr),
           description_en = COALESCE($3, description_en),
           description_fr = COALESCE($4, description_fr),
           time_limit_minutes = CASE WHEN $5 IS NOT NULL THEN $5 ELSE time_limit_minutes END,
           passing_score = COALESCE($6, passing_score),
           attempts_allowed = COALESCE($7, attempts_allowed),
           published = COALESCE($8, published),
           status = COALESCE($9, status),
           updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          titleEn,
          titleFr,
          descriptionEn,
          descriptionFr,
          timeLimitMinutes,
          passingScore,
          attemptsAllowed,
          published,
          status,
          id,
        ]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, ErrorCodes.QUIZ_NOT_FOUND, "Quiz not found");
      }

      res.json({ success: true, data: result.rows[0], message: "Quiz updated successfully" });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/quizzes/:quizId/questions
 */
router.post(
  "/quizzes/:quizId/questions",
  validateRequest({ body: adminSchemas.createQuizQuestion.omit({ quizId: true }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    const client = await pool.connect();
    try {
      const { quizId } = req.params;
      const {
        orderIndex = 1,
        type = "MULTIPLE_CHOICE",
        promptEn,
        promptFr,
        correctText = null,
        points = 1,
        explanationEn = null,
        explanationFr = null,
        required = true,
        options = [],
      } = req.body;

      await client.query("BEGIN");
      const qRes = await client.query(
        `INSERT INTO quiz_questions (
           quiz_id, order_index, type, prompt_en, prompt_fr,
           correct_text, points, explanation_en, explanation_fr, required
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          quizId,
          orderIndex,
          type,
          promptEn,
          promptFr,
          correctText,
          points,
          explanationEn,
          explanationFr,
          required,
        ]
      );
      const question = qRes.rows[0];

      const createdOptions = [];
      if (Array.isArray(options) && options.length > 0) {
        for (const opt of options) {
          const optRes = await client.query(
            `INSERT INTO quiz_options (question_id, order_index, label_en, label_fr, correct)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [question.id, opt.orderIndex || 1, opt.labelEn, opt.labelFr, opt.correct || false]
          );
          createdOptions.push(optRes.rows[0]);
        }
      }

      await client.query("COMMIT");
      res.status(201).json({
        success: true,
        data: { ...question, options: createdOptions },
        message: "Quiz question created successfully",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/admin/quiz-questions/:id
 */
router.delete("/quiz-questions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM quiz_questions WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Quiz question not found");
    }
    res.json({ success: true, message: "Quiz question deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/quizzes/:id
 */
router.delete("/quizzes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const attemptsRes = await pool.query(`SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 LIMIT 1`, [id]);
    if (attemptsRes.rows.length > 0) {
      await pool.query(`UPDATE quizzes SET status = 'ARCHIVED', published = FALSE, updated_at = NOW() WHERE id = $1`, [id]);
      res.json({ success: true, archived: true, message: "Quiz has student attempts and was safely archived." });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM quiz_options WHERE question_id IN (SELECT id FROM quiz_questions WHERE quiz_id = $1)`,
        [id]
      );
      await client.query(`DELETE FROM quiz_questions WHERE quiz_id = $1`, [id]);
      await client.query(`DELETE FROM quizzes WHERE id = $1`, [id]);
      await client.query("COMMIT");
      res.json({ success: true, message: "Quiz deleted successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/resources
 * Attach a document or PDF file to a lesson or module
 */
router.post("/resources", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      lessonId,
      moduleId,
      nameEn,
      nameFr,
      type = "PDF",
      storagePath,
      url,
      sizeKb = 100,
      downloadable = true,
      status = "PUBLISHED",
      isPublished = true,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO resources (
         lesson_id, module_id, name_en, name_fr, type,
         storage_path, url, size_kb, downloadable, status, is_published
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        lessonId || null,
        moduleId || null,
        nameEn,
        nameFr || nameEn,
        type,
        storagePath || null,
        url,
        sizeKb,
        downloadable,
        status,
        isPublished,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: "Resource attached successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/resources/:id
 */
router.delete("/resources/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const resRow = await pool.query(`DELETE FROM resources WHERE id = $1 RETURNING *`, [id]);
    if (resRow.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Resource not found");
    }
    res.json({ success: true, message: "Resource removed successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
