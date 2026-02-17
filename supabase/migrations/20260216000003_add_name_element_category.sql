-- Add NAME to element_category enum for scene breakdowns
-- This allows tracking character names and other named entities in scenes
-- Note: If NAME already exists in the enum, this migration can be skipped

-- Check if running on PostgreSQL 9.3+ which supports IF NOT EXISTS
ALTER TYPE element_category ADD VALUE IF NOT EXISTS 'NAME';
