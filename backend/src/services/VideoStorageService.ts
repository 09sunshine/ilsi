import { pool } from "../database/pool.js";
import { supabaseAdmin } from "../integrations/supabase/client.js";
import { ModuleAccessService } from "./ModuleAccessService.js";
import { LessonAccessService } from "./LessonAccessService.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

interface CachedVideoPlayback {
  playbackUrl: string;
  durationSeconds: number;
  thumbnailUrl?: string;
  expiresAt: number;
}

// In-memory cache for signed playback URLs (50-minute TTL for a 60-minute signed URL)
const signedPlaybackUrlCache = new Map<string, CachedVideoPlayback>();
const SIGNED_URL_CACHE_TTL_MS = 50 * 60 * 1000;

export function invalidateVideoUrlCache(lessonId?: string): void {
  if (lessonId) {
    signedPlaybackUrlCache.delete(lessonId);
  } else {
    signedPlaybackUrlCache.clear();
  }
}

export class VideoStorageService {
  private static readonly BUCKET_NAME = "course-videos";

  /**
   * Authorizes and generates a short-lived signed URL for course video playback.
   * Leverages an in-memory TTL cache to eliminate redundant Supabase Storage API round trips.
   */
  static async getAuthorizedPlaybackUrl(
    lessonId: string,
    userId: string,
    isAdmin: boolean = false,
    targetCohortId?: string,
    skipAccessCheck: boolean = false
  ) {
    let lessonDurationMinutes = 15;

    // 1. If not admin and not pre-verified, strictly verify lesson and module access
    if (!isAdmin && !skipAccessCheck) {
      const lessonRes = await pool.query(
        `SELECT id, module_id, duration_minutes FROM lessons WHERE id = $1`,
        [lessonId]
      );

      if (lessonRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.LESSON_NOT_FOUND, "Lesson not found");
      }

      const lesson = lessonRes.rows[0];
      lessonDurationMinutes = lesson.duration_minutes || 15;

      try {
        await LessonAccessService.assertAccess(userId, lessonId, targetCohortId);
        if (lesson.module_id) {
          await ModuleAccessService.assertAccess(userId, lesson.module_id);
        }
      } catch (err: any) {
        throw new AppError(
          403,
          ErrorCodes.VIDEO_ACCESS_DENIED,
          `Video access denied: ${err?.message || "Unauthorized cohort content"}`
        );
      }
    }

    // 2. Check in-memory signed URL cache (returns in <1ms)
    const now = Date.now();
    const cached = signedPlaybackUrlCache.get(lessonId);
    if (cached && cached.expiresAt > now) {
      return {
        playbackUrl: cached.playbackUrl,
        durationSeconds: cached.durationSeconds,
        thumbnailUrl: cached.thumbnailUrl,
      };
    }

    // 3. Find video record
    const videoRes = await pool.query(
      `SELECT id, storage_path, duration_seconds, thumbnail_path, file_name 
       FROM videos 
       WHERE lesson_id = $1`,
      [lessonId]
    );

    if (videoRes.rows.length === 0) {
      // Return null or placeholder if video hasn't been uploaded yet
      return null;
    }

    const video = videoRes.rows[0];

    // 4. Check if external link (YouTube, Vimeo, Loom, or external video URL)
    const isExternal =
      typeof video.storage_path === "string" &&
      video.storage_path.startsWith("http") &&
      !video.storage_path.includes("supabase.co/storage");

    if (isExternal) {
      const result = {
        playbackUrl: video.storage_path,
        durationSeconds: video.duration_seconds || lessonDurationMinutes * 60,
        thumbnailUrl: video.thumbnail_path,
      };
      // External links don't expire; cache for 24 hours
      signedPlaybackUrlCache.set(lessonId, {
        ...result,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
      return result;
    }

    // 5. Generate signed URL from Supabase Storage (valid for 1 hour)
    try {
      let relPath = video.storage_path;
      if (typeof relPath === "string" && relPath.includes("/course-videos/")) {
        relPath = relPath.split("/course-videos/")[1].split("?")[0];
      }

      const { data, error } = await supabaseAdmin.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(relPath, 3600);

      if (error || !data?.signedUrl) {
        console.error("[Supabase Storage Error]:", error);
        // Fallback: try public URL
        const { data: pubData } = supabaseAdmin.storage
          .from(this.BUCKET_NAME)
          .getPublicUrl(relPath);

        return {
          playbackUrl: pubData?.publicUrl || (video.storage_path.startsWith("http") ? video.storage_path : null),
          durationSeconds: video.duration_seconds || lessonDurationMinutes * 60,
          thumbnailUrl: video.thumbnail_path,
        };
      }

      const result = {
        playbackUrl: data.signedUrl,
        durationSeconds: video.duration_seconds || lessonDurationMinutes * 60,
        thumbnailUrl: video.thumbnail_path,
      };

      // Cache valid signed URL for 50 minutes to eliminate repetitive storage API calls
      signedPlaybackUrlCache.set(lessonId, {
        ...result,
        expiresAt: now + SIGNED_URL_CACHE_TTL_MS,
      });

      return result;
    } catch (err) {
      console.error("[Signed URL Generation Failed]:", err);
      return {
        playbackUrl: video.storage_path.startsWith("http") ? video.storage_path : null,
        durationSeconds: video.duration_seconds || lessonDurationMinutes * 60,
        thumbnailUrl: video.thumbnail_path,
      };
    }
  }

  /**
   * Generates a signed URL for private course resources/PDFs
   */
  static async getAuthorizedResourceUrl(resourceId: string, userId: string, isAdmin: boolean = false, targetCohortId?: string) {
    const res = await pool.query(
      `SELECT r.id, r.module_id, r.lesson_id, r.storage_path, r.url 
       FROM resources r 
       WHERE r.id = $1`,
      [resourceId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, "Resource not found");
    }

    const resource = res.rows[0];

    if (!isAdmin) {
      if (resource.lesson_id) {
        await LessonAccessService.assertAccess(userId, resource.lesson_id, targetCohortId);
      }
      if (resource.module_id) {
        await ModuleAccessService.assertAccess(userId, resource.module_id);
      }
    }

    if (resource.storage_path) {
      const { data, error } = await supabaseAdmin.storage
        .from("course-resources")
        .createSignedUrl(resource.storage_path, 3600);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }

    return resource.url || null;
  }
}
