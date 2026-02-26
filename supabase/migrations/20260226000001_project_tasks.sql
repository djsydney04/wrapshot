-- Unified project task management (Linear-style tickets + assignees)

DO $$ BEGIN
  CREATE TYPE "ProjectTaskStatus" AS ENUM (
    'BACKLOG',
    'TODO',
    'IN_PROGRESS',
    'BLOCKED',
    'DONE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTaskPriority" AS ENUM (
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTaskType" AS ENUM (
    'GENERAL',
    'ELEMENT',
    'RIGGING',
    'BUDGET',
    'SCENE',
    'CALLSHEET'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectTaskAssigneeRole" AS ENUM (
    'OWNER',
    'COLLABORATOR'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProjectTask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "ProjectTaskPriority" NOT NULL DEFAULT 'NONE',
  "taskType" "ProjectTaskType" NOT NULL DEFAULT 'GENERAL',
  "sourceId" TEXT,
  "dueDate" DATE,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ProjectTaskAssignee" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" UUID NOT NULL REFERENCES "ProjectTask"(id) ON DELETE CASCADE,
  "crewMemberId" TEXT REFERENCES "CrewMember"(id) ON DELETE CASCADE,
  "castMemberId" TEXT REFERENCES "CastMember"(id) ON DELETE CASCADE,
  "assignmentRole" "ProjectTaskAssigneeRole" NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProjectTaskAssignee_single_target_chk"
    CHECK ((("crewMemberId" IS NOT NULL)::INT + ("castMemberId" IS NOT NULL)::INT) = 1)
);

CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_status_idx"
  ON "ProjectTask" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_dueDate_idx"
  ON "ProjectTask" ("projectId", "dueDate");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_priority_idx"
  ON "ProjectTask" ("projectId", "priority");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_taskType_idx"
  ON "ProjectTask" ("projectId", "taskType");

CREATE INDEX IF NOT EXISTS "ProjectTaskAssignee_taskId_idx"
  ON "ProjectTaskAssignee" ("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskAssignee_crewMemberId_idx"
  ON "ProjectTaskAssignee" ("crewMemberId");
CREATE INDEX IF NOT EXISTS "ProjectTaskAssignee_castMemberId_idx"
  ON "ProjectTaskAssignee" ("castMemberId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTaskAssignee_unique_crew_per_task_idx"
  ON "ProjectTaskAssignee" ("taskId", "crewMemberId")
  WHERE "crewMemberId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTaskAssignee_unique_cast_per_task_idx"
  ON "ProjectTaskAssignee" ("taskId", "castMemberId")
  WHERE "castMemberId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTaskAssignee_single_owner_per_task_idx"
  ON "ProjectTaskAssignee" ("taskId")
  WHERE "assignmentRole" = 'OWNER';

DROP TRIGGER IF EXISTS update_project_task_updated_at ON "ProjectTask";
CREATE TRIGGER update_project_task_updated_at
  BEFORE UPDATE ON "ProjectTask"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_task_assignee_updated_at ON "ProjectTaskAssignee";
CREATE TRIGGER update_project_task_assignee_updated_at
  BEFORE UPDATE ON "ProjectTaskAssignee"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "ProjectTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectTaskAssignee" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_task_select" ON "ProjectTask";
CREATE POLICY "project_task_select"
  ON "ProjectTask" FOR SELECT
  USING (is_project_member("projectId"));

DROP POLICY IF EXISTS "project_task_insert" ON "ProjectTask";
CREATE POLICY "project_task_insert"
  ON "ProjectTask" FOR INSERT
  WITH CHECK (is_project_member("projectId"));

DROP POLICY IF EXISTS "project_task_update" ON "ProjectTask";
CREATE POLICY "project_task_update"
  ON "ProjectTask" FOR UPDATE
  USING (is_project_member("projectId"))
  WITH CHECK (is_project_member("projectId"));

DROP POLICY IF EXISTS "project_task_delete" ON "ProjectTask";
CREATE POLICY "project_task_delete"
  ON "ProjectTask" FOR DELETE
  USING (is_project_member("projectId"));

DROP POLICY IF EXISTS "project_task_assignee_select" ON "ProjectTaskAssignee";
CREATE POLICY "project_task_assignee_select"
  ON "ProjectTaskAssignee" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "ProjectTask" pt
      WHERE pt.id = "ProjectTaskAssignee"."taskId"
        AND is_project_member(pt."projectId")
    )
  );

DROP POLICY IF EXISTS "project_task_assignee_insert" ON "ProjectTaskAssignee";
CREATE POLICY "project_task_assignee_insert"
  ON "ProjectTaskAssignee" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ProjectTask" pt
      WHERE pt.id = "ProjectTaskAssignee"."taskId"
        AND is_project_member(pt."projectId")
    )
  );

DROP POLICY IF EXISTS "project_task_assignee_update" ON "ProjectTaskAssignee";
CREATE POLICY "project_task_assignee_update"
  ON "ProjectTaskAssignee" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM "ProjectTask" pt
      WHERE pt.id = "ProjectTaskAssignee"."taskId"
        AND is_project_member(pt."projectId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ProjectTask" pt
      WHERE pt.id = "ProjectTaskAssignee"."taskId"
        AND is_project_member(pt."projectId")
    )
  );

DROP POLICY IF EXISTS "project_task_assignee_delete" ON "ProjectTaskAssignee";
CREATE POLICY "project_task_assignee_delete"
  ON "ProjectTaskAssignee" FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "ProjectTask" pt
      WHERE pt.id = "ProjectTaskAssignee"."taskId"
        AND is_project_member(pt."projectId")
    )
  );
