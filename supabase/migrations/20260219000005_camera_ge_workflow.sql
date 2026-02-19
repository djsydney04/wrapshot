-- Camera + G&E workflow expansion
-- Cross-cutting department primitives + Camera (C1-C3) + G&E (G1-G3)

DO $$ BEGIN
  CREATE TYPE "DepartmentAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DepartmentReadinessStatus" AS ENUM ('NOT_READY', 'IN_PROGRESS', 'READY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION check_department_manager(proj_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_project_role(
    proj_id,
    user_id,
    ARRAY['ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_department_manager(TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS "DepartmentAttachment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DepartmentCommentThread" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", "entityType", "entityId")
);

CREATE TABLE IF NOT EXISTS "DepartmentComment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "threadId" TEXT NOT NULL REFERENCES "DepartmentCommentThread"(id) ON DELETE CASCADE,
  "authorId" TEXT NOT NULL,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DepartmentSceneReadiness" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  status "DepartmentReadinessStatus" NOT NULL DEFAULT 'NOT_READY',
  notes TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("sceneId", department)
);

CREATE TABLE IF NOT EXISTS "DepartmentDayDependency" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  severity "DepartmentAlertSeverity" NOT NULL DEFAULT 'WARNING',
  message TEXT NOT NULL,
  metadata JSONB,
  "createdBy" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", "shootingDayId", department, "sourceType", "sourceId")
);

CREATE TABLE IF NOT EXISTS "DepartmentBudgetLink" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "budgetId" UUID REFERENCES "Budget"(id) ON DELETE SET NULL,
  "categoryId" UUID REFERENCES "BudgetCategory"(id) ON DELETE SET NULL,
  "lineItemId" UUID REFERENCES "BudgetLineItem"(id) ON DELETE SET NULL,
  "requestId" UUID REFERENCES "DepartmentBudgetRequest"(id) ON DELETE SET NULL,
  "plannedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "committedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", department, "sourceType", "sourceId")
);

CREATE TABLE IF NOT EXISTS "CameraShot" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "shotCode" TEXT NOT NULL,
  framing TEXT,
  movement TEXT,
  fps INTEGER,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'READY', 'SHOT')),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("sceneId", "shotCode")
);

CREATE TABLE IF NOT EXISTS "CameraPackageNeed" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shotId" TEXT NOT NULL REFERENCES "CameraShot"(id) ON DELETE CASCADE,
  "itemType" TEXT NOT NULL,
  spec TEXT,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  source TEXT NOT NULL DEFAULT 'OWNED' CHECK (source IN ('OWNED', 'RENTAL', 'PURCHASE', 'BORROW')),
  "estimatedRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SOURCED', 'UNAVAILABLE', 'READY')),
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CameraAsset" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  serial TEXT,
  "ownerType" TEXT NOT NULL DEFAULT 'OWNED' CHECK ("ownerType" IN ('OWNED', 'RENTED')),
  "vendorId" TEXT,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BOOKED', 'IN_USE', 'MAINTENANCE', 'WRAPPED')),
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CameraBooking" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "assetId" TEXT NOT NULL REFERENCES "CameraAsset"(id) ON DELETE CASCADE,
  "startDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "endDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  "poNumber" TEXT,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED')),
  "returnDueAt" TIMESTAMPTZ,
  "returnedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "CameraReport" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "cameraUnit" TEXT NOT NULL DEFAULT 'MAIN',
  "operatorId" TEXT REFERENCES "CrewMember"(id) ON DELETE SET NULL,
  summary TEXT,
  issues TEXT,
  "submittedBy" TEXT,
  "submittedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("shootingDayId", "cameraUnit")
);

CREATE TABLE IF NOT EXISTS "CameraCardLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "reportId" TEXT NOT NULL REFERENCES "CameraReport"(id) ON DELETE CASCADE,
  roll TEXT NOT NULL,
  "cardLabel" TEXT,
  codec TEXT,
  resolution TEXT,
  "tcStart" TEXT,
  "tcEnd" TEXT,
  "offloadedAt" TIMESTAMPTZ,
  checksum TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("reportId", roll)
);

CREATE TABLE IF NOT EXISTS "LightingPlan" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "gafferId" TEXT REFERENCES "CrewMember"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'PUBLISHED')),
  notes TEXT,
  "publishedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("sceneId", "shootingDayId")
);

