import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export interface CreateNotificationParams {
  userId: string;
  type: string;
  titleEn: string;
  titleFr: string;
  bodyEn: string;
  bodyFr: string;
}

export class NotificationService {
  /**
   * Insert a new notification for a specific user.
   */
  static async create(params: CreateNotificationParams) {
    const { userId, type, titleEn, titleFr, bodyEn, bodyFr } = params;

    const res = await pool.query(
      `INSERT INTO notifications (
         user_id, type, title_en, title_fr, body_en, body_fr, read, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
       RETURNING id, user_id, type, title_en, title_fr, body_en, body_fr, read, created_at`,
      [userId, type, titleEn, titleFr, bodyEn, bodyFr]
    );

    return res.rows[0];
  }

  /**
   * Broadcast a notification to all active administrators.
   */
  static async notifyAdmins(params: Omit<CreateNotificationParams, "userId">) {
    try {
      const adminRes = await pool.query(
        `SELECT id FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN')`
      );

      for (const admin of adminRes.rows) {
        await this.create({
          userId: admin.id,
          ...params,
        });
      }
    } catch (err) {
      console.error("[NotificationService] Failed to notify admins:", err);
    }
  }

  /**
   * Broadcast a notification to all students enrolled in a specific cohort.
   */
  static async notifyCohortStudents(
    cohortId: string,
    params: Omit<CreateNotificationParams, "userId">
  ) {
    try {
      const studentRes = await pool.query(
        `SELECT DISTINCT user_id FROM enrollments WHERE cohort_id = $1`,
        [cohortId]
      );

      for (const row of studentRes.rows) {
        await this.create({
          userId: row.user_id,
          ...params,
        });
      }
    } catch (err) {
      console.error("[NotificationService] Failed to notify cohort students:", err);
    }
  }

  /**
   * Fetch paginated notifications for a given user.
   */
  static async getUserNotifications(userId: string, limit: number = 50) {
    const res = await pool.query(
      `SELECT id, type, title_en, title_fr, body_en, body_fr, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return res.rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: { en: n.title_en, fr: n.title_fr },
      body: { en: n.body_en, fr: n.body_fr },
      read: n.read,
      createdAt: n.created_at.toISOString(),
    }));
  }

  /**
   * Mark all notifications as read for a user.
   */
  static async markAllRead(userId: string) {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1`,
      [userId]
    );
    return { success: true };
  }

  /**
   * Mark a single notification as read.
   */
  static async markAsRead(notificationId: string, userId: string) {
    const res = await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id, read`,
      [notificationId, userId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Notification not found");
    }

    return res.rows[0];
  }

  /**
   * Delete a notification.
   */
  static async delete(notificationId: string, userId: string) {
    const res = await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Notification not found");
    }

    return { success: true };
  }

  /**
   * Seed initial system notifications for active users if none exist.
   */
  static async seedInitialNotifications() {
    const countRes = await pool.query(`SELECT COUNT(*) FROM notifications`);
    if (parseInt(countRes.rows[0].count, 10) > 0) {
      return; // Already populated
    }

    console.log("[NotificationService] Seeding initial notifications...");

    // 1. Seed notifications for Super Admin / Admin
    const admins = await pool.query(
      `SELECT id, name FROM users WHERE role IN ('SUPER_ADMIN', 'ADMIN')`
    );

    for (const admin of admins.rows) {
      await this.create({
        userId: admin.id,
        type: "SYSTEM",
        titleEn: "Welcome to ILSI Admin Console",
        titleFr: "Bienvenue sur la console d'administration ILSI",
        bodyEn: "Your administrative control room is fully configured. Monitor cohort admissions, syllabus progress, and payments in real time.",
        bodyFr: "Votre console d'administration est prête. Suivez les admissions, la progression pédagogique et les paiements en temps réel.",
      });

      await this.create({
        userId: admin.id,
        type: "PAYMENT",
        titleEn: "Stripe & Supabase Storage Configured",
        titleFr: "Stripe et Stockage Supabase configurés",
        bodyEn: "Cohort cover thumbnails and course materials are now securely stored in Supabase CDN with automated backups.",
        bodyFr: "Les miniatures de cohortes et supports de cours sont désormais hébergés sur le CDN Supabase sécurisé.",
      });
    }

    // 2. Seed notifications for Participants
    const students = await pool.query(
      `SELECT id, name FROM users WHERE role = 'PARTICIPANT'`
    );

    for (const student of students.rows) {
      await this.create({
        userId: student.id,
        type: "APPLICATION",
        titleEn: "Welcome to your ILSI Cohort!",
        titleFr: "Bienvenue dans votre cohorte ILSI !",
        bodyEn: "Your admission has been confirmed. Access your modules, join live debriefs, and track your graduation progress from your dashboard.",
        bodyFr: "Votre admission est confirmée. Accédez à vos modules, rejoignez les sessions en direct et suivez votre progression.",
      });

      await this.create({
        userId: student.id,
        type: "MODULE_UNLOCKED",
        titleEn: "Course Curriculum Ready",
        titleFr: "Programme de formation accessible",
        bodyEn: "Module 1 is now available for your cohort. Complete lessons, review resources, and take quizzes to progress.",
        bodyFr: "Le module 1 est disponible pour votre cohorte. Complétez vos leçons et validez les quiz pour avancer.",
      });
    }

    console.log("[NotificationService] Initial notifications seeded successfully.");
  }
}
