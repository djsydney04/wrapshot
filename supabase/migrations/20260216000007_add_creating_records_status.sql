-- Add 'creating_records' status to AgentJobStatus enum
-- This step runs after all extraction steps to persist data to the database

ALTER TYPE "AgentJobStatus" ADD VALUE IF NOT EXISTS 'creating_records' BEFORE 'completed';
