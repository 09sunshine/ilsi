-- Migration: 012_payment_providers_paypal_paym.sql
-- Add multi-provider payment fields (PayPal, Pay'm, Stripe) and separate donation tracking

-- 1. Extend payments table for multi-provider support
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS internal_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(50) NOT NULL DEFAULT 'course_payment';

-- Ensure unique internal reference constraint on payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_payments_internal_reference'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT uq_payments_internal_reference UNIQUE (internal_reference);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_internal_reference ON payments(internal_reference);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id ON payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);
CREATE INDEX IF NOT EXISTS idx_payments_purpose ON payments(purpose);

-- 2. Extend donations table for multi-provider support
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS internal_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ensure unique internal reference constraint on donations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_donations_internal_reference'
  ) THEN
    ALTER TABLE donations ADD CONSTRAINT uq_donations_internal_reference UNIQUE (internal_reference);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_donations_internal_reference ON donations(internal_reference);
CREATE INDEX IF NOT EXISTS idx_donations_provider_order_id ON donations(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_donations_provider ON donations(provider);
