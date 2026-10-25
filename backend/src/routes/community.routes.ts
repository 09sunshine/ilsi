import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  communityPostLimiter,
  communityCommentLimiter,
  communityReactionLimiter,
  communityReportLimiter,
  communityUploadLimiter,
  communitySearchLimiter,
  communityFeedLimiter,
} from "../middleware/rateLimiters.js";
import { communitySchemas } from "../validators/schemas.js";
import { CommunityService } from "../services/CommunityService.js";
import { AppError, ErrorCodes } from "../constants/errors.js";
import { supabaseAdmin } from "../integrations/supabase/client.js";
import { sanitizeStorageFilename } from "./upload.routes.js";

const router = Router();

// Permitted community attachment file extensions
const COMMUNITY_ALLOWED_EXTS = [
  ".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".zip",
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"
];

const communityAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (COMMUNITY_ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          ErrorCodes.VALIDATION_ERROR,
          `Unsupported file type ${ext}. Allowed formats: PDF, Word, PowerPoint, Excel, text, ZIP, and images (JPG, PNG, WebP, GIF, SVG).`
        )
      );
    }
  },
});

// All community endpoints require an authenticated user
router.use(requireAuth);

/**
 * POST /api/community/upload-attachment
 * Uploads an attachment to Supabase Storage ('community-attachments' bucket)
 * with robust fallback to 'course-resources' and local disk.
 */
