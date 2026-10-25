-- Migration: 015_applications_willing_to_pay.sql
-- Description: Adds willing_to_pay boolean flag to applications table

ALTER TABLE applications 
  ADD COLUMN IF NOT EXISTS willing_to_pay BOOLEAN NOT NULL DEFAULT TRUE;
