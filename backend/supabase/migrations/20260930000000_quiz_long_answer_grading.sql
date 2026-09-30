-- Migration: Add Manual Grading and Evaluation Fields to Quiz Answers
-- Supports LONG_ANSWER question type manual review by instructors and admins

ALTER TABLE IF EXISTS quiz_answers 
  ADD COLUMN IF NOT EXISTS manual_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS manual_rating VARCHAR(50),
  ADD COLUMN IF NOT EXISTS manual_feedback TEXT,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graded_by TEXT;

-- Create an index to quickly filter ungraded vs graded answers
CREATE INDEX IF NOT EXISTS idx_quiz_answers_manual_grading 
  ON quiz_answers (graded_at, question_id);
