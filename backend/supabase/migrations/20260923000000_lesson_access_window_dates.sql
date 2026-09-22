-- ============================================================================
-- Migration: 20260923000000_lesson_access_window_dates.sql
-- Description: Extend lessons with access window start/end dates and ensure cohort_lessons scheduling
-- ============================================================================

-- 1. Extend lessons table with start_date and end_date
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- 2. Backfill lessons.start_date and end_date from modules / cohorts where null
UPDATE lessons l
SET 
  start_date = COALESCE(l.start_date, m.start_date, c.start_date::TIMESTAMPTZ, NOW()),
  end_date = COALESCE(l.end_date, m.end_date, c.end_date::TIMESTAMPTZ, NOW() + INTERVAL '30 days')
FROM modules m
LEFT JOIN cohorts c ON c.id = m.cohort_id
WHERE l.module_id = m.id AND (l.start_date IS NULL OR l.end_date IS NULL);

-- 3. Ensure cohort_lessons indexes exist for performant date-range checks
CREATE INDEX IF NOT EXISTS idx_cohort_lessons_cohort_dates 
  ON cohort_lessons(cohort_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_lessons_dates
  ON lessons(id, start_date, end_date);
