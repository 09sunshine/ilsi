import app from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool.js";

async function startServer() {
  try {
    // Verify database connection
    console.log("[Server] Testing database connection...");
    const client = await pool.connect();
    console.log("[Server] Database connection verified successfully.");
    client.release();
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
