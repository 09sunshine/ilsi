import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../database/pool.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { applicationLimiter, authLimiter } from "../middleware/rateLimiters.js";
import { validateRequest } from "../middleware/validate.js";
import { applicationSchemas } from "../validators/schemas.js";
import { PaymentService } from "../services/PaymentService.js";
import { hashPassword } from "better-auth/crypto";
import { auth } from "../config/auth.js";
import { NotificationService } from "../services/NotificationService.js";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

/**
 * POST /api/applications
 * Public admissions application submission with rate limiting, Zod validation, and 24h deduplication.
 */
router.post(
  "/applications",
  applicationLimiter,
  validateRequest({ body: applicationSchemas.submit }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        country,
        city,
        dateOfBirth,
        education,
        occupation,
        organization,
        programId,
        cohortId,
        motivation,
        experience,
      } = req.body;

      const normalizedEmail = email.trim().toLowerCase();

      // 1. Verify program exists safely without invalid UUID cast errors
      let progRes;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programId);
      if (isUuid) {
        progRes = await pool.query(`SELECT id FROM programs WHERE id = $1`, [programId]);
      } else {
        const cleanedSlug = programId.replace(/^prg-/, "");
        progRes = await pool.query(
          `SELECT id FROM programs WHERE slug = $1 OR slug = $2`,
          [programId, cleanedSlug]
        );
      }

      if (progRes.rows.length === 0) {
        progRes = await pool.query(`SELECT id FROM programs ORDER BY created_at ASC LIMIT 1`);
      }

      if (progRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.VALIDATION_ERROR, "Invalid program selected");
      }
      const realProgramId = progRes.rows[0].id;

      // 2. Resolve target Cohort ID
      let realCohortId = cohortId || null;
      if (realCohortId) {
        const checkCohort = await pool.query(`SELECT id FROM cohorts WHERE id = $1`, [realCohortId]);
        if (checkCohort.rows.length === 0) {
          realCohortId = null;
        }
      }
      if (!realCohortId) {
        const activeCohort = await pool.query(
          `SELECT id FROM cohorts 
           WHERE program_id = $1 AND status IN ('ACTIVE', 'APPLICATION_OPEN', 'UPCOMING')
           ORDER BY start_date ASC LIMIT 1`,
          [realProgramId]
        );
        realCohortId = activeCohort.rows[0]?.id || null;
      }

      // 3. Deduplication check: Prevent multiple submissions from same email for same program within 24 hours
      const existingRes = await pool.query(
        `SELECT id, submitted_at FROM applications 
         WHERE email = $1 AND program_id = $2 AND submitted_at > NOW() - INTERVAL '24 hours'`,
        [normalizedEmail, realProgramId]
      );

      if (existingRes.rows.length > 0) {
        throw new AppError(
          409,
          "DUPLICATE_APPLICATION",
          "An application with this email address was already submitted within the last 24 hours. Our admissions team is currently reviewing your file."
        );
      }

      // 4. Insert application safely with parameterized query
      const result = await pool.query(
        `INSERT INTO applications (
           program_id, cohort_id, first_name, last_name, email, phone, country, city,
           date_of_birth, education, occupation, organization, motivation, experience, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDING')
         RETURNING id, cohort_id, submitted_at, status`,
        [
          realProgramId,
          realCohortId,
          firstName.trim(),
          lastName.trim(),
          normalizedEmail,
          phone.trim(),
          country.trim(),
          city.trim(),
          dateOfBirth || null,
          education.trim(),
          occupation.trim(),
          organization ? organization.trim() : "",
          motivation.trim(),
          experience ? experience.trim() : "",
        ]
      );

      // Notify Admins of new application
      void NotificationService.notifyAdmins({
        type: "APPLICATION",
        titleEn: "New Application Received",
        titleFr: "Nouvelle candidature reçue",
        bodyEn: `${firstName} ${lastName} submitted an application for admissions.`,
        bodyFr: `${firstName} ${lastName} a soumis un dossier de candidature.`,
      });

      res.status(201).json({
        success: true,
        data: {
          id: result.rows[0].id,
          cohortId: result.rows[0].cohort_id,
          status: result.rows[0].status,
          submittedAt: result.rows[0].submitted_at.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/applications/track
 * Allows applicants to track their submission using email or application ID,
 * and if accepted, displays cohort details and checkout link.
 */
router.post(
  "/applications/track",
  applicationLimiter,
  validateRequest({ body: applicationSchemas.track }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, applicationId } = req.body;

      let query = `
        SELECT a.id, a.program_id, a.cohort_id, a.first_name, a.last_name, a.email, a.phone,
               a.country, a.city, a.status, a.payment_status as app_payment_status,
               a.submitted_at, a.updated_at,
               p.title_en as program_title_en, p.title_fr as program_title_fr, p.slug as program_slug,
               p.price as program_price, p.price_eur as program_price_eur, p.currency as program_currency,
               c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
               c.start_date as cohort_start_date, c.end_date as cohort_end_date,
               c.fee_amount, c.fee_currency, c.timezone, c.status as cohort_status
        FROM applications a
        JOIN programs p ON p.id = a.program_id
        LEFT JOIN cohorts c ON c.id = a.cohort_id
      `;
      const params: any[] = [];

      if (applicationId) {
        params.push(applicationId);
        query += ` WHERE a.id = $1`;
      } else {
        params.push(email.trim().toLowerCase());
        query += ` WHERE LOWER(a.email) = $1 ORDER BY a.submitted_at DESC LIMIT 1`;
      }

      const appRes = await pool.query(query, params);
      if (appRes.rows.length === 0) {
        throw new AppError(
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
          "No application found matching the provided details. Please check your email address or application ID."
        );
      }

      const app = appRes.rows[0];

      // Check if an enrollment exists for this applicant's user account in the cohort
      let enrollment: any = null;
      let userAccount: any = null;
      const userRes = await pool.query(
        `SELECT id, email, first_login FROM users WHERE LOWER(email) = $1`,
        [app.email.toLowerCase()]
      );
      if (userRes.rows.length > 0) {
        userAccount = userRes.rows[0];
        if (app.cohort_id) {
          const enrollRes = await pool.query(
            `SELECT id, user_id, cohort_id, status, payment_status 
             FROM enrollments 
             WHERE user_id = $1 AND cohort_id = $2`,
            [userAccount.id, app.cohort_id]
          );
          if (enrollRes.rows.length > 0) {
            enrollment = enrollRes.rows[0];
          }
        }
      }

      // Determine true tuition fee (cohort fee if > 0, fallback to program price)
      const officialTuition =
        Number(app.fee_amount) > 0
          ? Number(app.fee_amount)
          : Number(app.program_price || 95);
      const officialCurrency = app.fee_currency || app.program_currency || "USD";

      // If application is accepted and payment is pending, generate or return checkout session
      const isPaid = enrollment?.payment_status === "PAID" || app.app_payment_status === "PAID";
      let paymentInfo: any = {
        status: isPaid ? "PAID" : "PENDING",
        feeAmount: officialTuition,
        feeCurrency: officialCurrency,
        amount: officialTuition,
        currency: officialCurrency,
        checkoutUrl: null,
      };

      if (app.status === "ACCEPTED" || app.status === "SELECTED") {
        if (!isPaid && app.cohort_id) {
          try {
            const paymentIntent = await PaymentService.createPaymentIntent({
              cohortId: app.cohort_id,
              enrollmentId: enrollment?.id,
              userId: enrollment?.user_id,
              applicationId: app.id,
              customerEmail: app.email,
              cohortName: app.cohort_name_en || app.program_title_en,
              currency: officialCurrency,
            });
            paymentInfo.checkoutUrl = paymentIntent.checkoutUrl;
            paymentInfo.paymentId = paymentIntent.paymentId;
            paymentInfo.amount = paymentIntent.amount;
            paymentInfo.feeAmount = paymentIntent.amount;
            paymentInfo.currency = paymentIntent.currency;
            paymentInfo.feeCurrency = paymentIntent.currency;
          } catch (payErr: any) {
            console.warn("Could not generate checkout session for tracking:", payErr.message);
          }
        }
      }

      res.json({
        success: true,
        data: {
          applicationId: app.id,
          status: app.status,
          submittedAt: app.submitted_at ? app.submitted_at.toISOString() : null,
          applicant: {
            firstName: app.first_name,
            lastName: app.last_name,
            email: app.email,
            country: app.country,
            city: app.city,
          },
          program: {
            id: app.program_id,
            slug: app.program_slug,
            price: Number(app.program_price || 95),
            currency: app.program_currency || "USD",
            title: { en: app.program_title_en, fr: app.program_title_fr },
          },
          cohort: app.cohort_id
            ? {
                id: app.cohort_id,
                name: { en: app.cohort_name_en, fr: app.cohort_name_fr },
                startDate: app.cohort_start_date ? app.cohort_start_date.toISOString().split("T")[0] : null,
                endDate: app.cohort_end_date ? app.cohort_end_date.toISOString().split("T")[0] : null,
                feeAmount: officialTuition,
                feeCurrency: officialCurrency,
                timezone: app.timezone || "UTC",
                status: app.cohort_status,
              }
            : null,
          enrollment: enrollment
            ? {
                id: enrollment.id,
                status: enrollment.status,
                paymentStatus: enrollment.payment_status,
              }
            : null,
          account: {
            exists: Boolean(userAccount),
            isActivated: Boolean(userAccount && !userAccount.first_login),
            email: app.email,
          },
          payment: paymentInfo,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

const activateAccountSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

/**
 * POST /api/applications/activate-account
 * Allows an enrolled, paid applicant to set their account password directly from the tracking page.
 * Validates application status, sets the permanent credential password, and unlocks portal access.
 */
router.post(
  "/applications/activate-account",
  authLimiter,
  validateRequest({ body: activateAccountSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId, email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Verify application exists and belongs to this email
      const appRes = await pool.query(
        `SELECT id, first_name, last_name, email, phone, country, city, status, payment_status, cohort_id
         FROM applications
         WHERE id = $1 AND LOWER(email) = $2`,
        [applicationId, normalizedEmail]
      );

      if (appRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Application record not found.");
      }

      const app = appRes.rows[0];

      // Verify applicant is admitted and payment is confirmed
      const isPaid = app.payment_status === "PAID";
      const isAdmitted = app.status === "ENROLLED" || app.status === "ACCEPTED" || app.status === "SELECTED";
      if (!isAdmitted) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Application is not accepted yet.");
      }
      if (!isPaid) {
        throw new AppError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          "Please complete your cohort tuition payment before activating your student account."
        );
      }

      // 2. Hash the permanent password
      const hashedPassword = await hashPassword(password);

      // 3. Find or create user
      let userId: string;
      const userRes = await pool.query(`SELECT id, first_login FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);

      if (userRes.rows.length > 0) {
        // Prevent account takeover: if user already completed onboarding/activation, reject
        if (userRes.rows[0].first_login === false) {
          throw new AppError(
            400,
            "ACCOUNT_ALREADY_ACTIVATED",
            "This student account has already been activated. Please log in directly with your password."
          );
        }

        userId = userRes.rows[0].id;

        // Update credential account
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

        // Mark first_login as false
        await pool.query(`UPDATE users SET first_login = FALSE, updated_at = NOW() WHERE id = $1`, [userId]);
        await pool.query(`UPDATE "user" SET "firstLogin" = FALSE, "updatedAt" = NOW() WHERE id = $1`, [userId]);
      } else {
        // Create brand new user with Better Auth
        const newUser = await auth.api.signUpEmail({
          body: {
            email: normalizedEmail,
            password: password,
            name: `${app.first_name} ${app.last_name}`,
          },
        });

        if (!newUser?.user) {
          throw new AppError(500, "AUTH_ERROR", "Failed to create user account.");
        }

        userId = newUser.user.id;
        await pool.query(`UPDATE users SET role = 'PARTICIPANT', first_login = FALSE WHERE id = $1`, [userId]);
        await pool.query(
          `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE)
           ON CONFLICT (user_id) DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name`,
          [userId, app.first_name, app.last_name, app.phone, app.country, app.city]
        );
      }

      // 4. Ensure enrollment is active
      if (app.cohort_id) {
        await pool.query(
          `INSERT INTO enrollments (user_id, cohort_id, status, payment_status, enrolled_at)
           VALUES ($1, $2, 'ACTIVE', 'PAID', NOW())
           ON CONFLICT (user_id, cohort_id) DO UPDATE SET
             status = 'ACTIVE',
             payment_status = 'PAID',
             updated_at = NOW()`,
          [userId, app.cohort_id]
        );
      }

      // 5. Update application to ENROLLED
      await pool.query(`UPDATE applications SET status = 'ENROLLED', updated_at = NOW() WHERE id = $1`, [app.id]);

      res.json({
        success: true,
        message: "Your student account has been successfully activated. You can now log in.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
