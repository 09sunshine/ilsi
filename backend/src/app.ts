import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authenticate } from "./middleware/rbac.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiters.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import studentRoutes from "./routes/student.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import path from "path";
import paymentRoutes from "./routes/payment.routes.js";
import googleRoutes from "./routes/google.routes.js";
import supportRoutes from "./routes/support.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import programRoutes from "./routes/program.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const app = express();

// Trust reverse proxies (Render, Cloudflare, AWS) so that req.ip and X-Forwarded-For are trusted properly
app.set("trust proxy", 1);

// Security & Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Resolve allowed CORS origins cleanly (stripping trailing slashes, supporting comma-separated list and previews)
const configuredOrigins = (env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, "").toLowerCase())
  .filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

const allowedOriginsSet = new Set([...configuredOrigins, ...defaultDevOrigins]);

const isAllowedOrigin = (origin: string): boolean => {
  const clean = origin.replace(/\/+$/, "").toLowerCase();
  if (allowedOriginsSet.has(clean)) return true;
  if (clean.startsWith("http://localhost:") || clean.startsWith("http://127.0.0.1:")) return true;
  if (clean.endsWith(".vercel.app") || clean.includes(".vercel.app")) return true;
  if (clean.endsWith(".pages.dev") || clean.includes(".pages.dev")) return true;
  if (clean.endsWith(".netlify.app") || clean.includes(".netlify.app")) return true;
  if (clean.endsWith(".onrender.com") || clean.includes(".onrender.com")) return true;
  if (clean.includes("ilsicampus.org")) return true;
  return false;
};

// Immediate preflight handler to prevent 404s from downstream routers (e.g. Better Auth)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
      res.setHeader(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] ||
          "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    return res.status(204).end();
  }
  next();
});

const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, webhooks)
    if (!requestOrigin) return callback(null, true);

    if (isAllowedOrigin(requestOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin "${requestOrigin}" is not in allowed origins list.`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Global IP rate limiting across the entire API
app.use("/api", globalLimiter);

app.use(morgan("dev"));
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Session Authentication Middleware
app.use(authenticate);

// Health checks (Root & /api/health)
app.all("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "ILSI LMS Backend", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Mount Route Handlers
// Public endpoints (Support, Contact, Programs, Applications) mounted before routers with root middlewares
app.use("/api/support", supportRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api", authRoutes);
app.use("/api/programs", programRoutes);
app.use("/api", applicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api", paymentRoutes); // also mounts /api/enrollments/:id/payment, etc.
app.use("/api/student", studentRoutes);
app.use("/api", studentRoutes); // also mounts /api/lessons, /api/quizzes, /api/live-sessions
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/api/admin", adminRoutes);
app.use("/api/admin", uploadRoutes);
app.use("/api/google", googleRoutes);


// Centralized Error Handler
app.use(errorHandler);

export default app;
