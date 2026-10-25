import { pool } from "../database/pool.js";
import { supabaseAdmin } from "../integrations/supabase/client.js";
import { NotificationService } from "./NotificationService.js";
import { AppError, ErrorCodes } from "../constants/errors.js";

export interface PostAttachmentInput {
  storagePath: string;
  fileName: string;
  fileType: "IMAGE" | "DOCUMENT" | "PDF";
  mimeType: string;
  fileSizeBytes: number;
}

export class CommunityService {
  private static readonly STORAGE_BUCKET = "community-attachments";

  /**
   * Checks whether a user can access a specific cohort community.
   * Admins have access to all cohort communities.
   * Instructors must be assigned via cohort_instructors.
   * Students must have an ACTIVE or COMPLETED enrollment with PAID or NOT_REQUIRED payment status.
   */
  static async canAccessCohort(userId: string, cohortId: string, role?: string): Promise<boolean> {
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      return true;
    }

    const res = await pool.query(
      `SELECT 1 FROM (
         SELECT cohort_id, user_id FROM cohort_instructors WHERE cohort_id = $1 AND user_id = $2
         UNION ALL
         SELECT cohort_id, user_id FROM enrollments WHERE cohort_id = $1 AND user_id = $2 AND status IN ('ACTIVE', 'COMPLETED') AND payment_status IN ('PAID', 'NOT_REQUIRED')
       ) q LIMIT 1`,
      [cohortId, userId]
    );