CREATE TABLE IF NOT EXISTS "LightingNeed" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "planId" TEXT NOT NULL REFERENCES "LightingPlan"(id) ON DELETE CASCADE,
  "fixtureType" TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  "powerDraw" DECIMAL(8,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'OWNED' CHECK (source IN ('OWNED', 'RENTAL', 'PURCHASE', 'BORROW')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SOURCED', 'UNAVAILABLE', 'READY')),
  "estimatedRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RiggingTask" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "locationId" TEXT REFERENCES "Location"(id) ON DELETE SET NULL,
  "startDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "endDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED')),
  notes TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "RiggingTaskScene" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "taskId" TEXT NOT NULL REFERENCES "RiggingTask"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  UNIQUE("taskId", "sceneId")
);

CREATE TABLE IF NOT EXISTS "GripCrewAssignment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "taskId" TEXT NOT NULL REFERENCES "RiggingTask"(id) ON DELETE CASCADE,
  "crewMemberId" TEXT NOT NULL REFERENCES "CrewMember"(id) ON DELETE CASCADE,
  role TEXT,
  "callTime" TIME,
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("taskId", "crewMemberId")
);

CREATE TABLE IF NOT EXISTS "PowerPlan" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "locationId" TEXT REFERENCES "Location"(id) ON DELETE SET NULL,
  generator TEXT,
  "capacityAmps" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "distroNotes" TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'PASSED', 'FAILED')),
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("shootingDayId")
);

CREATE TABLE IF NOT EXISTS "PowerCircuit" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "powerPlanId" TEXT NOT NULL REFERENCES "PowerPlan"(id) ON DELETE CASCADE,
  "runLabel" TEXT NOT NULL,
  "loadAmps" DECIMAL(8,2) NOT NULL DEFAULT 0,
  breaker TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'FAILED')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("powerPlanId", "runLabel")
);

CREATE TABLE IF NOT EXISTS "SafetyChecklist" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  item TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUIRED' CHECK (status IN ('REQUIRED', 'IN_PROGRESS', 'COMPLETE', 'FAILED')),
  "completedBy" TEXT,
  "completedAt" TIMESTAMPTZ,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("shootingDayId", department, item)
);

