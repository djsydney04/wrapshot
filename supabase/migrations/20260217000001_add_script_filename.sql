-- Add fileName column to Script table
-- Stores the original uploaded file name for display purposes

ALTER TABLE "Script" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
