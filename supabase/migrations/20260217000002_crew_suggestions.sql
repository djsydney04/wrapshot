-- Add 'suggesting_crew' status to AgentJobStatus enum
ALTER TYPE "AgentJobStatus" ADD VALUE IF NOT EXISTS 'suggesting_crew' BEFORE 'completed';

-- Create CrewSuggestion table for AI-suggested crew roles
CREATE TABLE IF NOT EXISTS "CrewSuggestion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "accepted" BOOLEAN,
    "crewMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewSuggestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CrewSuggestion_projectId_fkey" FOREIGN KEY ("projectId")
        REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewSuggestion_jobId_fkey" FOREIGN KEY ("jobId")
        REFERENCES "AgentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CrewSuggestion_crewMemberId_fkey" FOREIGN KEY ("crewMemberId")
        REFERENCES "CrewMember"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "CrewSuggestion_projectId_idx" ON "CrewSuggestion"("projectId");
CREATE INDEX IF NOT EXISTS "CrewSuggestion_jobId_idx" ON "CrewSuggestion"("jobId");

-- Enable RLS
ALTER TABLE "CrewSuggestion" ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing project member patterns
CREATE POLICY "crewsuggestion_select_policy" ON "CrewSuggestion"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewSuggestion"."projectId"
            AND pm."userId" = auth.uid()::text
        )
    );

CREATE POLICY "crewsuggestion_insert_policy" ON "CrewSuggestion"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewSuggestion"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "crewsuggestion_update_policy" ON "CrewSuggestion"
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewSuggestion"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
        )
    );

CREATE POLICY "crewsuggestion_delete_policy" ON "CrewSuggestion"
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewSuggestion"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );
