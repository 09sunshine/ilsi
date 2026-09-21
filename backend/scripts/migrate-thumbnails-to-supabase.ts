import fs from "fs";
import path from "path";
import { pool } from "../src/database/pool.js";
import { supabaseAdmin } from "../src/integrations/supabase/client.js";

async function runMigration() {
  console.log("=== Starting Thumbnail Migration to Supabase Storage ===");

  // 1. Ensure course-thumbnails bucket exists and is public
  try {
    const { data: bucket, error: getErr } = await supabaseAdmin.storage.getBucket("course-thumbnails");
    if (getErr || !bucket) {
      console.log("Creating 'course-thumbnails' bucket...");
      await supabaseAdmin.storage.createBucket("course-thumbnails", { public: true });
    } else if (!bucket.public) {
      console.log("Setting 'course-thumbnails' bucket to public...");
      await supabaseAdmin.storage.updateBucket("course-thumbnails", { public: true });
    }
  } catch (err) {
    console.warn("Notice checking bucket:", err);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  // 2. Query cohorts with local /uploads thumbnails
  const cohortsRes = await pool.query(
    "SELECT id, name_en, thumbnail_url FROM cohorts WHERE thumbnail_url LIKE '/uploads/%' OR thumbnail_url LIKE 'uploads/%'"
  );

  console.log(`Found ${cohortsRes.rows.length} cohort(s) with local thumbnails.`);

  for (const cohort of cohortsRes.rows) {
    const filename = path.basename(cohort.thumbnail_url);
    const localFilePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(localFilePath)) {
      console.warn(`Local file not found for cohort ${cohort.id}: ${localFilePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(localFilePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    const storagePath = `cohort-covers/${filename}`;

    console.log(`Uploading ${filename} to Supabase 'course-thumbnails'...`);
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("course-thumbnails")
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (uploadErr) {
      console.error(`Failed to upload ${filename} to Supabase:`, uploadErr);
      continue;
    }

    const { data: pubData } = supabaseAdmin.storage
      .from("course-thumbnails")
      .getPublicUrl(storagePath);

    const newUrl = pubData.publicUrl;
    console.log(`Uploaded! New Supabase URL: ${newUrl}`);

    await pool.query("UPDATE cohorts SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2", [
      newUrl,
      cohort.id,
    ]);
    console.log(`Updated cohort [${cohort.name_en}] thumbnail_url.`);
  }

  // 3. Query programs with local /uploads thumbnails
  const programsRes = await pool.query(
    "SELECT id, title_en, thumbnail_url FROM programs WHERE thumbnail_url LIKE '/uploads/%' OR thumbnail_url LIKE 'uploads/%'"
  );

  console.log(`Found ${programsRes.rows.length} program(s) with local thumbnails.`);

  for (const program of programsRes.rows) {
    const filename = path.basename(program.thumbnail_url);
    const storagePath = `cohort-covers/${filename}`;

    const { data: pubData } = supabaseAdmin.storage
      .from("course-thumbnails")
      .getPublicUrl(storagePath);

    const newUrl = pubData.publicUrl;
    await pool.query("UPDATE programs SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2", [
      newUrl,
      program.id,
    ]);
    console.log(`Updated program [${program.title_en}] thumbnail_url.`);
  }

  console.log("=== Thumbnail Migration Complete ===");
  await pool.end();
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
