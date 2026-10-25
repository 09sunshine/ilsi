-- ============================================================================
-- Migration: 20261026010000_module_and_lesson_based_academic_ranking.sql
-- Description: Lesson-weighted scoring, denominator over all curriculum lessons,
--              and per-module ranking entries with live completion tracking.
-- ============================================================================

-- 1. Extend cohort_ranking_entries with lesson progress & denominator metrics
ALTER TABLE IF EXISTS cohort_ranking_entries
    ADD COLUMN IF NOT EXISTS completed_lessons INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_lessons INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_possible_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00;

-- 2. Create cohort_module_ranking_entries for per-module rankings
CREATE TABLE IF NOT EXISTS cohort_module_ranking_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES cohort_ranking_snapshots(id) ON DELETE CASCADE,
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INT,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    completed_lessons INT NOT NULL DEFAULT 0,
    total_lessons INT NOT NULL DEFAULT 0,
    max_possible_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    ineligibility_reason VARCHAR(100),
    rank_change INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_module_ranking_snapshot_module_user UNIQUE (snapshot_id, module_id, user_id)
);

-- 3. High-performance indexes for per-module leaderboard queries
CREATE INDEX IF NOT EXISTS idx_module_ranking_snapshot_module_rank
    ON cohort_module_ranking_entries (snapshot_id, module_id, is_eligible, rank ASC);

CREATE INDEX IF NOT EXISTS idx_module_ranking_user_module
    ON cohort_module_ranking_entries (user_id, module_id);

CREATE INDEX IF NOT EXISTS idx_module_ranking_cohort_module
    ON cohort_module_ranking_entries (cohort_id, module_id);
