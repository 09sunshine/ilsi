-- 006_cohort_thumbnail.sql
-- Add thumbnail_url to cohorts and programs for course card & curriculum displays

ALTER TABLE cohorts
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

CREATE INDEX IF NOT EXISTS idx_cohorts_thumbnail ON cohorts(thumbnail_url) WHERE thumbnail_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_programs_thumbnail ON programs(thumbnail_url) WHERE thumbnail_url IS NOT NULL;
