-- 004_lesson_quiz_and_live.sql: Allow quizzes and live sessions per lesson
ALTER TABLE quizzes ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE;
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_module_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_module_unique ON quizzes(module_id) WHERE module_id IS NOT NULL AND lesson_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_lesson_unique ON quizzes(lesson_id) WHERE lesson_id IS NOT NULL;

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_lesson_id ON live_sessions(lesson_id);
