import emailjs from "@emailjs/nodejs";
import { pool } from "../../database/pool.js";
import {
  generateAcceptedEmail,
  generateWaitlistedEmail,
  generateRejectedEmail,
  GeneratedEmail,
} from "./emailTemplates.js";

export interface SendStatusEmailOptions {
  applicationId: string;
  newStatus: string;
  notes?: string;
}

export interface EmailSendResult {
  sent: boolean;
  provider?: "EMAILJS" | "RESEND" | "NONE";
  reason?: string;
  messageId?: string;
}

export class EmailService {
  /**
   * Determine frontend URL for email deep linking.
   * Guarantees all email links strictly point to the production deployment URL https://www.ilsicampus.org
   * and never use localhost.
   */
  private static getFrontendUrl(): string {
    const configured = (process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    if (
      configured &&
      !configured.includes("localhost") &&
      !configured.includes("127.0.0.1") &&
      configured.startsWith("https://")
    ) {
      return configured;
    }
    return "https://www.ilsicampus.org";
  }

  /**
   * Evaluates if student is already registered and has paid tuition.
   * "dont send any mail to student who are already registered and paid"
   */
  static async isStudentAlreadyPaid(applicationId: string, email: string, cohortId?: string): Promise<boolean> {
    try {
      // 1. Direct application check
      const appRes = await pool.query(
        `SELECT payment_status, status FROM applications WHERE id = $1`,
        [applicationId]
      );
      if (appRes.rows.length > 0) {
        const app = appRes.rows[0];
        if (app.payment_status === "PAID" || app.status === "ENROLLED") {
          return true;
        }
      }

      // 2. Verified payment record check (via application_id or applicant email)
      const payRes = await pool.query(
        `SELECT p.id FROM payments p
         WHERE p.status = 'PAID'
           AND (p.application_id = $1 OR p.user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($2)))
         LIMIT 1`,
        [applicationId, email]
      );
      if (payRes.rows.length > 0) {
        return true;
      }

      // 3. Paid enrollment check
      if (cohortId) {
        const enrollRes = await pool.query(
          `SELECT id FROM enrollments 
           WHERE cohort_id = $1 
             AND user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($2))
             AND payment_status = 'PAID'
           LIMIT 1`,
          [cohortId, email]
        );
        if (enrollRes.rows.length > 0) {
          return true;
        }
      }

      return false;
    } catch (err) {
      console.warn("[EmailService] Error checking paid status, defaulting to safe check:", err);
      return false;
    }
  }

  /**
   * Dispatches application status update email to student (SELECTED/ACCEPTED, WAITLISTED, REJECTED).
   * Runs asynchronously to keep admin API latency within 100-300ms.
   */
  static async sendApplicationStatusEmail(options: SendStatusEmailOptions): Promise<EmailSendResult> {
    const { applicationId, newStatus } = options;
    const normalizedStatus = (newStatus || "").toUpperCase().trim();

    // Only acceptance, waitlist, or reject trigger emails
    const isAccepted = normalizedStatus === "ACCEPTED" || normalizedStatus === "SELECTED";
    const isWaitlisted = normalizedStatus === "WAITLISTED";
    const isRejected = normalizedStatus === "REJECTED";

    if (!isAccepted && !isWaitlisted && !isRejected) {
      console.log(`[EmailService] Status '${normalizedStatus}' does not warrant a candidate notification email.`);
      return { sent: false, reason: "STATUS_NOT_NOTIFIED" };
    }

    try {
      // Fetch application and linked program & cohort details
      const appQuery = await pool.query(
        `SELECT a.id, a.first_name, a.last_name, a.email, a.status, a.payment_status,
                a.cohort_id, a.program_id,
                p.title_en as program_title_en, p.title_fr as program_title_fr,
                c.name_en as cohort_name_en, c.name_fr as cohort_name_fr,
                c.fee_amount, c.fee_currency
         FROM applications a
         LEFT JOIN programs p ON p.id = a.program_id
         LEFT JOIN cohorts c ON c.id = a.cohort_id
         WHERE a.id = $1`,
        [applicationId]
      );

      if (appQuery.rows.length === 0) {
        console.warn(`[EmailService] Application ${applicationId} not found.`);
        return { sent: false, reason: "APPLICATION_NOT_FOUND" };
      }

      const app = appQuery.rows[0];

      // Verify rule: "dont send any mail to student who are already registered and paid"
      const alreadyPaid = await this.isStudentAlreadyPaid(app.id, app.email, app.cohort_id);
      if (alreadyPaid) {
        console.log(`[EmailService] Skipping status email for ${app.email}: Applicant is already registered and paid.`);
        return { sent: false, reason: "ALREADY_REGISTERED_AND_PAID" };
      }

      // Cohort fallback resolution if cohort_id was not explicitly set on application
      let cohortName = app.cohort_name_fr || app.cohort_name_en;
      let feeAmount = app.fee_amount;
      let feeCurrency = app.fee_currency || "USD";

      if (!cohortName && app.program_id) {
        const cohortRes = await pool.query(
          `SELECT name_en, name_fr, fee_amount, fee_currency FROM cohorts 
           WHERE program_id = $1 AND status IN ('ACTIVE', 'APPLICATION_OPEN', 'UPCOMING')
           ORDER BY start_date ASC LIMIT 1`,
          [app.program_id]
        );
        if (cohortRes.rows.length > 0) {
          cohortName = cohortRes.rows[0].name_fr || cohortRes.rows[0].name_en;
          feeAmount = feeAmount || cohortRes.rows[0].fee_amount;
          feeCurrency = cohortRes.rows[0].fee_currency || feeCurrency;
        }
      }

      const candidateName = `${app.first_name} ${app.last_name}`.trim();
      const programTitle = app.program_title_fr || app.program_title_en || "Programme ILSI";
      const trackingNumber = app.id;
      const siteUrl = this.getFrontendUrl();
      const trackingLink = `${siteUrl}/track-application?id=${encodeURIComponent(trackingNumber)}&email=${encodeURIComponent(app.email)}`;
      const paymentLink = trackingLink;

      // Generate customized HTML & text template based on status
      let generated: GeneratedEmail;
      let emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID || "";

      if (isAccepted) {
        emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID_ACCEPTED || emailjsTemplateId;
        generated = generateAcceptedEmail({
          candidateName,
          candidateEmail: app.email,
          trackingNumber,
          programTitle,
          cohortName: cohortName || "Cohorte assignée",
          feeAmount,
          feeCurrency,
          paymentLink,
          trackingLink,
          siteUrl,
        });
      } else if (isWaitlisted) {
        emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID_WAITLISTED || emailjsTemplateId;
        generated = generateWaitlistedEmail({
          candidateName,
          candidateEmail: app.email,
          trackingNumber,
          programTitle,
          cohortName: cohortName || "Prochaine cohorte",
          trackingLink,
          siteUrl,
        });
      } else {
        emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID_REJECTED || emailjsTemplateId;
        generated = generateRejectedEmail({
          candidateName,
          candidateEmail: app.email,
          trackingNumber,
          programTitle,
          trackingLink,
          siteUrl,
        });
      }

      // Dispatch via EmailJS (with fallback to Resend)
      return await this.dispatchEmail({
        toEmail: app.email,
        toName: candidateName,
        subject: generated.subject,
        html: generated.html,
        text: generated.text,
        trackingNumber,
        programTitle,
        cohortName: cohortName || "",
        status: normalizedStatus,
        paymentLink,
        templateId: emailjsTemplateId,
      });
    } catch (err: any) {
      console.error(`[EmailService] Failed to send status email for application ${applicationId}:`, err.message);
      return { sent: false, reason: err.message };
    }
  }

  /**
   * Internal dispatcher: Attempts EmailJS first, then falls back to Resend API.
   */
  private static async dispatchEmail(params: {
    toEmail: string;
    toName: string;
    subject: string;
    html: string;
    text: string;
    trackingNumber: string;
    programTitle: string;
    cohortName: string;
    status: string;
    paymentLink: string;
    templateId?: string;
  }): Promise<EmailSendResult> {
    const {
      toEmail,
      toName,
      subject,
      html,
      text,
      trackingNumber,
      programTitle,
      cohortName,
      status,
      paymentLink,
      templateId,
    } = params;

    const emailjsServiceId = process.env.EMAILJS_SERVICE_ID;
    const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
    const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;
    const effectiveTemplateId = templateId || process.env.EMAILJS_TEMPLATE_ID;

    // 1. Try EmailJS if credentials are configured
    if (emailjsServiceId && emailjsPublicKey && effectiveTemplateId) {
      try {
        console.log(`[EmailService] Sending email to ${toEmail} via EmailJS (service: ${emailjsServiceId})...`);

        const templateParams: Record<string, any> = {
          to_name: toName,
          to_email: toEmail,
          user_email: toEmail,
          candidate_name: toName,
          tracking_number: trackingNumber,
          application_id: trackingNumber,
          program_title: programTitle,
          program_name: programTitle,
          cohort_name: cohortName,
          status: status,
          subject: subject,
          message_html: html,
          message_text: text,
          payment_link: paymentLink,
          tracking_link: paymentLink,
          payment_steps: `1. Rendez-vous sur ${paymentLink}\n2. Choisissez votre mode de paiement (Pay'm MonCash/Natcash en HTG ou PayPal/Carte en USD/EUR)\n3. Dès confirmation, activez votre compte étudiant.`,
        };

        const res = await emailjs.send(
          emailjsServiceId,
          effectiveTemplateId,
          templateParams,
          {
            publicKey: emailjsPublicKey,
            privateKey: emailjsPrivateKey,
          }
        );

        console.log(`[EmailService] Email successfully sent via EmailJS to ${toEmail} (status: ${res.status}, text: ${res.text})`);
        return {
          sent: true,
          provider: "EMAILJS",
          messageId: `emailjs_${Date.now()}`,
        };
      } catch (emailjsErr: any) {
        console.warn(`[EmailService] EmailJS delivery failed: ${emailjsErr.message || emailjsErr}. Attempting Resend fallback...`);
      }
    } else {
      console.log("[EmailService] EmailJS keys not fully configured in env, using Resend delivery...");
    }

    // 2. Resend Delivery Fallback
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";

    if (resendApiKey) {
      try {
        console.log(`[EmailService] Sending email to ${toEmail} via Resend (${emailFrom})...`);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: toEmail,
            subject: subject,
            html: html,
            text: text,
          }),
        });

        const data = (await res.json()) as any;
        if (!res.ok) {
          throw new Error(data.message || `Resend returned HTTP ${res.status}`);
        }

        console.log(`[EmailService] Email successfully sent via Resend to ${toEmail} (ID: ${data.id})`);
        return {
          sent: true,
          provider: "RESEND",
          messageId: data.id,
        };
      } catch (resendErr: any) {
        console.error(`[EmailService] Resend delivery also failed:`, resendErr.message);
        return {
          sent: false,
          provider: "NONE",
          reason: resendErr.message,
        };
      }
    }

    console.warn(`[EmailService] Neither EmailJS nor Resend configured. Simulated send for ${toEmail}: "${subject}"`);
    return {
      sent: true,
      provider: "NONE",
      reason: "SIMULATED_NO_KEYS",
    };
  }
}
