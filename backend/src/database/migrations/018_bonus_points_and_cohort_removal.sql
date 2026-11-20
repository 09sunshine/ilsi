-- Migration 018: Manual bonus points and cohort disqualification/removal
-- Enables:
-- 1. Removing/disqualifying a user from a cohort without deleting their global account
-- 2. Hiding disqualified/removed users from active participant list, leaderboards, and cohort community
-- 3. Manually awarding points (bonus/extra credit) added to quiz points with full audit logging

-- 1. Extend enrollments table
ALTER TABLE enrollments 
  ADD COLUMN IF NOT EXISTS bonus_points NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_enrollments_cohort_status_hidden 
  ON enrollments(cohort_id, status, is_hidden);

-- 2. Create cohort point adjustments audit log table
CREATE TABLE IF NOT EXISTS cohort_point_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points_added NUMERIC(10, 2) NOT NULL,
  reason TEXT,
  adjusted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohort_point_adjustments_cohort_user 
  ON cohort_point_adjustments(cohort_id, user_id, created_at DESC);