CREATE INDEX IF NOT EXISTS "DepartmentAttachment_project_entity_idx"
  ON "DepartmentAttachment" ("projectId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "DepartmentCommentThread_project_entity_idx"
  ON "DepartmentCommentThread" ("projectId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "DepartmentComment_thread_idx"
  ON "DepartmentComment" ("threadId");
CREATE INDEX IF NOT EXISTS "DepartmentSceneReadiness_project_dept_status_idx"
  ON "DepartmentSceneReadiness" ("projectId", department, status);
CREATE INDEX IF NOT EXISTS "DepartmentDayDependency_project_day_status_idx"
  ON "DepartmentDayDependency" ("projectId", "shootingDayId", status);
CREATE INDEX IF NOT EXISTS "DepartmentDayDependency_dept_severity_idx"
  ON "DepartmentDayDependency" (department, severity);
CREATE INDEX IF NOT EXISTS "DepartmentBudgetLink_project_source_idx"
  ON "DepartmentBudgetLink" ("projectId", department, "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "CameraShot_project_scene_day_idx"
  ON "CameraShot" ("projectId", "sceneId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "CameraPackageNeed_shot_status_idx"
  ON "CameraPackageNeed" ("shotId", status);
CREATE INDEX IF NOT EXISTS "CameraAsset_project_status_idx"
  ON "CameraAsset" ("projectId", status);
CREATE INDEX IF NOT EXISTS "CameraBooking_asset_days_idx"
  ON "CameraBooking" ("assetId", "startDayId", "endDayId");
CREATE INDEX IF NOT EXISTS "CameraReport_project_day_idx"
  ON "CameraReport" ("projectId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "CameraCardLog_report_roll_idx"
  ON "CameraCardLog" ("reportId", roll);

CREATE INDEX IF NOT EXISTS "LightingPlan_project_scene_day_idx"
  ON "LightingPlan" ("projectId", "sceneId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "LightingNeed_plan_status_idx"
  ON "LightingNeed" ("planId", status);
CREATE INDEX IF NOT EXISTS "RiggingTask_project_days_status_idx"
  ON "RiggingTask" ("projectId", "startDayId", "endDayId", status);
CREATE INDEX IF NOT EXISTS "RiggingTaskScene_task_idx"
  ON "RiggingTaskScene" ("taskId");
CREATE INDEX IF NOT EXISTS "GripCrewAssignment_task_idx"
  ON "GripCrewAssignment" ("taskId");
CREATE INDEX IF NOT EXISTS "PowerPlan_project_day_idx"
  ON "PowerPlan" ("projectId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "PowerCircuit_plan_idx"
  ON "PowerCircuit" ("powerPlanId");
CREATE INDEX IF NOT EXISTS "SafetyChecklist_project_day_status_idx"
  ON "SafetyChecklist" ("projectId", "shootingDayId", status);

DROP TRIGGER IF EXISTS update_department_comment_thread_updated_at ON "DepartmentCommentThread";
CREATE TRIGGER update_department_comment_thread_updated_at
  BEFORE UPDATE ON "DepartmentCommentThread"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_department_comment_updated_at ON "DepartmentComment";
CREATE TRIGGER update_department_comment_updated_at
  BEFORE UPDATE ON "DepartmentComment"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_department_scene_readiness_updated_at ON "DepartmentSceneReadiness";
CREATE TRIGGER update_department_scene_readiness_updated_at
  BEFORE UPDATE ON "DepartmentSceneReadiness"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_department_day_dependency_updated_at ON "DepartmentDayDependency";
CREATE TRIGGER update_department_day_dependency_updated_at
  BEFORE UPDATE ON "DepartmentDayDependency"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_department_budget_link_updated_at ON "DepartmentBudgetLink";
CREATE TRIGGER update_department_budget_link_updated_at
  BEFORE UPDATE ON "DepartmentBudgetLink"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_shot_updated_at ON "CameraShot";
CREATE TRIGGER update_camera_shot_updated_at
  BEFORE UPDATE ON "CameraShot"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_package_need_updated_at ON "CameraPackageNeed";
CREATE TRIGGER update_camera_package_need_updated_at
  BEFORE UPDATE ON "CameraPackageNeed"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_asset_updated_at ON "CameraAsset";
CREATE TRIGGER update_camera_asset_updated_at
  BEFORE UPDATE ON "CameraAsset"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_booking_updated_at ON "CameraBooking";
CREATE TRIGGER update_camera_booking_updated_at
  BEFORE UPDATE ON "CameraBooking"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_report_updated_at ON "CameraReport";
CREATE TRIGGER update_camera_report_updated_at
  BEFORE UPDATE ON "CameraReport"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_card_log_updated_at ON "CameraCardLog";
CREATE TRIGGER update_camera_card_log_updated_at
  BEFORE UPDATE ON "CameraCardLog"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lighting_plan_updated_at ON "LightingPlan";
CREATE TRIGGER update_lighting_plan_updated_at
  BEFORE UPDATE ON "LightingPlan"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lighting_need_updated_at ON "LightingNeed";
CREATE TRIGGER update_lighting_need_updated_at
  BEFORE UPDATE ON "LightingNeed"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rigging_task_updated_at ON "RiggingTask";
CREATE TRIGGER update_rigging_task_updated_at
  BEFORE UPDATE ON "RiggingTask"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_grip_crew_assignment_updated_at ON "GripCrewAssignment";
CREATE TRIGGER update_grip_crew_assignment_updated_at
  BEFORE UPDATE ON "GripCrewAssignment"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_power_plan_updated_at ON "PowerPlan";
CREATE TRIGGER update_power_plan_updated_at
  BEFORE UPDATE ON "PowerPlan"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_power_circuit_updated_at ON "PowerCircuit";
CREATE TRIGGER update_power_circuit_updated_at
  BEFORE UPDATE ON "PowerCircuit"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_safety_checklist_updated_at ON "SafetyChecklist";
CREATE TRIGGER update_safety_checklist_updated_at
  BEFORE UPDATE ON "SafetyChecklist"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "DepartmentAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentCommentThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentSceneReadiness" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentDayDependency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DepartmentBudgetLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraShot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraPackageNeed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CameraCardLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LightingPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LightingNeed" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiggingTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RiggingTaskScene" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GripCrewAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PowerPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PowerCircuit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SafetyChecklist" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "department_attachment_select" ON "DepartmentAttachment";
CREATE POLICY "department_attachment_select"
  ON "DepartmentAttachment" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_attachment_insert" ON "DepartmentAttachment";
CREATE POLICY "department_attachment_insert"
  ON "DepartmentAttachment" FOR INSERT
  WITH CHECK (
    "uploadedBy" = auth.uid()::TEXT
    AND check_department_manager("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "department_attachment_update" ON "DepartmentAttachment";
CREATE POLICY "department_attachment_update"
  ON "DepartmentAttachment" FOR UPDATE
  USING (
    "uploadedBy" = auth.uid()::TEXT
    OR check_department_manager("projectId", auth.uid()::TEXT)
  )
  WITH CHECK (
    "uploadedBy" = auth.uid()::TEXT
    OR check_department_manager("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "department_attachment_delete" ON "DepartmentAttachment";
CREATE POLICY "department_attachment_delete"
  ON "DepartmentAttachment" FOR DELETE
  USING (
    "uploadedBy" = auth.uid()::TEXT
    OR check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR'])
  );

DROP POLICY IF EXISTS "department_comment_thread_select" ON "DepartmentCommentThread";
CREATE POLICY "department_comment_thread_select"
  ON "DepartmentCommentThread" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_comment_thread_manage" ON "DepartmentCommentThread";
CREATE POLICY "department_comment_thread_manage"
  ON "DepartmentCommentThread" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_comment_select" ON "DepartmentComment";
CREATE POLICY "department_comment_select"
  ON "DepartmentComment" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "DepartmentCommentThread" dct
      WHERE dct.id = "DepartmentComment"."threadId"
        AND check_project_membership(dct."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "department_comment_insert" ON "DepartmentComment";
CREATE POLICY "department_comment_insert"
  ON "DepartmentComment" FOR INSERT
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    AND EXISTS (
      SELECT 1
      FROM "DepartmentCommentThread" dct
      WHERE dct.id = "DepartmentComment"."threadId"
        AND check_department_manager(dct."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "department_comment_update" ON "DepartmentComment";
CREATE POLICY "department_comment_update"
  ON "DepartmentComment" FOR UPDATE
  USING (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "DepartmentCommentThread" dct
      WHERE dct.id = "DepartmentComment"."threadId"
        AND check_department_manager(dct."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "DepartmentCommentThread" dct
      WHERE dct.id = "DepartmentComment"."threadId"
        AND check_department_manager(dct."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "department_comment_delete" ON "DepartmentComment";
CREATE POLICY "department_comment_delete"
  ON "DepartmentComment" FOR DELETE
  USING (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "DepartmentCommentThread" dct
      WHERE dct.id = "DepartmentComment"."threadId"
        AND check_project_role(dct."projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR'])
    )
  );

DROP POLICY IF EXISTS "department_scene_readiness_select" ON "DepartmentSceneReadiness";
CREATE POLICY "department_scene_readiness_select"
  ON "DepartmentSceneReadiness" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_scene_readiness_manage" ON "DepartmentSceneReadiness";
CREATE POLICY "department_scene_readiness_manage"
  ON "DepartmentSceneReadiness" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_day_dependency_select" ON "DepartmentDayDependency";
CREATE POLICY "department_day_dependency_select"
  ON "DepartmentDayDependency" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_day_dependency_manage" ON "DepartmentDayDependency";
CREATE POLICY "department_day_dependency_manage"
  ON "DepartmentDayDependency" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_budget_link_select" ON "DepartmentBudgetLink";
CREATE POLICY "department_budget_link_select"
  ON "DepartmentBudgetLink" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "department_budget_link_manage" ON "DepartmentBudgetLink";
CREATE POLICY "department_budget_link_manage"
  ON "DepartmentBudgetLink" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_shot_select" ON "CameraShot";
CREATE POLICY "camera_shot_select"
  ON "CameraShot" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_shot_manage" ON "CameraShot";
CREATE POLICY "camera_shot_manage"
  ON "CameraShot" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_package_need_select" ON "CameraPackageNeed";
CREATE POLICY "camera_package_need_select"
  ON "CameraPackageNeed" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_package_need_manage" ON "CameraPackageNeed";
CREATE POLICY "camera_package_need_manage"
  ON "CameraPackageNeed" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_asset_select" ON "CameraAsset";
CREATE POLICY "camera_asset_select"
  ON "CameraAsset" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_asset_manage" ON "CameraAsset";
CREATE POLICY "camera_asset_manage"
  ON "CameraAsset" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_booking_select" ON "CameraBooking";
CREATE POLICY "camera_booking_select"
  ON "CameraBooking" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_booking_manage" ON "CameraBooking";
CREATE POLICY "camera_booking_manage"
  ON "CameraBooking" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_report_select" ON "CameraReport";
CREATE POLICY "camera_report_select"
  ON "CameraReport" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_report_manage" ON "CameraReport";
CREATE POLICY "camera_report_manage"
  ON "CameraReport" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "camera_card_log_select" ON "CameraCardLog";
CREATE POLICY "camera_card_log_select"
  ON "CameraCardLog" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "CameraReport" cr
      WHERE cr.id = "CameraCardLog"."reportId"
        AND check_project_membership(cr."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "camera_card_log_manage" ON "CameraCardLog";
CREATE POLICY "camera_card_log_manage"
  ON "CameraCardLog" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "CameraReport" cr
      WHERE cr.id = "CameraCardLog"."reportId"
        AND check_department_manager(cr."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "CameraReport" cr
      WHERE cr.id = "CameraCardLog"."reportId"
        AND check_department_manager(cr."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "lighting_plan_select" ON "LightingPlan";
CREATE POLICY "lighting_plan_select"
  ON "LightingPlan" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "lighting_plan_manage" ON "LightingPlan";
CREATE POLICY "lighting_plan_manage"
  ON "LightingPlan" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "lighting_need_select" ON "LightingNeed";
CREATE POLICY "lighting_need_select"
  ON "LightingNeed" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "LightingPlan" lp
      WHERE lp.id = "LightingNeed"."planId"
        AND check_project_membership(lp."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "lighting_need_manage" ON "LightingNeed";
CREATE POLICY "lighting_need_manage"
  ON "LightingNeed" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "LightingPlan" lp
      WHERE lp.id = "LightingNeed"."planId"
        AND check_department_manager(lp."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "LightingPlan" lp
      WHERE lp.id = "LightingNeed"."planId"
        AND check_department_manager(lp."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "rigging_task_select" ON "RiggingTask";
CREATE POLICY "rigging_task_select"
  ON "RiggingTask" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "rigging_task_manage" ON "RiggingTask";
CREATE POLICY "rigging_task_manage"
  ON "RiggingTask" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "rigging_task_scene_select" ON "RiggingTaskScene";
CREATE POLICY "rigging_task_scene_select"
  ON "RiggingTaskScene" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "RiggingTaskScene"."taskId"
        AND check_project_membership(rt."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "rigging_task_scene_manage" ON "RiggingTaskScene";
CREATE POLICY "rigging_task_scene_manage"
  ON "RiggingTaskScene" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "RiggingTaskScene"."taskId"
        AND check_department_manager(rt."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "RiggingTaskScene"."taskId"
        AND check_department_manager(rt."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "grip_crew_assignment_select" ON "GripCrewAssignment";
CREATE POLICY "grip_crew_assignment_select"
  ON "GripCrewAssignment" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "GripCrewAssignment"."taskId"
        AND check_project_membership(rt."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "grip_crew_assignment_manage" ON "GripCrewAssignment";
CREATE POLICY "grip_crew_assignment_manage"
  ON "GripCrewAssignment" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "GripCrewAssignment"."taskId"
        AND check_department_manager(rt."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "RiggingTask" rt
      WHERE rt.id = "GripCrewAssignment"."taskId"
        AND check_department_manager(rt."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "power_plan_select" ON "PowerPlan";
CREATE POLICY "power_plan_select"
  ON "PowerPlan" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "power_plan_manage" ON "PowerPlan";
CREATE POLICY "power_plan_manage"
  ON "PowerPlan" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "power_circuit_select" ON "PowerCircuit";
CREATE POLICY "power_circuit_select"
  ON "PowerCircuit" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PowerPlan" pp
      WHERE pp.id = "PowerCircuit"."powerPlanId"
        AND check_project_membership(pp."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "power_circuit_manage" ON "PowerCircuit";
CREATE POLICY "power_circuit_manage"
  ON "PowerCircuit" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "PowerPlan" pp
      WHERE pp.id = "PowerCircuit"."powerPlanId"
        AND check_department_manager(pp."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "PowerPlan" pp
      WHERE pp.id = "PowerCircuit"."powerPlanId"
        AND check_department_manager(pp."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "safety_checklist_select" ON "SafetyChecklist";
CREATE POLICY "safety_checklist_select"
  ON "SafetyChecklist" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "safety_checklist_manage" ON "SafetyChecklist";
CREATE POLICY "safety_checklist_manage"
  ON "SafetyChecklist" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "Request creators can update pending requests" ON "DepartmentBudgetRequest";
CREATE POLICY "Request creators can update pending requests"
  ON "DepartmentBudgetRequest" FOR UPDATE
  USING (
    "requestedBy" = auth.uid()
    AND status = 'PENDING'
  )
  WITH CHECK (
    "requestedBy" = auth.uid()
    AND status = 'PENDING'
  );
