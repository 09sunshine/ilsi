import { Router, Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { hashPassword } from "better-auth/crypto";
import crypto from "crypto";
import { auth } from "../config/auth.js";
import { requireAuth } from "../middleware/rbac.js";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { validateRequest } from "../middleware/validate.js";
import { authSchemas } from "../validators/schemas.js";

const router = Router();

/**
 * POST /api/auth/first-login-password
 * Mandatory one-time password change on first login.
 * MUST be declared BEFORE router.all("/auth/*", ...) so Express does not route it to Better Auth's catch-all handler.
 */
router.post(
  "/auth/first-login-password",
  requireAuth,
  validateRequest({ body: authSchemas.firstLoginPassword }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { newPassword, currentPassword } = req.body;
      const userId = req.user!.id;

      // 1. Hash the new permanent password using Better-Auth's password hasher
      const hashedPassword = await hashPassword(newPassword);

      // 2. Check if a credential account exists in Better Auth's account table
      const existingAccount = await pool.query(
        `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`,
        [userId]
      );

      if (existingAccount.rows.length > 0) {
        await pool.query(
          `UPDATE account SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
          [hashedPassword, existingAccount.rows[0].id]
        );
      } else {
        const accountId = crypto.randomUUID().replace(/-/g, "");
        await pool.query(
          `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
          [accountId, userId, userId, hashedPassword]
        );
      }

      // 3. Mark first_login as false in both users and user tables
      await pool.query(
        `UPDATE users SET first_login = FALSE, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      await pool.query(
        `UPDATE "user" SET "firstLogin" = FALSE, "updatedAt" = NOW() WHERE id = $1`,
        [userId]
      );

      // 4. Also call Better-Auth changePassword if possible to refresh internal session state
      try {
        await (auth.api as any).changePassword({
          headers: req.headers,
          body: {
            newPassword,
            currentPassword: currentPassword || "",
            revokeOtherSessions: false,
          },
        });
      } catch {
        // Direct database update already succeeded
      }

      res.json({
        success: true,
        message: "Password updated successfully. Account is now permanently activated.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Mount Better Auth handler on /api/auth/* with brute-force rate limiter
router.all("/auth/*", authLimiter, toNodeHandler(auth));

/**
 * GET /api/profile
 * Retrieves user profile details
 */
router.get("/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.first_login, u.locale,
              p.first_name, p.last_name, p.phone, p.country, p.city, p.avatar_url, p.onboarding_completed
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.USER_NOT_FOUND, "User not found");
    }

    const row = userRes.rows[0];
    res.json({
      success: true,
      data: {
        id: row.id,
        email: row.email,
        name: row.name,
        firstName: row.first_name || row.name.split(" ")[0] || "",
        lastName: row.last_name || row.name.split(" ").slice(1).join(" ") || "",
        phone: row.phone || "",
        country: row.country || "",
        city: row.city || "",
        avatarUrl: row.avatar_url,
        role: row.role,
        locale: row.locale,
        firstLogin: row.first_login,
        onboardingCompleted: row.onboarding_completed ?? false,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/profile
 * Updates basic profile info with Zod schema sanitization
 */
router.patch(
  "/profile",
  requireAuth,
  validateRequest({ body: authSchemas.updateProfile }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, phone, country, city, locale } = req.body;
    const userId = req.user!.id;

    if (locale && (locale === "en" || locale === "fr")) {
      await pool.query(`UPDATE users SET locale = $1, updated_at = NOW() WHERE id = $2`, [locale, userId]);
    }

    if (firstName && lastName) {
      await pool.query(`UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`, [`${firstName} ${lastName}`, userId]);
    }

    await pool.query(
      `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
         last_name = COALESCE(EXCLUDED.last_name, profiles.last_name),
         phone = COALESCE(EXCLUDED.phone, profiles.phone),
         country = COALESCE(EXCLUDED.country, profiles.country),
         city = COALESCE(EXCLUDED.city, profiles.city),
         updated_at = NOW()`,
      [userId, firstName || "", lastName || "", phone || null, country || null, city || null]
    );

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/profile/complete-onboarding
 * Completes mandatory first-login profile onboarding & password change
 */
router.post(
  "/profile/complete-onboarding",
  requireAuth,
  validateRequest({ body: authSchemas.onboarding }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { firstName, lastName, phone, country, city, locale, newPassword } = req.body;
      const userId = req.user!.id;

      if (!newPassword || newPassword.length < 8) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "A new password of at least 8 characters is required");
      }

      // 1. Change password in Better Auth
      try {
        await auth.api.changePassword({
          headers: req.headers,
          body: {
            newPassword,
            currentPassword: req.body.currentPassword || "",
            revokeOtherSessions: false,
          },
        });
      } catch {
        const hashedPassword = await hashPassword(newPassword);
        const existingAccount = await pool.query(
          `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential'`,
          [userId]
        );
        if (existingAccount.rows.length > 0) {
          await pool.query(
            `UPDATE account SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
            [hashedPassword, existingAccount.rows[0].id]
          );
        } else {
          const accountId = crypto.randomUUID().replace(/-/g, "");
          await pool.query(
            `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
             VALUES ($1, $2, 'credential', $3, $4, NOW(), NOW())`,
            [accountId, userId, userId, hashedPassword]
          );
        }
      }

      // 2. Update profile details
      if (locale && (locale === "en" || locale === "fr")) {
        await pool.query(`UPDATE users SET locale = $1 WHERE id = $2`, [locale, userId]);
      }

      const fullName = `${firstName || ""} ${lastName || ""}`.trim();
      if (fullName) {
        await pool.query(`UPDATE users SET name = $1 WHERE id = $2`, [fullName, userId]);
      }

      await pool.query(
        `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (user_id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone = EXCLUDED.phone,
           country = EXCLUDED.country,
           city = EXCLUDED.city,
           onboarding_completed = TRUE,
           updated_at = NOW()`,
        [userId, firstName || "", lastName || "", phone || "", country || "", city || ""]
      );

      // 3. Mark first_login as false
      await pool.query(
        `UPDATE users SET first_login = FALSE, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      await pool.query(
        `UPDATE "user" SET "firstLogin" = FALSE, "updatedAt" = NOW() WHERE id = $1`,
        [userId]
      );

      res.json({
        success: true,
        message: "Onboarding completed successfully. LMS access unlocked.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

