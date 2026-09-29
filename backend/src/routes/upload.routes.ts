import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, requireRole } from "../middleware/rbac.js";
import { AppError } from "../constants/errors.js";
import { supabaseAdmin } from "../integrations/supabase/client.js";

const router = Router();

// Strictly restrict administrative upload endpoints to ADMIN & SUPER_ADMIN
router.use(requireAuth);
router.use(requireRole(["ADMIN", "SUPER_ADMIN"]));

// Allowed file extensions and types (Documents & Images for Course/Cohort Thumbnails)
const ALLOWED_EXTS = [
  ".pdf",
  ".ppt",
  ".pptx",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
];

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

// Memory storage for direct Supabase uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          "INVALID_FILE_TYPE",
          `Unsupported file type ${ext}. Allowed types: PDF, PPT, PPTX, DOC, DOCX, JPG, JPEG, PNG, WEBP, GIF, SVG`
        )
      );
    }
  },
});

// Video upload configuration (up to 500MB)
const VIDEO_EXTS = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"];
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const cleanBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (VIDEO_EXTS.includes(ext) || (file.mimetype && file.mimetype.startsWith("video/"))) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          "INVALID_VIDEO_TYPE",
          `Unsupported video type ${ext}. Allowed types: MP4, MOV, WEBM, MKV, AVI, M4V`
        )
      );
    }
  },
});

// Single file upload endpoint (Documents & Thumbnails to Supabase Storage)
router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response, next) => {
    try {
      if (!req.file) {
        throw new AppError(400, "NO_FILE_UPLOADED", "No file was uploaded");
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const cleanBase = path
        .basename(req.file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const uniqueFilename = `${cleanBase}-${uniqueSuffix}${ext}`;

      const isImage = IMAGE_EXTS.includes(ext);
      const bucket = isImage ? "course-thumbnails" : "course-resources";
      const storageFolder = isImage ? "cohort-covers" : "documents";
      const storagePath = `${storageFolder}/${uniqueFilename}`;

      const mimeType =
        req.file.mimetype ||
        (isImage
          ? ext === ".png"
            ? "image/png"
            : ext === ".webp"
            ? "image/webp"
            : ext === ".svg"
            ? "image/svg+xml"
            : "image/jpeg"
          : "application/octet-stream");

      let fileUrl = "";

      // Try uploading to Supabase Storage, with fallback to local disk
      try {
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(bucket)
          .upload(storagePath, req.file.buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: pubData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(storagePath);
          fileUrl = pubData.publicUrl;
        } else {
          console.warn(`[Supabase Storage ${bucket}] upload failed, falling back to local disk:`, uploadErr.message);
        }
      } catch (err: any) {
        console.warn(`[Supabase Storage] unexpected error, falling back to local disk:`, err?.message);
      }

      // If Supabase upload didn't produce URL, save to local disk public/uploads
      if (!fileUrl) {
        const localFolder = path.join(process.cwd(), "public", "uploads", storageFolder);
        if (!fs.existsSync(localFolder)) {
          fs.mkdirSync(localFolder, { recursive: true });
        }
        const diskPath = path.join(localFolder, uniqueFilename);
        fs.writeFileSync(diskPath, req.file.buffer);
        fileUrl = `/uploads/${storageFolder}/${uniqueFilename}`;
      }

      const sizeKb = Math.round(req.file.size / 1024);

      res.json({
        success: true,
        data: {
          url: fileUrl,
          name: req.file.originalname,
          filename: uniqueFilename,
          storagePath,
          sizeKb,
          type: ext.replace(".", ""),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/upload-video
 * Uploads lesson video with Supabase Storage and local disk fallback
 */
router.post(
  "/upload-video",
  requireAuth,
  videoUpload.single("video"),
  async (req: Request, res: Response, next) => {
    try {
      if (!req.file) {
        throw new AppError(400, "NO_FILE_UPLOADED", "No video file was uploaded");
      }

      const tempFilePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      const cleanBase = path
        .basename(req.file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      const uniqueFilename = `${cleanBase}-${Date.now()}${ext}`;
      const storagePath = `lessons/${uniqueFilename}`;

      let finalVideoUrl = "";

      // Try uploading to Supabase Storage 'course-videos' bucket
      try {
        const fileBuffer = fs.readFileSync(tempFilePath);
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("course-videos")
          .upload(storagePath, fileBuffer, {
            contentType: req.file.mimetype || "video/mp4",
            upsert: true,
          });

        if (!uploadErr) {
          const { data: signedData } = await supabaseAdmin.storage
            .from("course-videos")
            .createSignedUrl(storagePath, 86400 * 7); // 7 days

          if (signedData?.signedUrl) {
            finalVideoUrl = signedData.signedUrl;
          } else {
            const { data: pubData } = supabaseAdmin.storage
              .from("course-videos")
              .getPublicUrl(storagePath);
            finalVideoUrl = pubData?.publicUrl || "";
          }

          // Cleanup temp file since it was successfully uploaded to cloud
          try {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
          } catch {}
        } else {
          console.warn("[Supabase Storage Video] upload failed, keeping local file:", uploadErr.message);
        }
      } catch (cloudErr: any) {
        console.warn("[Supabase Storage Video] unexpected error, keeping local file:", cloudErr?.message);
      }

      // If Supabase upload didn't produce URL, preserve the local temp file in public/uploads
      if (!finalVideoUrl) {
        const localFileName = path.basename(tempFilePath);
        finalVideoUrl = `/uploads/${localFileName}`;
      }

      res.json({
        success: true,
        data: {
          storagePath,
          url: finalVideoUrl,
          fileName: req.file.originalname,
          fileSizeBytes: req.file.size,
          sizeMb: Number((req.file.size / (1024 * 1024)).toFixed(2)),
          mimeType: req.file.mimetype,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

