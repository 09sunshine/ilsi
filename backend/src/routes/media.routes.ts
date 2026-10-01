import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";

const router = Router();

// Cache directory on disk for proxied assets
const CACHE_DIR = path.join(process.cwd(), "public", "uploads", "cache");
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn("[MediaProxy] Could not create cache directory:", err);
  }
}

/**
 * GET /api/media/proxy
 * Safe media proxy for Supabase Storage images to prevent browser adblocker drops,
 * mixed content issues, and slow cross-origin connection timeouts.
 */
router.get("/proxy", async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string | undefined;

  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).json({ error: "Missing 'url' query parameter" });
    return;
  }

  const trimmed = targetUrl.trim();

  // Validate allowed domains to prevent SSRF
  const isSupabase =
    trimmed.includes("supabase.co/storage") ||
    (env.SUPABASE_URL && trimmed.startsWith(env.SUPABASE_URL));
  const isRelative = trimmed.startsWith("/") && !trimmed.startsWith("//");

  if (!isSupabase && !isRelative) {
    res.status(403).json({ error: "URL destination is not authorized for proxying" });
    return;
  }

  // Extract clean filename (strip query params and hashes safely)
  let filename = "";
  try {
    const baseUrl = env.BETTER_AUTH_URL || `${req.protocol}://${req.get("host") || "localhost"}`;
    const parsed = new URL(trimmed, baseUrl);
    filename = path.basename(parsed.pathname);
  } catch {
    filename = path.basename(trimmed.split("?")[0].split("#")[0]);
  }

  // 1. Check local file candidates
  const candidatePaths = [
    path.join(process.cwd(), "public", "uploads", "cohort-covers", filename),
    path.join(process.cwd(), "public", "uploads", filename),
    path.join(CACHE_DIR, filename),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.sendFile(candidate);
      return;
    }
  }

  // 2. Fetch remotely if not cached locally
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const remoteRes = await fetch(trimmed, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!remoteRes.ok) {
      res.status(remoteRes.status).json({
        error: `Remote asset returned status ${remoteRes.status}`,
      });
      return;
    }

    const contentType = remoteRes.headers.get("content-type") || "image/png";
    const arrayBuffer = await remoteRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to disk cache asynchronously
    if (filename && buffer.length > 0) {
      try {
        const dest = path.join(CACHE_DIR, filename);
        fs.writeFile(dest, buffer, (err) => {
          if (err) console.warn("[MediaProxy] Cache write error:", err.message);
        });
      } catch (saveErr: any) {
        console.warn("[MediaProxy] Could not write cache:", saveErr.message);
      }
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch (error: any) {
    console.warn(`[MediaProxy] Error proxying asset ${trimmed}:`, error?.message);
    res.status(502).json({ error: "Failed to fetch remote asset" });
  }
});

export default router;
