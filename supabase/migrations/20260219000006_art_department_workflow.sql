-- Art Department workflow expansion
-- A1 Continuity Bible
-- A2 Set dressing + props pull lists
-- A3 Build/strike schedule
-- Reuses existing Department* readiness, dependency, budget-link, attachment, and comment primitives

CREATE TABLE IF NOT EXISTS "ArtContinuityBook" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Continuity Bible',
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId")
);

CREATE TABLE IF NOT EXISTS "ArtContinuityEntry" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "continuityBookId" TEXT NOT NULL REFERENCES "ArtContinuityBook"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "dueDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "scriptDay" TEXT,
  "subjectType" TEXT NOT NULL DEFAULT 'SET'
    CHECK ("subjectType" IN ('CHARACTER', 'SET', 'PROP', 'WARDROBE', 'OTHER')),
  "subjectName" TEXT NOT NULL,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK ("riskLevel" IN ('LOW', 'MEDIUM', 'HIGH')),
  "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdBy" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ArtContinuityPhoto" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "entryId" TEXT NOT NULL REFERENCES "ArtContinuityEntry"(id) ON DELETE CASCADE,
  "fileUrl" TEXT NOT NULL,
  angle TEXT,
  "lookType" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ArtPullList" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'WRAPPED')),
  "ownerCrewId" TEXT REFERENCES "CrewMember"(id) ON DELETE SET NULL,
  notes TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ArtPullItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "listId" TEXT NOT NULL REFERENCES "ArtPullList"(id) ON DELETE CASCADE,
  "sourceElementId" TEXT REFERENCES "SceneElement"(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  source TEXT NOT NULL DEFAULT 'STOCK'
    CHECK (source IN ('STOCK', 'RENTAL', 'PURCHASE', 'BORROW', 'BUILD')),
  "dueDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'TO_SOURCE'
    CHECK (status IN ('TO_SOURCE', 'PULLED', 'ON_TRUCK', 'ON_SET', 'WRAPPED')),
  vendor TEXT,
  "plannedUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "plannedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isBlocking" BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ArtWorkOrder" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "locationId" TEXT REFERENCES "Location"(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('BUILD', 'PAINT', 'SET_DRESS', 'STRIKE')),
  "startDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "endDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  summary TEXT,
  notes TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ArtWorkOrderScene" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "workOrderId" TEXT NOT NULL REFERENCES "ArtWorkOrder"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  UNIQUE("workOrderId", "sceneId")
);

CREATE TABLE IF NOT EXISTS "ArtCrewAssignment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "workOrderId" TEXT NOT NULL REFERENCES "ArtWorkOrder"(id) ON DELETE CASCADE,
  "crewMemberId" TEXT NOT NULL REFERENCES "CrewMember"(id) ON DELETE CASCADE,
  hours DECIMAL(6,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("workOrderId", "crewMemberId")
);

CREATE INDEX IF NOT EXISTS "ArtContinuityBook_project_idx"
  ON "ArtContinuityBook" ("projectId");
CREATE INDEX IF NOT EXISTS "ArtContinuityEntry_project_scene_idx"
  ON "ArtContinuityEntry" ("projectId", "sceneId");
CREATE INDEX IF NOT EXISTS "ArtContinuityEntry_due_resolved_idx"
  ON "ArtContinuityEntry" ("dueDayId", "isResolved");
CREATE INDEX IF NOT EXISTS "ArtContinuityPhoto_entry_idx"
  ON "ArtContinuityPhoto" ("entryId", "sortOrder");
