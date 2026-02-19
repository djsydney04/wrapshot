-- AI cache table for deduplicating repeated LLM requests
CREATE TABLE IF NOT EXISTS "AICache" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT REFERENCES "Project"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint VARCHAR(120) NOT NULL,
  "cacheKey" TEXT NOT NULL,
  response JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(endpoint, "cacheKey")
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_project_id ON "AICache" ("projectId");
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_id ON "AICache" ("userId");
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON "AICache" ("expiresAt");

ALTER TABLE "AICache" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_cache_select" ON "AICache";
CREATE POLICY "ai_cache_select" ON "AICache"
  FOR SELECT
  USING (
    "userId" = auth.uid()
    OR (
      "projectId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "ProjectMember" pm
        WHERE pm."projectId" = "AICache"."projectId"
          AND pm."userId" = auth.uid()::TEXT
      )
    )
  );

DROP POLICY IF EXISTS "ai_cache_insert" ON "AICache";
CREATE POLICY "ai_cache_insert" ON "AICache"
  FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()
    AND (
      "projectId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "ProjectMember" pm
        WHERE pm."projectId" = "AICache"."projectId"
          AND pm."userId" = auth.uid()::TEXT
      )
    )
  );

DROP POLICY IF EXISTS "ai_cache_update" ON "AICache";
CREATE POLICY "ai_cache_update" ON "AICache"
  FOR UPDATE
  USING (
    "userId" = auth.uid()
    OR (
      "projectId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "ProjectMember" pm
        WHERE pm."projectId" = "AICache"."projectId"
          AND pm."userId" = auth.uid()::TEXT
      )
    )
  )
  WITH CHECK (
    "userId" = auth.uid()
    AND (
      "projectId" IS NULL
      OR EXISTS (
        SELECT 1 FROM "ProjectMember" pm
        WHERE pm."projectId" = "AICache"."projectId"
          AND pm."userId" = auth.uid()::TEXT
      )
    )
  );

-- Allow users to remove cache rows they own or can access through project membership
DROP POLICY IF EXISTS "ai_cache_delete" ON "AICache";
CREATE POLICY "ai_cache_delete" ON "AICache"
  FOR DELETE
  USING (
    "userId" = auth.uid()
    OR (
      "projectId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "ProjectMember" pm
        WHERE pm."projectId" = "AICache"."projectId"
          AND pm."userId" = auth.uid()::TEXT
      )
    )
  );

-- Location-level immediate filming area (e.g. "Arts District, 3-block radius around Main & 6th")
ALTER TABLE "Location"
ADD COLUMN IF NOT EXISTS "immediateArea" TEXT;
