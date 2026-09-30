-- Migration 010: Ensure quizzes has updated_at column
ALTER TABLE IF EXISTS quizzes 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure status column exists as well
ALTER TABLE IF EXISTS quizzes 
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED';
