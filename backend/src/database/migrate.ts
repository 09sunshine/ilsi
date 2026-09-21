import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("[Migrations] Beginning database schema migration...");
    const migrationsDir = path.resolve(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

    await client.query("BEGIN");

    // Track migration status in _migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query("SELECT 1 FROM _migrations WHERE name = $1", [file]);
      if (rows.length > 0) {
        console.log(`[Migrations] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`[Migrations] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`[Migrations] Applied ${file} successfully.`);
    }

    await client.query("COMMIT");
    console.log("[Migrations] All migrations completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Migrations] Error executing migrations:", error);
    throw error;
  } finally {
    client.release();
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