    return res.rows.length > 0;
  }

  /**
   * Asserts cohort access and throws 403 if unauthorized.
   */
  static async assertCohortAccess(userId: string, cohortId: string, role?: string): Promise<void> {
    const hasAccess = await this.canAccessCohort(userId, cohortId, role);
    if (!hasAccess) {
      throw new AppError(
        403,
        ErrorCodes.FORBIDDEN,
        "You do not have access to this private cohort community space."
      );
    }
  }

  /**
   * Returns list of cohort communities the user is authorized to access.
   */
  static async getUserAccessibleCohorts(userId: string, role?: string) {
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      const res = await pool.query(
        `SELECT c.id, c.name_en, c.name_fr, c.status, c.start_date, c.end_date,
                p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr,
                'ADMIN' as user_role
         FROM cohorts c
         JOIN programs p ON p.id = c.program_id
         ORDER BY c.start_date DESC`
      );
      return res.rows;
    }

    const res = await pool.query(
      `SELECT c.id, c.name_en, c.name_fr, c.status, c.start_date, c.end_date,
              p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr,
              'INSTRUCTOR' as user_role
       FROM cohort_instructors ci
       JOIN cohorts c ON c.id = ci.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE ci.user_id = $1
       UNION
       SELECT c.id, c.name_en, c.name_fr, c.status, c.start_date, c.end_date,
              p.id as program_id, p.title_en as program_title_en, p.title_fr as program_title_fr,
              'STUDENT' as user_role
       FROM enrollments e
       JOIN cohorts c ON c.id = e.cohort_id
       JOIN programs p ON p.id = c.program_id
       WHERE e.user_id = $1 
         AND e.status IN ('ACTIVE', 'COMPLETED')
         AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
       ORDER BY start_date DESC`,
      [userId]
    );

    return res.rows;
  }

  /**
   * Lists posts for either cohort feed or global feed.
   */
  static async listPosts(params: {
    scope: "cohort" | "global";
    cohortId?: string;
    currentUserId: string;
    currentUserRole?: string;
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    authorId?: string;
  }) {
    const {
      scope,
      cohortId,
      currentUserId,
      currentUserRole,
      page = 1,
      limit = 20,
      type,
      search,
      authorId,
    } = params;

    if (scope === "cohort") {
      if (!cohortId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "cohortId is required for cohort feed");
      }
      await this.assertCohortAccess(currentUserId, cohortId, currentUserRole);
    }

    const offset = (Math.max(1, page) - 1) * limit;
    const values: any[] = [scope];
    let query = `
      SELECT p.id, p.author_id, p.scope, p.cohort_id, p.type, p.title, p.content,
             p.pinned, p.pinned_at, p.featured, p.status, p.like_count, p.comment_count,
             p.created_at, p.updated_at,
             u.name as author_name, u.image as author_image, u.role as author_role,
             ucp.headline as author_headline,
             EXISTS(
               SELECT 1 FROM cohort_instructors ci 
               WHERE ci.cohort_id = p.cohort_id AND ci.user_id = p.author_id
             ) as author_is_cohort_trainer,
             (
               SELECT reaction_type 
               FROM community_reactions cr 
               WHERE cr.target_type = 'post' 
                 AND cr.target_id = p.id 
                 AND cr.user_id = $${values.length + 1}
               LIMIT 1
             ) as user_reaction,
             (
               SELECT json_agg(
                 json_build_object(
                   'id', a.id,
                   'storagePath', a.storage_path,
                   'fileName', a.file_name,
                   'fileType', a.file_type,
                   'mimeType', a.mime_type,
                   'fileSizeBytes', a.file_size_bytes
                 )
               )
               FROM community_post_attachments a
               WHERE a.post_id = p.id
             ) as attachments,
             (
               SELECT json_object_agg(reaction_type, cnt)
               FROM (
                 SELECT reaction_type, count(*) as cnt
                 FROM community_reactions
                 WHERE target_type = 'post' AND target_id = p.id
                 GROUP BY reaction_type
               ) r_counts
             ) as reactions_breakdown
      FROM community_posts p
      JOIN users u ON u.id = p.author_id
      LEFT JOIN user_community_profiles ucp ON ucp.user_id = p.author_id
      WHERE p.scope = $1
    `;

    values.push(currentUserId);

    if (scope === "cohort") {
      values.push(cohortId);
      query += ` AND p.cohort_id = $${values.length}`;
    }

    if (authorId) {
      values.push(authorId);
      query += ` AND p.author_id = $${values.length}`;
    }

    // Role-based visibility
    if (currentUserRole !== "SUPER_ADMIN" && currentUserRole !== "ADMIN") {
      query += ` AND p.status = 'ACTIVE' AND p.deleted_at IS NULL`;
    } else {
      query += ` AND p.status != 'REMOVED' AND p.deleted_at IS NULL`;
    }

    if (type) {
      values.push(type);
      query += ` AND p.type = $${values.length}`;
    }

    if (search && search.trim()) {
      values.push(`%${search.trim()}%`);
      query += ` AND (p.content ILIKE $${values.length} OR p.title ILIKE $${values.length})`;
    }

    query += ` ORDER BY p.pinned DESC, p.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    // Execute feed listing query
    const res = await pool.query(query, values);

    // Fast-path pagination: if on page 1 and results are less than limit, totalCount is exactly res.rows.length
    let totalCount = res.rows.length;
    if (page > 1 || res.rows.length === limit) {
      const countValues: any[] = [scope];
      let countQuery = `SELECT COUNT(*) FROM community_posts p WHERE p.scope = $1`;
      if (scope === "cohort") {
        countValues.push(cohortId);
        countQuery += ` AND p.cohort_id = $${countValues.length}`;
      }
      if (authorId) {
        countValues.push(authorId);
        countQuery += ` AND p.author_id = $${countValues.length}`;
      }
      if (currentUserRole !== "SUPER_ADMIN" && currentUserRole !== "ADMIN") {
        countQuery += ` AND p.status = 'ACTIVE' AND p.deleted_at IS NULL`;
      } else {
        countQuery += ` AND p.status != 'REMOVED' AND p.deleted_at IS NULL`;
      }
      if (type) {
        countValues.push(type);
        countQuery += ` AND p.type = $${countValues.length}`;
      }
      if (search && search.trim()) {
        countValues.push(`%${search.trim()}%`);
        countQuery += ` AND (p.content ILIKE $${countValues.length} OR p.title ILIKE $${countValues.length})`;
      }

      const countRes = await pool.query(countQuery, countValues);
      totalCount = parseInt(countRes.rows[0]?.count || "0", 10);
    }

    return {
      posts: res.rows.map((row) => ({
        ...row,
        attachments: row.attachments || [],
        reactionsBreakdown: row.reactions_breakdown || {},
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Fetches a single post by ID, checking cohort authorization if cohort-scoped.
   */
  static async getPostById(postId: string, currentUserId: string, currentUserRole?: string) {
    const res = await pool.query(
      `SELECT p.*, u.name as author_name, u.image as author_image, u.role as author_role,
              ucp.headline as author_headline,
              (
                SELECT reaction_type FROM community_reactions cr
                WHERE cr.target_type = 'post' AND cr.target_id = p.id AND cr.user_id = $2
                LIMIT 1
              ) as user_reaction,
              (
                SELECT json_agg(
                  json_build_object(
                    'id', a.id,
                    'storagePath', a.storage_path,
                    'fileName', a.file_name,
                    'fileType', a.file_type,
                    'mimeType', a.mime_type,
                    'fileSizeBytes', a.file_size_bytes
                  )
                )
                FROM community_post_attachments a
                WHERE a.post_id = p.id
              ) as attachments
       FROM community_posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN user_community_profiles ucp ON ucp.user_id = p.author_id
       WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [postId, currentUserId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Community post not found");
    }

    const post = res.rows[0];

    // Cohort privacy check
    if (post.scope === "cohort") {
      await this.assertCohortAccess(currentUserId, post.cohort_id, currentUserRole);
    }

    return {
      ...post,
      attachments: post.attachments || [],
    };
  }

  /**
   * Creates a new community post.
   */
  static async createPost(params: {
    authorId: string;
    authorRole?: string;
    scope: "cohort" | "global";
    cohortId?: string | null;
    type?: string;
    title?: string | null;
    content: string;
    attachments?: PostAttachmentInput[];
  }) {
    const {
      authorId,
      authorRole,
      scope,
      cohortId,
      type = "DISCUSSION",
      title,
      content,
      attachments = [],
    } = params;

    // Strict scope check
    if (scope === "cohort") {
      if (!cohortId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "cohortId is required for cohort posts");
      }
      await this.assertCohortAccess(authorId, cohortId, authorRole);

      // Only staff/instructors can create ANNOUNCEMENT posts
      if (type === "ANNOUNCEMENT") {
        const isAdmin = authorRole === "SUPER_ADMIN" || authorRole === "ADMIN";
        const isTrainer = (
          await pool.query(
            `SELECT 1 FROM cohort_instructors WHERE cohort_id = $1 AND user_id = $2`,
            [cohortId, authorId]
          )
        ).rows.length > 0;

        if (!isAdmin && !isTrainer) {
          throw new AppError(
            403,
            ErrorCodes.FORBIDDEN,
            "Only instructors and administrators can publish cohort announcements."
          );
        }
      }
    } else {
      // Global scope: cohortId MUST be null
      if (cohortId) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Global posts cannot have a cohortId");
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertRes = await client.query(
        `INSERT INTO community_posts (
           author_id, scope, cohort_id, type, title, content, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
         RETURNING *`,
        [authorId, scope, cohortId || null, type, title || null, content]
      );

      const post = insertRes.rows[0];

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          await client.query(
            `INSERT INTO community_post_attachments (
               post_id, storage_path, file_name, file_type, mime_type, file_size_bytes
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [post.id, att.storagePath, att.fileName, att.fileType, att.mimeType, att.fileSizeBytes]
          );
        }
      }

      await client.query("COMMIT");

      // Notify cohort students if an announcement was made
      if (scope === "cohort" && type === "ANNOUNCEMENT" && cohortId) {
        void NotificationService.notifyCohortStudents(cohortId, {
          type: "COHORT_ANNOUNCEMENT",
          titleEn: `Cohort Announcement: ${title || "New update from instructor"}`,
          titleFr: `Annonce de cohorte : ${title || "Nouveau message de l'instructeur"}`,
          bodyEn: content.length > 150 ? content.slice(0, 150) + "…" : content,
          bodyFr: content.length > 150 ? content.slice(0, 150) + "…" : content,
        });
      }

      return await this.getPostById(post.id, authorId, authorRole);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Updates an existing community post. Only author or admin can update.
   */
  static async updatePost(
    postId: string,
    currentUserId: string,
    currentUserRole: string | undefined,
    updates: { title?: string | null; content?: string }
  ) {
    const postRes = await pool.query(
      `SELECT * FROM community_posts WHERE id = $1 AND deleted_at IS NULL`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Post not found");
    }

    const post = postRes.rows[0];
    const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";

    if (post.author_id !== currentUserId && !isAdmin) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "You are not authorized to edit this post.");
    }

    const newTitle = updates.title !== undefined ? updates.title : post.title;
    const newContent = updates.content !== undefined ? updates.content : post.content;

    const res = await pool.query(
      `UPDATE community_posts
       SET title = $1, content = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [newTitle, newContent, postId]
    );

    return await this.getPostById(res.rows[0].id, currentUserId, currentUserRole);
  }

  /**
   * Deletes a community post. Author can delete, or admin/trainer can moderate-delete.
   */
  static async deletePost(
    postId: string,
    currentUserId: string,
    currentUserRole: string | undefined,
    reason?: string
  ) {
    const postRes = await pool.query(
      `SELECT * FROM community_posts WHERE id = $1 AND deleted_at IS NULL`,
      [postId]
    );

    if (postRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Post not found");
    }

    const post = postRes.rows[0];
    const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";
    const isTrainer =
      post.scope === "cohort"
        ? (
            await pool.query(
              `SELECT 1 FROM cohort_instructors WHERE cohort_id = $1 AND user_id = $2`,
              [post.cohort_id, currentUserId]
            )
          ).rows.length > 0
        : false;

    if (post.author_id !== currentUserId && !isAdmin && !isTrainer) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "You are not authorized to delete this post.");
    }

    // Soft delete to preserve audit trail
    await pool.query(
      `UPDATE community_posts
       SET status = 'REMOVED', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [postId]
    );

    // Audit log if moderator removed someone else's post
    if (post.author_id !== currentUserId) {
      await pool.query(
        `INSERT INTO community_moderation_audit_logs (
           moderator_id, action, target_type, target_id, reason
         )
         VALUES ($1, 'REMOVE_POST', 'post', $2, $3)`,
        [currentUserId, postId, reason || "Deleted by moderator"]
      );
    }

    return { success: true, message: "Post deleted successfully" };
  }

  /**
   * Lists comments for a post.
   */
  static async listComments(postId: string, currentUserId: string, currentUserRole?: string) {
    // Fast post access verification
    const postRes = await pool.query(
      `SELECT scope, cohort_id FROM community_posts WHERE id = $1 AND deleted_at IS NULL`,
      [postId]
    );
    if (postRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Community post not found");
    }
    const post = postRes.rows[0];
    if (post.scope === "cohort") {
      await this.assertCohortAccess(currentUserId, post.cohort_id, currentUserRole);
    }

    const res = await pool.query(
      `SELECT c.id, c.post_id, c.author_id, c.parent_comment_id, c.content,
              c.status, c.like_count, c.created_at, c.updated_at,
              u.name as author_name, u.image as author_image, u.role as author_role,
              ucp.headline as author_headline,
              (
                SELECT reaction_type FROM community_reactions cr
                WHERE cr.target_type = 'comment' AND cr.target_id = c.id AND cr.user_id = $2
                LIMIT 1
              ) as user_reaction
       FROM community_comments c
       JOIN users u ON u.id = c.author_id
       LEFT JOIN user_community_profiles ucp ON ucp.user_id = c.author_id
       WHERE c.post_id = $1 AND c.status != 'REMOVED' AND c.deleted_at IS NULL
       ORDER BY c.created_at ASC`,
      [postId, currentUserId]
    );

    return res.rows;
  }

  /**
   * Adds a comment or threaded reply.
   */
  static async createComment(params: {
    postId: string;
    authorId: string;
    currentUserRole?: string;
    content: string;
    parentCommentId?: string | null;
  }) {
    const { postId, authorId, currentUserRole, content, parentCommentId } = params;

    const post = await this.getPostById(postId, authorId, currentUserRole);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertRes = await client.query(
        `INSERT INTO community_comments (
           post_id, author_id, parent_comment_id, content, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW())
         RETURNING *`,
        [postId, authorId, parentCommentId || null, content]
      );

      const comment = insertRes.rows[0];

      // Increment comment count
      await client.query(
        `UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1`,
        [postId]
      );

      await client.query("COMMIT");

      // Notify post author if not self
      if (post.author_id !== authorId) {
        void NotificationService.create({
          userId: post.author_id,
          type: "COMMUNITY_COMMENT",
          titleEn: "New comment on your post",
          titleFr: "Nouveau commentaire sur votre publication",
          bodyEn: content.length > 120 ? content.slice(0, 120) + "…" : content,
          bodyFr: content.length > 120 ? content.slice(0, 120) + "…" : content,
        });
      }

      return comment;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Deletes a comment.
   */
  static async deleteComment(commentId: string, currentUserId: string, currentUserRole?: string) {
    const commentRes = await pool.query(
      `SELECT * FROM community_comments WHERE id = $1 AND deleted_at IS NULL`,
      [commentId]
    );

    if (commentRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Comment not found");
    }

    const comment = commentRes.rows[0];
    const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";

    if (comment.author_id !== currentUserId && !isAdmin) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "You cannot delete this comment.");
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE community_comments SET status = 'REMOVED', deleted_at = NOW() WHERE id = $1`,
        [commentId]
      );

      await client.query(
        `UPDATE community_posts 
         SET comment_count = GREATEST(0, comment_count - 1) 
         WHERE id = $1`,
        [comment.post_id]
      );

      await client.query("COMMIT");

      return { success: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Toggles a reaction (like, heart, clap, celebrate, insightful, fire).
   */
  static async toggleReaction(params: {
    userId: string;
    targetType: "post" | "comment";
    targetId: string;
    reactionType: string;
    currentUserRole?: string;
  }) {
    const { userId, targetType, targetId, reactionType, currentUserRole } = params;

    // Fast-path: 1 single indexed query to verify target existence, authorization, author, and existing reaction
    let targetAuthorId: string | null = null;
    let existingReactionId: string | null = null;
    let existingReactionType: string | null = null;

    if (targetType === "post") {
      const accessRes = await pool.query(
        `SELECT p.id, p.author_id, p.scope, p.cohort_id,
                CASE 
                  WHEN p.scope = 'global' THEN true
                  WHEN $3 IN ('SUPER_ADMIN', 'ADMIN') THEN true
                  ELSE EXISTS(
                    SELECT 1 FROM cohort_instructors ci WHERE ci.cohort_id = p.cohort_id AND ci.user_id = $2
                    UNION ALL
                    SELECT 1 FROM enrollments e WHERE e.cohort_id = p.cohort_id AND e.user_id = $2 AND e.status IN ('ACTIVE', 'COMPLETED') AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
                  )
                END as has_access,
                cr.id as reaction_id,
                cr.reaction_type as existing_reaction
         FROM community_posts p
         LEFT JOIN community_reactions cr 
           ON cr.target_type = 'post' AND cr.target_id = p.id AND cr.user_id = $2
         WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [targetId, userId, currentUserRole || "PARTICIPANT"]
      );

      if (accessRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, "Community post not found");
      }

      if (!accessRes.rows[0].has_access) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, "You do not have access to this private cohort community space.");
      }

      targetAuthorId = accessRes.rows[0].author_id;
      existingReactionId = accessRes.rows[0].reaction_id;
      existingReactionType = accessRes.rows[0].existing_reaction;
    } else {
      const accessRes = await pool.query(
        `SELECT c.id, c.author_id, c.post_id, p.scope, p.cohort_id,
                CASE 
                  WHEN p.scope = 'global' THEN true
                  WHEN $3 IN ('SUPER_ADMIN', 'ADMIN') THEN true
                  ELSE EXISTS(
                    SELECT 1 FROM cohort_instructors ci WHERE ci.cohort_id = p.cohort_id AND ci.user_id = $2
                    UNION ALL
                    SELECT 1 FROM enrollments e WHERE e.cohort_id = p.cohort_id AND e.user_id = $2 AND e.status IN ('ACTIVE', 'COMPLETED') AND e.payment_status IN ('PAID', 'NOT_REQUIRED')
                  )
                END as has_access,
                cr.id as reaction_id,
                cr.reaction_type as existing_reaction
         FROM community_comments c
         JOIN community_posts p ON p.id = c.post_id
         LEFT JOIN community_reactions cr 
           ON cr.target_type = 'comment' AND cr.target_id = c.id AND cr.user_id = $2
         WHERE c.id = $1 AND c.deleted_at IS NULL`,
        [targetId, userId, currentUserRole || "PARTICIPANT"]
      );

      if (accessRes.rows.length === 0) {
        throw new AppError(404, ErrorCodes.NOT_FOUND, "Comment not found");
      }

      if (!accessRes.rows[0].has_access) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, "You do not have access to this private cohort community space.");
      }

      targetAuthorId = accessRes.rows[0].author_id;
      existingReactionId = accessRes.rows[0].reaction_id;
      existingReactionType = accessRes.rows[0].existing_reaction;
    }

    let action: "ADDED" | "REMOVED" | "CHANGED" = "ADDED";
    const targetTable = targetType === "post" ? "community_posts" : "community_comments";

    // 2. Perform atomic toggle & update like_count in a fast atomic query
    if (existingReactionId) {
      if (existingReactionType === reactionType) {
        // Remove reaction
        action = "REMOVED";
        await pool.query(
          `WITH del AS (
             DELETE FROM community_reactions WHERE id = $1
           )
           UPDATE ${targetTable} 
           SET like_count = GREATEST(0, like_count - 1) 
           WHERE id = $2`,
          [existingReactionId, targetId]
        );
      } else {
        // Change reaction type
        action = "CHANGED";
        await pool.query(
          `UPDATE community_reactions SET reaction_type = $1 WHERE id = $2`,
          [reactionType, existingReactionId]
        );
      }
    } else {
      // Add new reaction
      action = "ADDED";
      await pool.query(
        `WITH ins AS (
           INSERT INTO community_reactions (user_id, target_type, target_id, reaction_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, target_type, target_id, reaction_type) DO NOTHING
         )
         UPDATE ${targetTable} 
         SET like_count = like_count + 1 
         WHERE id = $3`,
        [userId, targetType, targetId, reactionType]
      );

      // Asynchronous notification (fire-and-forget, zero blocking)
      if (targetAuthorId && targetAuthorId !== userId) {
        setImmediate(() => {
          NotificationService.create({
            userId: targetAuthorId!,
            type: "COMMUNITY_REACTION",
            titleEn: "New reaction on your content",
            titleFr: "Nouvelle réaction sur votre contenu",
            bodyEn: `A community member reacted with ${reactionType} to your ${targetType}.`,
            bodyFr: `Un membre de la communauté a réagi avec ${reactionType} à votre ${targetType}.`,
          }).catch((err) => console.warn("[Notification] Could not send reaction notification:", err?.message));
        });
      }
    }

    // 3. Fast aggregated breakdown via indexed grouping
    const breakdownRes = await pool.query(
      `SELECT reaction_type, count(*)::int as count 
       FROM community_reactions 
       WHERE target_type = $1 AND target_id = $2 
       GROUP BY reaction_type`,
      [targetType, targetId]
    );

    const reactionsBreakdown: Record<string, number> = {};
    for (const row of breakdownRes.rows) {
      reactionsBreakdown[row.reaction_type] = row.count;
    }

    return {
      action,
      userReaction: action === "REMOVED" ? null : reactionType,
      reactionsBreakdown,
    };
  }

  /**
   * Generates a short-lived signed access URL for an attachment, strictly re-verifying cohort access.
   */
  static async getAttachmentSignedUrl(attachmentId: string, currentUserId: string, currentUserRole?: string) {
    const res = await pool.query(
      `SELECT a.storage_path, a.file_name, a.mime_type, p.scope, p.cohort_id
       FROM community_post_attachments a
       JOIN community_posts p ON p.id = a.post_id
       WHERE a.id = $1`,
      [attachmentId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Attachment not found");
    }

    const { storage_path, scope, cohort_id, file_name, mime_type } = res.rows[0];

    // Cohort privacy check
    if (scope === "cohort") {
      await this.assertCohortAccess(currentUserId, cohort_id, currentUserRole);
    }

    // Direct URL or local disk fallback
    if (storage_path.startsWith("http://") || storage_path.startsWith("https://") || storage_path.startsWith("/uploads/")) {
      return {
        url: storage_path,
        fileName: file_name,
        mimeType: mime_type,
      };
    }

    try {
      const { data, error } = await supabaseAdmin.storage
        .from(this.STORAGE_BUCKET)
        .createSignedUrl(storage_path, 3600); // 1 hour

      if (!error && data?.signedUrl) {
        return {
          url: data.signedUrl,
          fileName: file_name,
          mimeType: mime_type,
        };
      }
    } catch {
      // Continue to next bucket attempt
    }

    try {
      const { data: resData, error: resErr } = await supabaseAdmin.storage
        .from("course-resources")
        .createSignedUrl(storage_path, 3600);

      if (!resErr && resData?.signedUrl) {
        return {
          url: resData.signedUrl,
          fileName: file_name,
          mimeType: mime_type,
        };
      }
    } catch {
      // Fallback
    }

    // Fallback: public url or local disk
    const pubUrl = supabaseAdmin.storage.from(this.STORAGE_BUCKET).getPublicUrl(storage_path).data.publicUrl;
    return {
      url: pubUrl || `/uploads/community/${storage_path.replace(/^posts\//, "")}`,
      fileName: file_name,
      mimeType: mime_type,
    };
  }

  /**
   * Community Profile: Retrieves public profile and projects.
   * NEVER exposes email, phone, or internal account secrets.
   */
  static async getCommunityProfile(targetUserId: string, _currentUserId: string) {
    const userRes = await pool.query(
      `SELECT u.id, u.name, u.image, u.role, u.created_at,
              ucp.headline, ucp.bio, ucp.skills, ucp.interests,
              ucp.portfolio_url, ucp.linkedin_url, ucp.github_url, ucp.website_url,
              ucp.is_profile_public, ucp.show_enrolled_programs
       FROM users u
       LEFT JOIN user_community_profiles ucp ON ucp.user_id = u.id
       WHERE u.id = $1`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Member not found");
    }

    const profile = userRes.rows[0];

    // Programs attended (only if user hasn't hidden them)
    let programs: any[] = [];
    if (profile.show_enrolled_programs !== false) {
      const progRes = await pool.query(
        `SELECT DISTINCT p.id, p.slug, p.title_en, p.title_fr, c.name_en as cohort_name_en, c.name_fr as cohort_name_fr
         FROM enrollments e
         JOIN cohorts c ON c.id = e.cohort_id
         JOIN programs p ON p.id = c.program_id
         WHERE e.user_id = $1 AND e.status IN ('ACTIVE', 'COMPLETED')`,
        [targetUserId]
      );
      programs = progRes.rows;
    }

    // Projects
    const projectsRes = await pool.query(
      `SELECT id, title, description, project_url, image_url, skills_used, created_at
       FROM user_projects
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [targetUserId]
    );

    return {
      id: profile.id,
      name: profile.name,
      image: profile.image,
      role: profile.role,
      joinedAt: profile.created_at,
      headline: profile.headline || "",
      bio: profile.bio || "",
      skills: profile.skills || [],
      interests: profile.interests || [],
      portfolioUrl: profile.portfolio_url || null,
      linkedinUrl: profile.linkedin_url || null,
      githubUrl: profile.github_url || null,
      websiteUrl: profile.website_url || null,
      isProfilePublic: profile.is_profile_public ?? true,
      programs,
      projects: projectsRes.rows,
    };
  }

  /**
   * Updates community profile.
   */
  static async updateCommunityProfile(userId: string, data: any) {
    const res = await pool.query(
      `INSERT INTO user_community_profiles (
         user_id, headline, bio, skills, interests, portfolio_url, linkedin_url,
         github_url, website_url, is_profile_public, show_enrolled_programs, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         headline = COALESCE(EXCLUDED.headline, user_community_profiles.headline),
         bio = COALESCE(EXCLUDED.bio, user_community_profiles.bio),
         skills = COALESCE(EXCLUDED.skills, user_community_profiles.skills),
         interests = COALESCE(EXCLUDED.interests, user_community_profiles.interests),
         portfolio_url = EXCLUDED.portfolio_url,
         linkedin_url = EXCLUDED.linkedin_url,
         github_url = EXCLUDED.github_url,
         website_url = EXCLUDED.website_url,
         is_profile_public = COALESCE(EXCLUDED.is_profile_public, user_community_profiles.is_profile_public),
         show_enrolled_programs = COALESCE(EXCLUDED.show_enrolled_programs, user_community_profiles.show_enrolled_programs),
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        data.headline ?? null,
        data.bio ?? null,
        data.skills || [],
        data.interests || [],
        data.portfolioUrl ?? null,
        data.linkedinUrl ?? null,
        data.githubUrl ?? null,
        data.websiteUrl ?? null,
        data.isProfilePublic ?? true,
        data.showEnrolledPrograms ?? true,
      ]
    );

    return res.rows[0];
  }

  /**
   * Search eligible global community members.
   */
  static async searchMembers(params: {
    query?: string;
    skill?: string;
    interest?: string;
    programId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { query, skill, interest, programId, limit = 20, offset = 0 } = params;
    const values: any[] = [];
    let sql = `
      SELECT u.id, u.name, u.image, u.role,
             ucp.headline, ucp.bio, ucp.skills, ucp.interests,
             ucp.linkedin_url, ucp.github_url, ucp.portfolio_url
      FROM users u
      LEFT JOIN user_community_profiles ucp ON ucp.user_id = u.id
      WHERE u.status = 'ACTIVE' 
        AND COALESCE(ucp.is_profile_public, true) = true
    `;

    if (query && query.trim()) {
      values.push(`%${query.trim()}%`);
      sql += ` AND (u.name ILIKE $${values.length} OR ucp.headline ILIKE $${values.length} OR ucp.bio ILIKE $${values.length})`;
    }

    if (skill && skill.trim()) {
      values.push(skill.trim());
      sql += ` AND $${values.length} = ANY(ucp.skills)`;
    }

    if (interest && interest.trim()) {
      values.push(interest.trim());
      sql += ` AND $${values.length} = ANY(ucp.interests)`;
    }

    if (programId) {
      values.push(programId);
      sql += ` AND EXISTS (
        SELECT 1 FROM enrollments e 
        JOIN cohorts c ON c.id = e.cohort_id 
        WHERE e.user_id = u.id AND c.program_id = $${values.length}
      )`;
    }

    sql += ` ORDER BY u.name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const res = await pool.query(sql, values);
    return res.rows;
  }

  /**
   * Projects management.
   */
  static async createProject(userId: string, data: any) {
    const res = await pool.query(
      `INSERT INTO user_projects (
         user_id, title, description, project_url, image_url, skills_used, cohort_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        userId,
        data.title,
        data.description,
        data.projectUrl || null,
        data.imageUrl || null,
        data.skillsUsed || [],
        data.cohortId || null,
      ]
    );
    return res.rows[0];
  }

  static async deleteProject(projectId: string, userId: string) {
    const res = await pool.query(
      `DELETE FROM user_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
      [projectId, userId]
    );
    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Project not found or unauthorized");
    }
    return { success: true };
  }

  /**
   * Reports inappropriate content.
   */
  static async createReport(reporterId: string, data: {
    targetType: "post" | "comment" | "user";
    targetId: string;
    reason: string;
    details?: string | null;
  }) {
    const res = await pool.query(
      `INSERT INTO community_reports (
         reporter_id, target_type, target_id, reason, details, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
       RETURNING *`,
      [reporterId, data.targetType, data.targetId, data.reason, data.details || null]
    );

    // Flag the post if reported multiple times
    if (data.targetType === "post") {
      await pool.query(
        `UPDATE community_posts SET status = 'FLAGGED' 
         WHERE id = $1 AND status = 'ACTIVE'`,
        [data.targetId]
      );
    }

    return res.rows[0];
  }

  /**
   * Moderation: Lists content reports for admins and trainers.
   */
  static async listReports(params: { status?: string; limit?: number; offset?: number }) {
    const { status, limit = 50, offset = 0 } = params;
    const values: any[] = [];
    let sql = `
      SELECT r.*, u.name as reporter_name, u.email as reporter_email
      FROM community_reports r
      JOIN users u ON u.id = r.reporter_id
    `;

    if (status) {
      values.push(status);
      sql += ` WHERE r.status = $1`;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const res = await pool.query(sql, values);
    return res.rows;
  }

  /**
   * Moderation action on a post (Hide, Unhide, Remove, Pin, Unpin, Feature).
   */
  static async moderatePost(
    moderatorId: string,
    moderatorRole: string | undefined,
    postId: string,
    action: string,
    reason?: string
  ) {
    const isAdmin = moderatorRole === "SUPER_ADMIN" || moderatorRole === "ADMIN";

    const postRes = await pool.query(`SELECT * FROM community_posts WHERE id = $1`, [postId]);
    if (postRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Post not found");
    }
    const post = postRes.rows[0];

    const isTrainer =
      post.scope === "cohort"
        ? (
            await pool.query(
              `SELECT 1 FROM cohort_instructors WHERE cohort_id = $1 AND user_id = $2`,
              [post.cohort_id, moderatorId]
            )
          ).rows.length > 0
        : false;

    if (!isAdmin && !isTrainer) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "You are not authorized to moderate this content.");
    }

    let updateSql = "";
    switch (action) {
      case "HIDE_POST":
        updateSql = `UPDATE community_posts SET status = 'HIDDEN', updated_at = NOW() WHERE id = $1`;
        break;
      case "UNHIDE_POST":
        updateSql = `UPDATE community_posts SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`;
        break;
      case "REMOVE_POST":
        updateSql = `UPDATE community_posts SET status = 'REMOVED', deleted_at = NOW(), updated_at = NOW() WHERE id = $1`;
        break;
      case "PIN_POST":
        updateSql = `UPDATE community_posts SET pinned = TRUE, pinned_at = NOW(), pinned_by = '${moderatorId}', updated_at = NOW() WHERE id = $1`;
        break;
      case "UNPIN_POST":
        updateSql = `UPDATE community_posts SET pinned = FALSE, pinned_at = NULL, pinned_by = NULL, updated_at = NOW() WHERE id = $1`;
        break;
      case "FEATURE_POST":
        if (!isAdmin) throw new AppError(403, ErrorCodes.FORBIDDEN, "Only admins can feature global posts.");
        updateSql = `UPDATE community_posts SET featured = TRUE, featured_at = NOW(), updated_at = NOW() WHERE id = $1`;
        break;
      case "UNFEATURE_POST":
        if (!isAdmin) throw new AppError(403, ErrorCodes.FORBIDDEN, "Only admins can unfeature global posts.");
        updateSql = `UPDATE community_posts SET featured = FALSE, featured_at = NULL, updated_at = NOW() WHERE id = $1`;
        break;
      default:
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `Unsupported moderation action: ${action}`);
    }

    await pool.query(updateSql, [postId]);

    // Record in audit log
    await pool.query(
      `INSERT INTO community_moderation_audit_logs (
         moderator_id, action, target_type, target_id, reason
       )
       VALUES ($1, $2, 'post', $3, $4)`,
      [moderatorId, action, postId, reason || null]
    );

    return { success: true, action };
  }

  /**
   * Resolves a moderation report.
   */
  static async resolveReport(
    moderatorId: string,
    reportId: string,
    resolution: { status: "ACTION_TAKEN" | "DISMISSED"; notes?: string }
  ) {
    const res = await pool.query(
      `UPDATE community_reports
       SET status = $1, resolved_by = $2, resolved_at = NOW(), resolution_notes = $3
       WHERE id = $4
       RETURNING *`,
      [resolution.status, moderatorId, resolution.notes || null, reportId]
    );

    if (res.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "Report not found");
    }

    // Record moderation audit log
    await pool.query(
      `INSERT INTO community_moderation_audit_logs (
         moderator_id, action, target_type, target_id, reason
       )
       VALUES ($1, $2, 'report', $3, $4)`,
      [
        moderatorId,
        resolution.status === "ACTION_TAKEN" ? "RESOLVE_REPORT" : "DISMISS_REPORT",
        reportId,
        resolution.notes || null,
      ]
    );

    return res.rows[0];
  }

  /**
   * Moderation Audit Logs listing for Admin.
   */
  static async listAuditLogs(limit = 50, offset = 0) {
    const res = await pool.query(
      `SELECT a.*, u.name as moderator_name, u.email as moderator_email
       FROM community_moderation_audit_logs a
       JOIN users u ON u.id = a.moderator_id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  /**
   * Community Overview KPI statistics for admin dashboard.
   */
  static async getCommunityStats() {
    const res = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM community_posts WHERE deleted_at IS NULL AND status != 'REMOVED')::int as total_posts,
         (SELECT COUNT(*) FROM community_comments WHERE deleted_at IS NULL AND status != 'REMOVED')::int as total_comments,
         (SELECT COUNT(*) FROM community_reports WHERE status = 'PENDING')::int as pending_reports,
         (SELECT COUNT(DISTINCT author_id) FROM community_posts WHERE created_at > NOW() - INTERVAL '30 days')::int as active_contributors,
         (SELECT COUNT(*) FROM cohorts WHERE status IN ('ACTIVE', 'UPCOMING'))::int as active_cohort_spaces`
    );

    const row = res.rows[0] || {};
    return {
      totalPosts: row.total_posts ?? 0,
      totalComments: row.total_comments ?? 0,
      pendingReports: row.pending_reports ?? 0,
      activeContributors: row.active_contributors ?? 0,
      activeCohortSpaces: row.active_cohort_spaces ?? 0,
    };
  }
}
