-- Stripeboard Schema Extensions
-- Adds AI breakdown fields and stripeboard support

-- Create new enums
CREATE TYPE "ScriptBreakdownStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "BreakdownStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVIEW');

-- Extend Script model with breakdown tracking
ALTER TABLE "Script"
ADD COLUMN IF NOT EXISTS "breakdownStatus" "ScriptBreakdownStatus" DEFAULT 'NOT_STARTED',
ADD COLUMN IF NOT EXISTS "breakdownStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "breakdownCompletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "parsedContent" JSONB;

-- Extend Scene model with stripeboard fields
ALTER TABLE "Scene"
ADD COLUMN IF NOT EXISTS "episode" TEXT,
ADD COLUMN IF NOT EXISTS "scenePartNumber" INTEGER,
ADD COLUMN IF NOT EXISTS "setName" TEXT,
ADD COLUMN IF NOT EXISTS "scriptPageStart" DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS "scriptPageEnd" DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS "pageEighths" INTEGER,
ADD COLUMN IF NOT EXISTS "sequence" TEXT,
ADD COLUMN IF NOT EXISTS "estimatedHours" DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS "breakdownStatus" "BreakdownStatus" DEFAULT 'PENDING';

-- Create SceneImage table for breakdown images/storyboards
CREATE TABLE IF NOT EXISTS "SceneImage" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneImage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SceneImage_sceneId_fkey" FOREIGN KEY ("sceneId")
        REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SceneImage_sceneId_idx" ON "SceneImage"("sceneId");

-- Extend ElementCategory enum with new breakdown categories
-- Note: PostgreSQL doesn't allow direct enum modification, so we need to add new values
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'CAMERA';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'GRIP';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'ELECTRIC';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'SET_DRESSING';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'ADDITIONAL_LABOR';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'ANIMAL_WRANGLER';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'MECHANICAL_EFFECTS';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'VIDEO_PLAYBACK';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'LOCATION_NOTES';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'SAFETY_NOTES';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'QUESTIONS';
ALTER TYPE "ElementCategory" ADD VALUE IF NOT EXISTS 'COMMENTS';

-- Enable RLS on SceneImage
ALTER TABLE "SceneImage" ENABLE ROW LEVEL SECURITY;

-- RLS policies for SceneImage (inherit from Scene access)
CREATE POLICY "sceneimage_select_policy" ON "SceneImage"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "Scene" s
            JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
            WHERE s."id" = "SceneImage"."sceneId"
            AND pm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "sceneimage_insert_policy" ON "SceneImage"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Scene" s
            JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
            WHERE s."id" = "SceneImage"."sceneId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "sceneimage_update_policy" ON "SceneImage"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "Scene" s
            JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
            WHERE s."id" = "SceneImage"."sceneId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "sceneimage_delete_policy" ON "SceneImage"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "Scene" s
            JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
            WHERE s."id" = "SceneImage"."sceneId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );
