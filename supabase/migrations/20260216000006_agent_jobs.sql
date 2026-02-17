-- Agent Jobs System
-- Provides async job tracking for AI agents with real-time progress updates

-- Create AgentJobType enum
CREATE TYPE "AgentJobType" AS ENUM (
    'script_analysis',
    'schedule_planning',
    'element_extraction',
    'cast_matching'
);

-- Create AgentJobStatus enum with detailed states
CREATE TYPE "AgentJobStatus" AS ENUM (
    'pending',
    'parsing',
    'chunking',
    'extracting_scenes',
    'extracting_elements',
    'linking_cast',
    'generating_synopses',
    'estimating_time',
    'completed',
    'failed',
    'cancelled'
);

-- Create AgentJob table
CREATE TABLE IF NOT EXISTS "AgentJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT,
    "userId" TEXT NOT NULL,
    "jobType" "AgentJobType" NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'pending',

    -- Progress tracking
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "stepDescription" TEXT,

    -- Results and errors
    "result" JSONB,
    "errorMessage" TEXT,
    "errorDetails" JSONB,

    -- Timing
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "processingTimeMs" INTEGER,

    -- Metadata for cross-chunk context
    "context" JSONB,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgentJob_projectId_fkey" FOREIGN KEY ("projectId")
        REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentJob_scriptId_fkey" FOREIGN KEY ("scriptId")
        REFERENCES "Script"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create ScriptChunk table for large script handling
CREATE TABLE IF NOT EXISTS "ScriptChunk" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "pageStart" DECIMAL(6,3),
    "pageEnd" DECIMAL(6,3),
    "sceneCount" INTEGER DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT FALSE,
    "processedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScriptChunk_scriptId_fkey" FOREIGN KEY ("scriptId")
        REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScriptChunk_jobId_fkey" FOREIGN KEY ("jobId")
        REFERENCES "AgentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "AgentJob_projectId_idx" ON "AgentJob"("projectId");
CREATE INDEX IF NOT EXISTS "AgentJob_scriptId_idx" ON "AgentJob"("scriptId");
CREATE INDEX IF NOT EXISTS "AgentJob_userId_idx" ON "AgentJob"("userId");
CREATE INDEX IF NOT EXISTS "AgentJob_status_idx" ON "AgentJob"("status");
CREATE INDEX IF NOT EXISTS "AgentJob_createdAt_idx" ON "AgentJob"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ScriptChunk_scriptId_idx" ON "ScriptChunk"("scriptId");
CREATE INDEX IF NOT EXISTS "ScriptChunk_jobId_idx" ON "ScriptChunk"("jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScriptChunk_jobId_chunkIndex_key" ON "ScriptChunk"("jobId", "chunkIndex");

-- Enable RLS
ALTER TABLE "AgentJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScriptChunk" ENABLE ROW LEVEL SECURITY;

-- RLS policies for AgentJob
CREATE POLICY "agentjob_select_policy" ON "AgentJob"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "AgentJob"."projectId"
            AND pm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "agentjob_insert_policy" ON "AgentJob"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "AgentJob"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "agentjob_update_policy" ON "AgentJob"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "AgentJob"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "agentjob_delete_policy" ON "AgentJob"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "AgentJob"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- RLS policies for ScriptChunk (inherit from AgentJob access)
CREATE POLICY "scriptchunk_select_policy" ON "ScriptChunk"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "AgentJob" aj
            JOIN "ProjectMember" pm ON pm."projectId" = aj."projectId"
            WHERE aj."id" = "ScriptChunk"."jobId"
            AND pm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "scriptchunk_insert_policy" ON "ScriptChunk"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "AgentJob" aj
            JOIN "ProjectMember" pm ON pm."projectId" = aj."projectId"
            WHERE aj."id" = "ScriptChunk"."jobId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "scriptchunk_update_policy" ON "ScriptChunk"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "AgentJob" aj
            JOIN "ProjectMember" pm ON pm."projectId" = aj."projectId"
            WHERE aj."id" = "ScriptChunk"."jobId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "scriptchunk_delete_policy" ON "ScriptChunk"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "AgentJob" aj
            JOIN "ProjectMember" pm ON pm."projectId" = aj."projectId"
            WHERE aj."id" = "ScriptChunk"."jobId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- Enable Realtime for AgentJob to allow live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE "AgentJob";
