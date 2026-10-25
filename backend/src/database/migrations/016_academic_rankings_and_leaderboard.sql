-- ============================================================================
-- Migration: 016_academic_rankings_and_leaderboard.sql
-- Description: Academic Ranking, Leaderboard Snapshots, and Movement History
-- ============================================================================

-- 1. Create cohort_ranking_snapshots table
CREATE TABLE IF NOT EXISTS cohort_ranking_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    academic_rule_version VARCHAR(50) NOT NULL DEFAULT 'v1.0-standard-competition',
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED', -- 'CALCULATING', 'PUBLISHED', 'FAILED'
    total_students INT NOT NULL DEFAULT 0,
    eligible_students INT NOT NULL DEFAULT 0,
    cohort_average NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculated_by TEXT DEFAULT 'SYSTEM',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create cohort_ranking_entries table
CREATE TABLE IF NOT EXISTS cohort_ranking_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES cohort_ranking_snapshots(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INT, -- NULL if not eligible
    average NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    completed_modules INT NOT NULL DEFAULT 0,
    total_required_modules INT NOT NULL DEFAULT 0,
    is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    ineligibility_reason VARCHAR(100), -- 'NO_COMPLETED_MODULES', 'DISQUALIFIED', 'DROPPED', 'UNPAID', etc.
    rank_change INT, -- NULL if new to ranking, > 0 if gained places, < 0 if lost places, 0 if unchanged
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ranking_snapshot_user UNIQUE (snapshot_id, user_id)
);

-- 3. High-performance indexes
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_cohort_status 
    ON cohort_ranking_snapshots (cohort_id, status, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_entries_snapshot_rank 
    ON cohort_ranking_entries (snapshot_id, is_eligible, rank ASC);

CREATE INDEX IF NOT EXISTS idx_ranking_entries_user_cohort 
    ON cohort_ranking_entries (user_id, cohort_id);

CREATE INDEX IF NOT EXISTS idx_ranking_entries_snapshot_user 
    ON cohort_ranking_entries (snapshot_id, user_id);
