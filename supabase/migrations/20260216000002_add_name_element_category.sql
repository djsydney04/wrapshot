-- Add NAME to element_category enum for scene breakdowns
-- This allows tracking character names and other named entities in scenes

ALTER TYPE element_category ADD VALUE IF NOT EXISTS 'NAME' BEFORE 'PROP';