router.post(
  "/upload-attachment",
  communityUploadLimiter,
  communityAttachmentUpload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "No file uploaded");
      }

      const { ext, uniqueFilename } = sanitizeStorageFilename(req.file.originalname);
      const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext);
      const isPdf = ext === ".pdf";
      const fileType = isImage ? "IMAGE" : isPdf ? "PDF" : "DOCUMENT";
      const mimeType = req.file.mimetype || "application/octet-stream";
      let storagePath = `posts/${uniqueFilename}`;

      let fileUrl = "";

      // 1. Attempt upload to Supabase Storage bucket 'community-attachments'
      try {
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("community-attachments")
          .upload(storagePath, req.file.buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = supabaseAdmin.storage
            .from("community-attachments")
            .getPublicUrl(storagePath);
          fileUrl = pubData?.publicUrl || "";
        } else {
          // 2. Fallback attempt to 'course-resources' bucket
          const { error: fallbackErr } = await supabaseAdmin.storage
            .from("course-resources")
            .upload(storagePath, req.file.buffer, {
              contentType: mimeType,
              upsert: true,
            });
          if (!fallbackErr) {
            fileUrl = supabaseAdmin.storage.from("course-resources").getPublicUrl(storagePath).data.publicUrl;
          }
        }
      } catch (err: any) {
        console.warn("[Community Attachment Upload] Supabase upload failed, using local disk fallback:", err?.message || err);
      }

      // 3. Disk fallback if cloud storage failed
      if (!fileUrl) {
        const localFolder = path.join(process.cwd(), "public", "uploads", "community");
        if (!fs.existsSync(localFolder)) {
          fs.mkdirSync(localFolder, { recursive: true });
        }
        const diskPath = path.join(localFolder, uniqueFilename);
        fs.writeFileSync(diskPath, req.file.buffer);
        fileUrl = `/uploads/community/${uniqueFilename}`;
        storagePath = fileUrl;
      }

      res.status(201).json({
        success: true,
        data: {
          storagePath,
          fileName: req.file.originalname,
          fileType,
          mimeType,
          fileSizeBytes: req.file.size,
          url: fileUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/cohorts
 * Returns the cohort community spaces accessible to the authenticated user.
 */
router.get("/cohorts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cohorts = await CommunityService.getUserAccessibleCohorts(req.user!.id, req.user!.role);
    res.json({ success: true, data: cohorts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/community/posts
 * Query: scope ('cohort' | 'global'), cohortId, page, limit, type, search, authorId
 */
router.get("/posts", communityFeedLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = (req.query.scope as "cohort" | "global") || "global";
    const cohortId = req.query.cohortId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;
    const authorId = req.query.authorId as string | undefined;

    const result = await CommunityService.listPosts({
      scope,
      cohortId,
      currentUserId: req.user!.id,
      currentUserRole: req.user!.role,
      page,
      limit,
      type,
      search,
      authorId,
    });

    res.json({
      success: true,
      data: {
        posts: result.posts,
        pagination: result.pagination,
      },
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/community/posts/:id
 */
router.get("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await CommunityService.getPostById(
      req.params.id as string,
      req.user!.id,
      req.user!.role
    );
    res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/posts
 */
router.post(
  "/posts",
  communityPostLimiter,
  validate(communitySchemas.createPost),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scope, cohortId, type, title, content, attachments } = req.body;
      const post = await CommunityService.createPost({
        authorId: req.user!.id,
        authorRole: req.user!.role,
        scope,
        cohortId,
        type,
        title,
        content,
        attachments,
      });

      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/community/posts/:id
 */
router.patch(
  "/posts/:id",
  validate(communitySchemas.updatePost),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await CommunityService.updatePost(
        req.params.id as string,
        req.user!.id,
        req.user!.role,
        req.body
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/community/posts/:id
 */
router.delete("/posts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CommunityService.deletePost(
      req.params.id as string,
      req.user!.id,
      req.user!.role,
      req.body.reason
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/community/posts/:id/comments
 */
router.get("/posts/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comments = await CommunityService.listComments(
      req.params.id as string,
      req.user!.id,
      req.user!.role
    );
    res.json({ success: true, data: comments });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/posts/:id/comments
 */
router.post(
  "/posts/:id/comments",
  communityCommentLimiter,
  validate(communitySchemas.createComment),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, parentCommentId } = req.body;
      const comment = await CommunityService.createComment({
        postId: req.params.id as string,
        authorId: req.user!.id,
        currentUserRole: req.user!.role,
        content,
        parentCommentId,
      });
      res.status(201).json({ success: true, data: comment });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/community/comments/:id
 */
router.delete("/comments/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CommunityService.deleteComment(
      req.params.id as string,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/reactions
 */
router.post(
  "/reactions",
  communityReactionLimiter,
  validate(communitySchemas.reaction),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetType, targetId, reactionType } = req.body;
      const result = await CommunityService.toggleReaction({
        userId: req.user!.id,
        targetType,
        targetId,
        reactionType,
        currentUserRole: req.user!.role,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/attachments/:id/access-url
 * Authoritatively authorizes and issues short-lived signed access URL for post attachments.
 */
router.get(
  "/attachments/:id/access-url",
  communityUploadLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await CommunityService.getAttachmentSignedUrl(
        req.params.id as string,
        req.user!.id,
        req.user!.role
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/profiles/:id
 * Public community profile.
 */
router.get("/profiles/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await CommunityService.getCommunityProfile(req.params.id as string, req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/community/profile
 * Updates the current user's community profile.
 */
router.put(
  "/profile",
  validate(communitySchemas.updateCommunityProfile),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await CommunityService.updateCommunityProfile(req.user!.id, req.body);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/members
 * Search and discover community members.
 */
router.get("/members", communitySearchLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;
    const skill = req.query.skill as string | undefined;
    const interest = req.query.interest as string | undefined;
    const programId = req.query.programId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const members = await CommunityService.searchMembers({
      query,
      skill,
      interest,
      programId,
      limit,
      offset,
    });
    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/projects
 */
router.post(
  "/projects",
  validate(communitySchemas.project),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await CommunityService.createProject(req.user!.id, req.body);
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/community/projects/:id
 */
router.delete("/projects/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CommunityService.deleteProject(req.params.id as string, req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/reports
 */
router.post(
  "/reports",
  communityReportLimiter,
  validate(communitySchemas.report),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await CommunityService.createReport(req.user!.id, req.body);
      res.status(201).json({
        success: true,
        message: "Thank you for helping keep our community safe. Our team will review this report.",
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * ADMIN & MODERATION ROUTES
 */

/**
 * GET /api/community/admin/stats
 */
router.get(
  "/admin/stats",
  requireRole(["SUPER_ADMIN", "ADMIN"]),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await CommunityService.getCommunityStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/admin/reports
 */
router.get(
  "/admin/reports",
  requireRole(["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const reports = await CommunityService.listReports({ status });
      res.json({ success: true, data: reports });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/community/admin/reports/:id/resolve
 */
router.post(
  "/admin/reports/:id/resolve",
  requireRole(["SUPER_ADMIN", "ADMIN"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await CommunityService.resolveReport(req.user!.id, req.params.id as string, req.body);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/community/admin/posts/:id/moderate
 */
router.post(
  "/admin/posts/:id/moderate",
  requireRole(["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"]),
  validate(communitySchemas.moderationAction),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await CommunityService.moderatePost(
        req.user!.id,
        req.user!.role,
        req.params.id as string,
        req.body.action,
        req.body.reason
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/community/admin/audit-logs
 */
router.get(
  "/admin/audit-logs",
  requireRole(["SUPER_ADMIN", "ADMIN"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const logs = await CommunityService.listAuditLogs(limit, offset);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
