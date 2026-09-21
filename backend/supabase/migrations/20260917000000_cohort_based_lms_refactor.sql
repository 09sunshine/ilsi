-- Supabase Migration: 20260917000000_cohort_based_lms_refactor.sql
-- (Exact schema synchronized with backend/src/database/migrations/002_cohort_based_lms_refactor.sql)

-- 1. Extend cohorts table with fee & operational fields
ALTER TABLE cohorts 
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT,
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS application_open BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS max_participants INT NOT NULL DEFAULT 30;

-- 2. Extend enrollments table with lifecycle timestamps
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Extend payments table with enrollment reference, type, metadata, and updated_at
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'COHORT_FEE',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill enrollment_id for existing payments where user_id & cohort_id match
UPDATE payments p
SET enrollment_id = e.id
FROM enrollments e
WHERE p.enrollment_id IS NULL 
  AND p.user_id = e.user_id 
  AND p.cohort_id = e.cohort_id;

-- 4. Extend applications table with cohort_id
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- 5. Webhook Idempotency Tracking Table
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Performance Indexes for the Cohort Model
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_cohort_id ON enrollments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_payment_status ON enrollments(payment_status);

CREATE INDEX IF NOT EXISTS idx_applications_cohort_id ON applications(cohort_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

CREATE INDEX IF NOT EXISTS idx_cohorts_program_id ON cohorts(program_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_status ON cohorts(status);
CREATE INDEX IF NOT EXISTS idx_cohorts_dates ON cohorts(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_live_sessions_cohort_starts ON live_sessions(cohort_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_modules_cohort_order ON modules(cohort_id, order_index);

CREATE INDEX IF NOT EXISTS idx_payments_enrollment_id ON payments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_cohort ON payments(user_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event ON processed_webhook_events(event_id);
