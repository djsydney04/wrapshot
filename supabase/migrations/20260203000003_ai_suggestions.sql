-- AI Suggestions table for tracking accept/dismiss behavior
CREATE TABLE IF NOT EXISTS "AISuggestion" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT REFERENCES "Scene"(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('element', 'synopsis', 'time_estimate', 'script_change')),
  suggestion JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "respondedAt" TIMESTAMP WITH TIME ZONE,
  "respondedBy" UUID REFERENCES auth.users(id)
);

-- Indexes for efficient queries
CREATE INDEX idx_ai_suggestion_project ON "AISuggestion"("projectId");
CREATE INDEX idx_ai_suggestion_scene ON "AISuggestion"("sceneId");
CREATE INDEX idx_ai_suggestion_status ON "AISuggestion"(status);
CREATE INDEX idx_ai_suggestion_type ON "AISuggestion"(type);

-- AI Processing Log for usage tracking and debugging
CREATE TABLE IF NOT EXISTS "AIProcessingLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT REFERENCES "Project"(id) ON DELETE SET NULL,
  "userId" UUID REFERENCES auth.users(id),
  endpoint VARCHAR(100) NOT NULL,
  "tokensUsed" INTEGER,
  "processingTimeMs" INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying usage stats
CREATE INDEX idx_ai_log_project ON "AIProcessingLog"("projectId");
CREATE INDEX idx_ai_log_user ON "AIProcessingLog"("userId");
CREATE INDEX idx_ai_log_endpoint ON "AIProcessingLog"(endpoint);
CREATE INDEX idx_ai_log_created ON "AIProcessingLog"("createdAt");

-- Enable RLS
ALTER TABLE "AISuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIProcessingLog" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for AISuggestion
-- Users can view suggestions for projects they're members of
CREATE POLICY "ai_suggestion_select" ON "AISuggestion"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "AISuggestion"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

-- Users can insert suggestions for projects they're members of
CREATE POLICY "ai_suggestion_insert" ON "AISuggestion"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "AISuggestion"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

-- Users can update suggestions for projects they're members of
CREATE POLICY "ai_suggestion_update" ON "AISuggestion"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "AISuggestion"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

-- RLS Policies for AIProcessingLog
-- Users can view logs for their projects
CREATE POLICY "ai_log_select" ON "AIProcessingLog"
  FOR SELECT
  USING (
    "userId" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "AIProcessingLog"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

-- Users can insert their own logs
CREATE POLICY "ai_log_insert" ON "AIProcessingLog"
  FOR INSERT
  WITH CHECK ("userId" = auth.uid());
