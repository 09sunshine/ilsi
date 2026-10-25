-- ============================================================================
-- Migration: 013_community_platform.sql
-- Description: Private Cohort Communities & Global ILSI Social Network
-- ============================================================================

-- 1. Cohort Instructors / Trainers Mapping
CREATE TABLE IF NOT EXISTS cohort_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'INSTRUCTOR', -- INSTRUCTOR, LEAD_TRAINER, MENTOR
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_instructors_cohort ON cohort_instructors(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_instructors_user ON cohort_instructors(user_id);

-- 2. Extended Community Profile (Skills, Interests, Bio, Social Links, Privacy Settings)
CREATE TABLE IF NOT EXISTS user_community_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline VARCHAR(255),
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    portfolio_url TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    website_url TEXT,
    is_profile_public BOOLEAN NOT NULL DEFAULT TRUE,
    show_enrolled_programs BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_community_profiles_public ON user_community_profiles(is_profile_public);

-- 3. User Projects & Achievements (Showcased on Member Profile)
CREATE TABLE IF NOT EXISTS user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    project_url TEXT,
    image_url TEXT,
    skills_used TEXT[] DEFAULT '{}',
    cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_projects_user ON user_projects(user_id, created_at DESC);

-- 4. Community Posts (Unified model supporting Cohort and Global scopes)
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('cohort', 'global')),
    cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'DISCUSSION', -- 'DISCUSSION', 'ANNOUNCEMENT', 'QUESTION', 'ACHIEVEMENT', 'PROJECT'
    title VARCHAR(300),
    content TEXT NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at TIMESTAMPTZ,
    pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    featured_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'HIDDEN', 'REMOVED', 'FLAGGED'
    like_count INT NOT NULL DEFAULT 0,
    comment_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    -- Constraint: cohort posts require cohort_id; global posts cannot have cohort_id
    CONSTRAINT chk_post_cohort_scope CHECK (
        (scope = 'cohort' AND cohort_id IS NOT NULL) OR
        (scope = 'global' AND cohort_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_community_posts_cohort ON community_posts(scope, cohort_id, pinned DESC, created_at DESC)
    WHERE status != 'REMOVED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_global ON community_posts(scope, pinned DESC, created_at DESC)
    WHERE scope = 'global' AND status != 'REMOVED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_status ON community_posts(status);

-- 5. Community Post Attachments
CREATE TABLE IF NOT EXISTS community_post_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'IMAGE', 'DOCUMENT', 'PDF'
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post ON community_post_attachments(post_id);

-- 6. Community Comments & Threaded Replies
CREATE TABLE IF NOT EXISTS community_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'HIDDEN', 'REMOVED'
    like_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at ASC)
    WHERE status != 'REMOVED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_comments_parent ON community_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_author ON community_comments(author_id);

-- 7. Community Reactions (Emojis: like, heart, clap, celebrate, insightful, fire)
CREATE TABLE IF NOT EXISTS community_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like', -- 'like', 'heart', 'clap', 'celebrate', 'insightful', 'fire'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, target_type, target_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user ON community_reactions(user_id);

-- 8. Content Reports (Moderation)
CREATE TABLE IF NOT EXISTS community_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
    target_id TEXT NOT NULL,
    reason VARCHAR(100) NOT NULL, -- 'SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'MISINFORMATION', 'OTHER'
    details TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'
    resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_reports_target ON community_reports(target_type, target_id);

-- 9. Moderation Audit Logs
CREATE TABLE IF NOT EXISTS community_moderation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL, -- 'HIDE_POST', 'REMOVE_POST', 'UNHIDE_POST', 'PIN_POST', 'UNPIN_POST', 'DISMISS_REPORT', 'RESOLVE_REPORT', 'DELETE_COMMENT'
    target_type VARCHAR(50) NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_audit_moderator ON community_moderation_audit_logs(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_audit_action ON community_moderation_audit_logs(action, created_at DESC);
