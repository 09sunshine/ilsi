import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool.js";

async function startServer() {
  try {
    // Verify database connection and ensure compatibility columns exist
    console.log("[Server] Testing database connection...");
    const client = await pool.connect();
    try {
      await client.query(`
        ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';
        ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE IF EXISTS resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        ALTER TABLE IF EXISTS quiz_questions ADD COLUMN IF NOT EXISTS correct_text TEXT;
        ALTER TABLE IF EXISTS quiz_questions ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'MULTIPLE_CHOICE';
      `);
      console.log("[Server] Database connection & schema compatibility verified successfully.");
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("[Server] Warning: Could not connect to PostgreSQL database directly:", err.message);
    console.warn("[Server] Continuing server startup (ensure DATABASE_URL in .env points to your Supabase instance).");
  }

  const port = Number.isInteger(env.PORT) && env.PORT > 0 ? env.PORT : 10000;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`====================================================`);
    console.log(`🚀 ILSI LMS Backend running on port ${port}`);
    console.log(`📡 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 Allowed Frontend: ${env.FRONTEND_URL}`);
    console.log(`====================================================`);
  });

  // Ensure Node.js HTTP server does not terminate large video upload streams
  server.timeout = 10 * 60 * 1000; // 10 minutes
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  if ("requestTimeout" in server) {
    (server as any).requestTimeout = 10 * 60 * 1000;
  }

  const shutdown = async () => {
    console.log("\n[Server] Shutting down gracefully...");
    server.close(async () => {
      await pool.end();
      console.log("[Server] Database pool closed. Process terminated.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();
