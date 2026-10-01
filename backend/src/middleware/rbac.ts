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

interface CachedSession {
  user: NonNullable<Express.Request["user"]>;
  session: any;
  expiresAt: number;
}

// In-memory session cache with 30-second TTL to avoid redundant Postgres queries on every request
const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 30_000;

export function clearSessionCache(): void {
  sessionCache.clear();
}

function cleanExpiredSessions() {
  if (sessionCache.size > 1000) {
    const now = Date.now();
    for (const [key, val] of sessionCache.entries()) {
      if (val.expiresAt <= now) {
        sessionCache.delete(key);
      }
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie;

  // Fast-path: Skip Better Auth lookup if no authorization header and no session cookies exist
  if (!authHeader && (!cookieHeader || !cookieHeader.includes("session"))) {
    return next();
  }

  const cacheKey = authHeader ? `hdr:${authHeader}` : `cookie:${cookieHeader}`;
  const now = Date.now();
  const cached = sessionCache.get(cacheKey);

  if (cached) {
    if (cached.expiresAt > now) {
      req.user = cached.user;
      req.session = cached.session;
      return next();
    } else {
      sessionCache.delete(cacheKey);
    }
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

      cleanExpiredSessions();
      sessionCache.set(cacheKey, {
        user: req.user,
        session: req.session,
        expiresAt: now + SESSION_CACHE_TTL_MS,
      });
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
