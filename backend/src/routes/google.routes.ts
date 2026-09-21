import { Router, Request, Response, NextFunction } from "express";
import { GoogleMeetService } from "../integrations/google/meet.js";
import { requireAuth, requireRole } from "../middleware/rbac.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * GET /api/google/auth
 * Redirects admin to Google OAuth consent screen
 */
router.get("/auth", requireAuth, requireRole(["ADMIN", "SUPER_ADMIN"]), (req: Request, res: Response) => {
  const authUrl = GoogleMeetService.getAuthorizationUrl(req.user!.id);
  res.redirect(authUrl);
});

/**
 * GET /api/google/callback
 * Handles OAuth redirection from Google
 */
router.get("/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;
    if (typeof code === "string" && typeof state === "string") {
      await GoogleMeetService.handleOAuthCallback(code, state);
      // Redirect back to admin dashboard
      res.redirect(`${env.FRONTEND_URL}/admin?google_connected=true`);
      return;
    }
    res.status(400).send("Invalid OAuth callback parameters.");
  } catch (error) {
    next(error);
  }
});

export default router;
