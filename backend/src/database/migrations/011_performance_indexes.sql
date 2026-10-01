-- 011_performance_indexes.sql
-- High performance covering indexes for frequent queries (Lessons, Resources, Progress, Quizzes)

-- 1. Accelerate resource lookups for lessons and modules
CREATE INDEX IF NOT EXISTS idx_resources_lesson_id ON resources(lesson_id);
CREATE INDEX IF NOT EXISTS idx_resources_module_id ON resources(module_id);

-- 2. Accelerate cohort-lesson assignment lookups during access checks
CREATE INDEX IF NOT EXISTS idx_cohort_lessons_cohort_lesson ON cohort_lessons(cohort_id, lesson_id);

-- 3. Accelerate student lesson progress retrieval (composite seek)
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_cohort_lesson ON lesson_progress(user_id, cohort_id, lesson_id);

-- 4. Accelerate student quiz attempts lookups
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_cohort_quiz ON quiz_attempts(user_id, cohort_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_user_cohort ON quiz_attempts(quiz_id, user_id, cohort_id);

-- 5. Accelerate module filtering by publication status
CREATE INDEX IF NOT EXISTS idx_modules_cohort_status ON modules(cohort_id, status);
CREATE INDEX IF NOT EXISTS idx_modules_program_status ON modules(program_id, status);

-- 6. Accelerate quiz lookups attached to lessons or modules
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_published ON quizzes(lesson_id, status, published);
CREATE INDEX IF NOT EXISTS idx_quizzes_module_published ON quizzes(module_id, status, published);
