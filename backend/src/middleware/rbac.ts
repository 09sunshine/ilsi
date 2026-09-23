import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { Role } from "../types/domain.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: Role;
        status: string;
        firstLogin: boolean;
        locale: "en" | "fr";
      };
      session?: any;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: (session.user as any).role || "PARTICIPANT",
        status: (session.user as any).status || "ACTIVE",
        firstLogin: (session.user as any).firstLogin ?? true,
        locale: (session.user as any).locale || "fr",
      };
      req.session = session.session;
    }
    next();
  } catch (error) {
    // If session validation fails, continue without user attached
    next();
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError(401, ErrorCodes.AUTH_REQUIRED, "Authentication is required to access this resource");
  }
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, ErrorCodes.AUTH_REQUIRED, "Authentication is required");
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "You do not have permission to perform this action");
    }
    next();
  };
}

export function requireOnboardingCompleted(req: Request, _res: Response, next: NextFunction): void {
  if (req.user && req.user.role === "PARTICIPANT" && req.user.firstLogin) {
    throw new AppError(
      403,
      ErrorCodes.ONBOARDING_REQUIRED,
      "First-login onboarding and password setup must be completed before accessing the LMS"
    );
  }
  next();
}
