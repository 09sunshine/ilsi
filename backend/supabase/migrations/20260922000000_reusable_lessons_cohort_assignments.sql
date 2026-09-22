-- ============================================================================
-- Supabase Migration: 20260922000000_reusable_lessons_cohort_assignments.sql
-- Description: Refactor LMS content architecture into Reusable Lessons & Cohort-Lesson Assignments
-- ============================================================================

-- 1. Extend programs table with status
ALTER TABLE programs 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';

-- 2. Extend modules table with program_id and status, make cohort_id / dates optional for reusable modules
ALTER TABLE modules 
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE modules ALTER COLUMN cohort_id DROP NOT NULL;
ALTER TABLE modules ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE modules ALTER COLUMN end_date DROP NOT NULL;

-- Backfill module.program_id from cohort where missing
UPDATE modules m
SET program_id = c.program_id
FROM cohorts c
WHERE m.cohort_id = c.id AND m.program_id IS NULL;

-- 3. Extend lessons table with status
ALTER TABLE lessons 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';

-- 4. Create chapters table for modular lesson content
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 1,
    title_en VARCHAR(255) NOT NULL,
    title_fr VARCHAR(255) NOT NULL,
    description_en TEXT,
    description_fr TEXT,
    body_en TEXT,
    body_fr TEXT,
    duration_minutes INT NOT NULL DEFAULT 5,
    video_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapters_lesson_order ON chapters(lesson_id, order_index);

-- 5. Create cohort_lessons table (the core scheduling relationship)
CREATE TABLE IF NOT EXISTS cohort_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 1,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 15,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    passing_score INT NOT NULL DEFAULT 70,
    prerequisite_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    prerequisite_assignment_id UUID REFERENCES cohort_lessons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cohort_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_lessons_cohort_order ON cohort_lessons(cohort_id, order_index);
CREATE INDEX IF NOT EXISTS idx_cohort_lessons_dates ON cohort_lessons(cohort_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_cohort_lessons_lesson_id ON cohort_lessons(lesson_id);

-- 6. Backfill existing cohort-lesson relationships into cohort_lessons
INSERT INTO cohort_lessons (
    cohort_id,
    lesson_id,
    order_index,
    start_at,
    end_at,
    duration_minutes,
    is_required,
    is_published,
    status,
    passing_score
)
SELECT 
    m.cohort_id,
    l.id AS lesson_id,
    l.order_index,
    COALESCE(m.start_date, c.start_date::TIMESTAMPTZ, NOW()) AS start_at,
    COALESCE(m.end_date, c.end_date::TIMESTAMPTZ, NOW() + INTERVAL '30 days') AS end_at,
    COALESCE(l.duration_minutes, 15),
    COALESCE(l.mandatory, TRUE),
    TRUE,
    'PUBLISHED',
    COALESCE(m.passing_score, c.passing_score, 70)
FROM lessons l
JOIN modules m ON m.id = l.module_id
JOIN cohorts c ON c.id = m.cohort_id
WHERE m.cohort_id IS NOT NULL
ON CONFLICT (cohort_id, lesson_id) DO NOTHING;

-- 7. Extend lesson_progress to be cohort-aware
ALTER TABLE lesson_progress 
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cohort_lesson_id UUID REFERENCES cohort_lessons(id) ON DELETE SET NULL;

-- Backfill cohort_id into existing lesson_progress
UPDATE lesson_progress lp
SET cohort_id = m.cohort_id,
    cohort_lesson_id = cl.id
FROM lessons l
JOIN modules m ON m.id = l.module_id
LEFT JOIN cohort_lessons cl ON cl.cohort_id = m.cohort_id AND cl.lesson_id = l.id
WHERE lp.lesson_id = l.id AND lp.cohort_id IS NULL AND m.cohort_id IS NOT NULL;

ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_user_id_lesson_id_key;
DROP INDEX IF EXISTS idx_lesson_progress_user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_progress_user_cohort_lesson 
  ON lesson_progress(user_id, cohort_id, lesson_id) 
  WHERE cohort_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson_fallback
  ON lesson_progress(user_id, lesson_id)
  WHERE cohort_id IS NULL;

-- 8. Extend quiz_attempts to be cohort-aware
ALTER TABLE quiz_attempts 
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;

ALTER TABLE quiz_attempts ALTER COLUMN module_id DROP NOT NULL;

-- Backfill quiz_attempts with cohort_id and lesson_id
UPDATE quiz_attempts qa
SET cohort_id = m.cohort_id,
    lesson_id = q.lesson_id
FROM quizzes q
LEFT JOIN modules m ON m.id = q.module_id
WHERE qa.quiz_id = q.id AND qa.cohort_id IS NULL AND m.cohort_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_cohort_user ON quiz_attempts(cohort_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson_user ON quiz_attempts(lesson_id, user_id);

-- 9. Extend quizzes & resources with status
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;
