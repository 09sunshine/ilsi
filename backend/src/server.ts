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
        ALTER TABLE IF EXISTS quiz_answers ADD COLUMN IF NOT EXISTS manual_score NUMERIC(5,2);
        ALTER TABLE IF EXISTS quiz_answers ADD COLUMN IF NOT EXISTS manual_rating VARCHAR(50);
        ALTER TABLE IF EXISTS quiz_answers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
        ALTER TABLE IF EXISTS quiz_answers ADD COLUMN IF NOT EXISTS graded_by TEXT;
        ALTER TABLE IF EXISTS cohort_ranking_entries ADD COLUMN IF NOT EXISTS completed_lessons INT NOT NULL DEFAULT 0;
        ALTER TABLE IF EXISTS cohort_ranking_entries ADD COLUMN IF NOT EXISTS total_lessons INT NOT NULL DEFAULT 0;
        ALTER TABLE IF EXISTS cohort_ranking_entries ADD COLUMN IF NOT EXISTS max_possible_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00;
        CREATE TABLE IF NOT EXISTS cohort_module_ranking_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            snapshot_id UUID NOT NULL REFERENCES cohort_ranking_snapshots(id) ON DELETE CASCADE,
            cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
            module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rank INT,
            score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
            points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
            completed_lessons INT NOT NULL DEFAULT 0,
            total_lessons INT NOT NULL DEFAULT 0,
            max_possible_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
            is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
            ineligibility_reason VARCHAR(100),
            rank_change INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_module_ranking_snapshot_module_user UNIQUE (snapshot_id, module_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_module_ranking_snapshot_module_rank
            ON cohort_module_ranking_entries (snapshot_id, module_id, is_eligible, rank ASC);
        CREATE INDEX IF NOT EXISTS idx_module_ranking_user_module
            ON cohort_module_ranking_entries (user_id, module_id);
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