CREATE INDEX IF NOT EXISTS "ArtPullList_project_scene_day_idx"
  ON "ArtPullList" ("projectId", "sceneId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "ArtPullItem_list_status_due_idx"
  ON "ArtPullItem" ("listId", status, "dueDayId");
CREATE INDEX IF NOT EXISTS "ArtPullItem_due_status_idx"
  ON "ArtPullItem" ("dueDayId", status);
CREATE INDEX IF NOT EXISTS "ArtWorkOrder_project_day_status_idx"
  ON "ArtWorkOrder" ("projectId", "startDayId", "endDayId", status);
CREATE INDEX IF NOT EXISTS "ArtWorkOrderScene_work_order_idx"
  ON "ArtWorkOrderScene" ("workOrderId");
CREATE INDEX IF NOT EXISTS "ArtCrewAssignment_work_order_idx"
  ON "ArtCrewAssignment" ("workOrderId");

DROP TRIGGER IF EXISTS update_art_continuity_book_updated_at ON "ArtContinuityBook";
CREATE TRIGGER update_art_continuity_book_updated_at
  BEFORE UPDATE ON "ArtContinuityBook"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_continuity_entry_updated_at ON "ArtContinuityEntry";
CREATE TRIGGER update_art_continuity_entry_updated_at
  BEFORE UPDATE ON "ArtContinuityEntry"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_continuity_photo_updated_at ON "ArtContinuityPhoto";
CREATE TRIGGER update_art_continuity_photo_updated_at
  BEFORE UPDATE ON "ArtContinuityPhoto"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_pull_list_updated_at ON "ArtPullList";
CREATE TRIGGER update_art_pull_list_updated_at
  BEFORE UPDATE ON "ArtPullList"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_pull_item_updated_at ON "ArtPullItem";
CREATE TRIGGER update_art_pull_item_updated_at
  BEFORE UPDATE ON "ArtPullItem"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_work_order_updated_at ON "ArtWorkOrder";
CREATE TRIGGER update_art_work_order_updated_at
  BEFORE UPDATE ON "ArtWorkOrder"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_art_crew_assignment_updated_at ON "ArtCrewAssignment";
CREATE TRIGGER update_art_crew_assignment_updated_at
  BEFORE UPDATE ON "ArtCrewAssignment"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "ArtContinuityBook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtContinuityEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtContinuityPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtPullList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtPullItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtWorkOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtWorkOrderScene" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtCrewAssignment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "art_continuity_book_select" ON "ArtContinuityBook";
CREATE POLICY "art_continuity_book_select"
  ON "ArtContinuityBook" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_continuity_book_manage" ON "ArtContinuityBook";
CREATE POLICY "art_continuity_book_manage"
  ON "ArtContinuityBook" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_continuity_entry_select" ON "ArtContinuityEntry";
CREATE POLICY "art_continuity_entry_select"
  ON "ArtContinuityEntry" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_continuity_entry_manage" ON "ArtContinuityEntry";
CREATE POLICY "art_continuity_entry_manage"
  ON "ArtContinuityEntry" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_continuity_photo_select" ON "ArtContinuityPhoto";
CREATE POLICY "art_continuity_photo_select"
  ON "ArtContinuityPhoto" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtContinuityEntry" ace
      WHERE ace.id = "ArtContinuityPhoto"."entryId"
        AND check_project_membership(ace."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_continuity_photo_manage" ON "ArtContinuityPhoto";
CREATE POLICY "art_continuity_photo_manage"
  ON "ArtContinuityPhoto" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtContinuityEntry" ace
      WHERE ace.id = "ArtContinuityPhoto"."entryId"
        AND check_department_manager(ace."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ArtContinuityEntry" ace
      WHERE ace.id = "ArtContinuityPhoto"."entryId"
        AND check_department_manager(ace."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_pull_list_select" ON "ArtPullList";
CREATE POLICY "art_pull_list_select"
  ON "ArtPullList" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_pull_list_manage" ON "ArtPullList";
CREATE POLICY "art_pull_list_manage"
  ON "ArtPullList" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_pull_item_select" ON "ArtPullItem";
CREATE POLICY "art_pull_item_select"
  ON "ArtPullItem" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtPullList" apl
      WHERE apl.id = "ArtPullItem"."listId"
        AND check_project_membership(apl."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_pull_item_manage" ON "ArtPullItem";
CREATE POLICY "art_pull_item_manage"
  ON "ArtPullItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtPullList" apl
      WHERE apl.id = "ArtPullItem"."listId"
        AND check_department_manager(apl."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ArtPullList" apl
      WHERE apl.id = "ArtPullItem"."listId"
        AND check_department_manager(apl."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_work_order_select" ON "ArtWorkOrder";
CREATE POLICY "art_work_order_select"
  ON "ArtWorkOrder" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_work_order_manage" ON "ArtWorkOrder";
CREATE POLICY "art_work_order_manage"
  ON "ArtWorkOrder" FOR ALL
  USING (check_department_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_department_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "art_work_order_scene_select" ON "ArtWorkOrderScene";
CREATE POLICY "art_work_order_scene_select"
  ON "ArtWorkOrderScene" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtWorkOrderScene"."workOrderId"
        AND check_project_membership(awo."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_work_order_scene_manage" ON "ArtWorkOrderScene";
CREATE POLICY "art_work_order_scene_manage"
  ON "ArtWorkOrderScene" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtWorkOrderScene"."workOrderId"
        AND check_department_manager(awo."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtWorkOrderScene"."workOrderId"
        AND check_department_manager(awo."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_crew_assignment_select" ON "ArtCrewAssignment";
CREATE POLICY "art_crew_assignment_select"
  ON "ArtCrewAssignment" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtCrewAssignment"."workOrderId"
        AND check_project_membership(awo."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "art_crew_assignment_manage" ON "ArtCrewAssignment";
CREATE POLICY "art_crew_assignment_manage"
  ON "ArtCrewAssignment" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtCrewAssignment"."workOrderId"
        AND check_department_manager(awo."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "ArtWorkOrder" awo
      WHERE awo.id = "ArtCrewAssignment"."workOrderId"
        AND check_department_manager(awo."projectId", auth.uid()::TEXT)
    )
  );

