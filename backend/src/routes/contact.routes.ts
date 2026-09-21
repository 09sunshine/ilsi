import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../database/pool.js";
import { validateRequest } from "../middleware/validate.js";
import { formSubmissionLimiter } from "../middleware/rateLimiters.js";
import { contactSchemas } from "../validators/schemas.js";
import { NotificationService } from "../services/NotificationService.js";

const router = Router();

const handleContactSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, subject, message } = req.body;
    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message, status)
       VALUES ($1, $2, $3, $4, 'UNREAD')
       RETURNING id, name, email, subject, message, status, created_at`,
      [name, email, subject, message]
    );

    void NotificationService.notifyAdmins({
      type: "SYSTEM",
      titleEn: "New Contact Inquiry",
      titleFr: "Nouveau message de contact",
      bodyEn: `${name} sent a message: "${subject || 'General Inquiry'}".`,
      bodyFr: `${name} a envoyé un message : "${subject || 'Demande générale'}".`,
    });

    res.status(201).json({
      success: true,
      message: "Thank you for contacting ILSI! Your message has been received and our team will get back to you shortly.",
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/contact
 * POST /api/contact/submit
 * Public contact form submission
 */
router.post(
  "/",
  formSubmissionLimiter,
  validateRequest({ body: contactSchemas.submit }),
  handleContactSubmission
);

router.post(
  "/submit",
  formSubmissionLimiter,
  validateRequest({ body: contactSchemas.submit }),
  handleContactSubmission
);

export default router;
