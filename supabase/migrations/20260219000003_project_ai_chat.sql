-- Per-user project AI chat history
CREATE TABLE IF NOT EXISTS "ProjectAIChatMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ProjectAIChatMessage_project_user_created_idx"
  ON "ProjectAIChatMessage"("projectId", "userId", "createdAt");

ALTER TABLE "ProjectAIChatMessage" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_ai_chat_select_policy" ON "ProjectAIChatMessage";
CREATE POLICY "project_ai_chat_select_policy" ON "ProjectAIChatMessage"
  FOR SELECT
  USING (
    "userId" = auth.uid()
    AND EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "ProjectAIChatMessage"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

DROP POLICY IF EXISTS "project_ai_chat_insert_policy" ON "ProjectAIChatMessage";
CREATE POLICY "project_ai_chat_insert_policy" ON "ProjectAIChatMessage"
  FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()
    AND EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "ProjectAIChatMessage"."projectId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );
