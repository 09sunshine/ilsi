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

// Security & Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Resolve allowed CORS origins cleanly (stripping trailing slashes, supporting comma-separated list and previews)
const configuredOrigins = (env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
];

const allowedOriginsSet = new Set([...configuredOrigins, ...defaultDevOrigins]);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, webhooks)
      if (!requestOrigin) return callback(null, true);
      const cleanOrigin = requestOrigin.replace(/\/+$/, "");
      if (
        allowedOriginsSet.has(cleanOrigin) ||
        cleanOrigin.endsWith(".vercel.app") ||
        cleanOrigin.endsWith(".pages.dev")
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Mount Route Handlers
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
app.use("/api/support", supportRoutes);
app.use("/api/contact", contactRoutes);


// Centralized Error Handler
app.use(errorHandler);

export default app;
