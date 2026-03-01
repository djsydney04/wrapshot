-- Add confidence score for AI crew suggestions
ALTER TABLE "CrewSuggestion"
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7;

CREATE INDEX IF NOT EXISTS "CrewSuggestion_confidence_idx" ON "CrewSuggestion"("confidence");
