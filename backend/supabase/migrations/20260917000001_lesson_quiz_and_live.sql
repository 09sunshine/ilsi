-- ============================================================================
-- Migration: 20260917000001_lesson_quiz_and_live.sql
-- Description: Allow quizzes and live sessions to be associated directly per lesson
-- ============================================================================

-- 1. Quizzes: Allow lesson-level quizzes in addition to module-level quizzes
ALTER TABLE quizzes ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_module_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_module_unique ON quizzes(module_id) WHERE module_id IS NOT NULL AND lesson_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_lesson_unique ON quizzes(lesson_id) WHERE lesson_id IS NOT NULL;

-- 2. Live Sessions: Allow lesson-level live debrief sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_lesson_id ON live_sessions(lesson_id);
