-- ============================================================================
-- Migration: 014_community_performance_indexes.sql
-- Description: High-performance covering indexes for sub-100-300ms community response times
-- ============================================================================

-- 1. Accelerate student enrollment verification for cohort community checks
CREATE INDEX IF NOT EXISTS idx_enrollments_cohort_user_access
    ON enrollments(cohort_id, user_id, status, payment_status);

-- 2. Accelerate instructor assignment lookups
CREATE INDEX IF NOT EXISTS idx_cohort_instructors_access
    ON cohort_instructors(cohort_id, user_id);

-- 3. High performance feed ordering index for cohort posts
CREATE INDEX IF NOT EXISTS idx_community_posts_cohort_feed_perf
    ON community_posts(cohort_id, pinned DESC, created_at DESC)
    WHERE scope = 'cohort' AND deleted_at IS NULL;

-- 4. High performance feed ordering index for global posts
CREATE INDEX IF NOT EXISTS idx_community_posts_global_feed_perf
    ON community_posts(pinned DESC, created_at DESC)
    WHERE scope = 'global' AND deleted_at IS NULL;

-- 5. Accelerate user reaction checks on posts and comments
CREATE INDEX IF NOT EXISTS idx_community_reactions_seek
    ON community_reactions(target_type, target_id, user_id);

-- 6. Accelerate reaction breakdown aggregations
CREATE INDEX IF NOT EXISTS idx_community_reactions_agg
    ON community_reactions(target_type, target_id, reaction_type);

-- 7. Accelerate post attachments retrieval
CREATE INDEX IF NOT EXISTS idx_post_attachments_lookup
    ON community_post_attachments(post_id, created_at ASC);

-- 8. Accelerate threaded comments lookup
CREATE INDEX IF NOT EXISTS idx_community_comments_fetch_perf
    ON community_comments(post_id, parent_comment_id, created_at ASC)
    WHERE deleted_at IS NULL;

-- 9. Accelerate user community profile searches by public status
CREATE INDEX IF NOT EXISTS idx_user_community_profiles_search
    ON user_community_profiles(user_id)
    WHERE is_profile_public = TRUE;
