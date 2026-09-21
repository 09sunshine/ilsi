import { pool } from "./pool.js";
import { auth } from "../config/auth.js";

/**
 * Clean seed utility.
 * Removes all mock/seed data. Only ensures an initial admin account exists if needed.
 */
export async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log("[Seed] Checking default admin user...");
    await client.query("BEGIN");

    const adminEmail = process.env.ADMIN_EMAIL || "admin@ilsi-leadership.org";
    const existingAdmin = await client.query("SELECT id FROM users WHERE email = $1", [adminEmail]);

    if (existingAdmin.rows.length === 0) {
      console.log(`[Seed] Creating initial administrator account: ${adminEmail}...`);
      const adminRes = await auth.api.signUpEmail({
        body: {
          email: adminEmail,
          password: process.env.ADMIN_PASSWORD || "AdminPassword123!",
          name: "ILSI Administrator",
        },
      });
      const adminId = adminRes.user.id;
      await client.query(
        `UPDATE users SET role = 'SUPER_ADMIN', first_login = FALSE, locale = 'en' WHERE id = $1`,
        [adminId]
      );
      await client.query(
        `INSERT INTO profiles (user_id, first_name, last_name, phone, country, city, onboarding_completed)
         VALUES ($1, 'ILSI', 'Admin', '+33 1 00 00 00 00', 'France', 'Paris', TRUE)
         ON CONFLICT (user_id) DO NOTHING`,
        [adminId]
      );
      console.log("[Seed] Initial administrator account created successfully.");
    } else {
      console.log("[Seed] Administrator account already exists.");
    }

    await client.query("COMMIT");
    console.log("[Seed] Database is clean and ready for custom testing data.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Seed] Error:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
