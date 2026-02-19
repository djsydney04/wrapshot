-- Post production workflow expansion
-- P1: Dailies ingest + QC
-- P2: Edit versions + review notes
-- P3: VFX turnover + delivery tracking
-- Includes post readiness/dependency hooks and optional budget linkage

DO $$ BEGIN
  CREATE TYPE "DepartmentReadinessStatus" AS ENUM ('NOT_READY', 'IN_PROGRESS', 'READY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostIngestBatchStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostIngestQcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'MISSING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EditVersionStatus" AS ENUM ('ASSEMBLY', 'DIRECTOR_CUT', 'LOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EditReviewNoteStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VfxShotStatus" AS ENUM ('NOT_SENT', 'IN_VENDOR', 'CLIENT_REVIEW', 'FINAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostAlertSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostAlertStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostBudgetSourceType" AS ENUM (
    'INGEST_BATCH',
    'INGEST_ITEM',
    'EDIT_VERSION',
    'VFX_SHOT',
    'DELIVERY_ITEM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PostEntityType" AS ENUM (
    'INGEST_BATCH',
    'INGEST_ITEM',
    'EDIT_VERSION',
    'EDIT_REVIEW_NOTE',
    'VFX_SHOT',
    'VFX_TURNOVER',
    'DELIVERY_ITEM',
    'DEPENDENCY_ALERT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION check_post_manager(proj_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN check_project_role(
    proj_id,
    user_id,
    ARRAY['ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_post_manager(TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS "PostSceneReadiness" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  status "DepartmentReadinessStatus" NOT NULL DEFAULT 'NOT_READY',
  "blockerCount" INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("sceneId")
);

CREATE TABLE IF NOT EXISTS "PostDayReadiness" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  status "DepartmentReadinessStatus" NOT NULL DEFAULT 'NOT_READY',
  "blockerCount" INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("shootingDayId")
);

CREATE TABLE IF NOT EXISTS "PostDependencyAlert" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT REFERENCES "Scene"(id) ON DELETE SET NULL,
  "shootingDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  severity "PostAlertSeverity" NOT NULL DEFAULT 'WARNING',
  message TEXT NOT NULL,
  status "PostAlertStatus" NOT NULL DEFAULT 'OPEN',
  "createdBy" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PostIngestBatch" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "sourceReportId" TEXT,
  status "PostIngestBatchStatus" NOT NULL DEFAULT 'QUEUED',
  "expectedRollCount" INTEGER NOT NULL DEFAULT 0,
  "receivedRollCount" INTEGER NOT NULL DEFAULT 0,
  "qcPassedCount" INTEGER NOT NULL DEFAULT 0,
  "qcFailedCount" INTEGER NOT NULL DEFAULT 0,
  "missingRollCount" INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("shootingDayId")
);

CREATE TABLE IF NOT EXISTS "PostIngestItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "batchId" TEXT NOT NULL REFERENCES "PostIngestBatch"(id) ON DELETE CASCADE,
  roll TEXT NOT NULL,
  checksum TEXT,
  codec TEXT,
  "tcStart" TEXT,
  "tcEnd" TEXT,
  "offloadedAt" TIMESTAMPTZ,
  "sizeBytes" BIGINT,
  "qcStatus" "PostIngestQcStatus" NOT NULL DEFAULT 'PENDING',
  issue TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("batchId", roll)
);

CREATE TABLE IF NOT EXISTS "PostIssue" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "shootingDayId" TEXT REFERENCES "ShootingDay"(id) ON DELETE SET NULL,
  "batchId" TEXT REFERENCES "PostIngestBatch"(id) ON DELETE SET NULL,
  "itemId" TEXT REFERENCES "PostIngestItem"(id) ON DELETE SET NULL,
  "assignedDepartment" TEXT NOT NULL DEFAULT 'CAMERA',
  title TEXT NOT NULL,
  message TEXT,
  status "PostIssueStatus" NOT NULL DEFAULT 'OPEN',
  "createdBy" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "EditVersion" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "sourceRange" TEXT,
  "exportedAt" TIMESTAMPTZ,
  status "EditVersionStatus" NOT NULL DEFAULT 'ASSEMBLY',
  "storageUrl" TEXT,
  "durationSeconds" INTEGER,
  notes TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "EditReviewNote" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "versionId" TEXT NOT NULL REFERENCES "EditVersion"(id) ON DELETE CASCADE,
  timecode TEXT NOT NULL,
  note TEXT NOT NULL,
  "authorId" TEXT,
  status "EditReviewNoteStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "VfxShot" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sceneId" TEXT REFERENCES "Scene"(id) ON DELETE SET NULL,
  "shotCode" TEXT NOT NULL,
  vendor TEXT,
  bid DECIMAL(12,2),
  "actualCost" DECIMAL(12,2),
  status "VfxShotStatus" NOT NULL DEFAULT 'NOT_SENT',
  "dueDate" DATE,
  "ownerId" TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", "shotCode")
);

CREATE TABLE IF NOT EXISTS "VfxTurnover" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "vfxShotId" TEXT NOT NULL REFERENCES "VfxShot"(id) ON DELETE CASCADE,
  "plateRefs" TEXT,
  notes TEXT,
  "sentAt" TIMESTAMPTZ,
  "approvedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DeliveryChecklistItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "dueDate" DATE,
  status "DeliveryChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "ownerId" TEXT,
  notes TEXT,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PostBudgetLink" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "sourceType" "PostBudgetSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "budgetId" UUID REFERENCES "Budget"(id) ON DELETE SET NULL,
  "lineItemId" UUID REFERENCES "BudgetLineItem"(id) ON DELETE SET NULL,
  "plannedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "committedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "syncToBudget" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastSyncedAt" TIMESTAMPTZ,
  "createdBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", "sourceType", "sourceId"),
  CONSTRAINT post_budget_link_amounts_non_negative CHECK (
    "plannedAmount" >= 0
    AND "committedAmount" >= 0
    AND "actualAmount" >= 0
  )
);

CREATE TABLE IF NOT EXISTS "PostAttachment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "entityType" "PostEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PostComment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "entityType" "PostEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "parentCommentId" TEXT REFERENCES "PostComment"(id) ON DELETE CASCADE,
  "authorId" TEXT NOT NULL,
  content TEXT NOT NULL,
  "isResolved" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PostSceneReadiness_project_scene_idx"
  ON "PostSceneReadiness" ("projectId", "sceneId");
CREATE INDEX IF NOT EXISTS "PostSceneReadiness_status_idx"
  ON "PostSceneReadiness" (status);

CREATE INDEX IF NOT EXISTS "PostDayReadiness_project_day_idx"
  ON "PostDayReadiness" ("projectId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "PostDayReadiness_status_idx"
  ON "PostDayReadiness" (status);

CREATE INDEX IF NOT EXISTS "PostDependencyAlert_project_day_idx"
  ON "PostDependencyAlert" ("projectId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "PostDependencyAlert_status_severity_idx"
  ON "PostDependencyAlert" (status, severity);

CREATE INDEX IF NOT EXISTS "PostIngestBatch_project_day_idx"
  ON "PostIngestBatch" ("projectId", "shootingDayId");
CREATE INDEX IF NOT EXISTS "PostIngestBatch_status_idx"
  ON "PostIngestBatch" (status);

CREATE INDEX IF NOT EXISTS "PostIngestItem_batch_qc_idx"
  ON "PostIngestItem" ("batchId", "qcStatus");

CREATE INDEX IF NOT EXISTS "PostIssue_project_status_idx"
  ON "PostIssue" ("projectId", status);
CREATE INDEX IF NOT EXISTS "PostIssue_batch_item_idx"
  ON "PostIssue" ("batchId", "itemId");

CREATE INDEX IF NOT EXISTS "EditVersion_project_status_idx"
  ON "EditVersion" ("projectId", status);

CREATE INDEX IF NOT EXISTS "EditReviewNote_version_status_idx"
  ON "EditReviewNote" ("versionId", status);

CREATE INDEX IF NOT EXISTS "VfxShot_project_status_idx"
  ON "VfxShot" ("projectId", status);
CREATE INDEX IF NOT EXISTS "VfxShot_dueDate_idx"
  ON "VfxShot" ("dueDate");

CREATE INDEX IF NOT EXISTS "VfxTurnover_vfxShot_idx"
  ON "VfxTurnover" ("vfxShotId");

CREATE INDEX IF NOT EXISTS "DeliveryChecklistItem_project_status_idx"
  ON "DeliveryChecklistItem" ("projectId", status);
CREATE INDEX IF NOT EXISTS "DeliveryChecklistItem_dueDate_idx"
  ON "DeliveryChecklistItem" ("dueDate");

CREATE INDEX IF NOT EXISTS "PostBudgetLink_project_source_idx"
  ON "PostBudgetLink" ("projectId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "PostAttachment_project_entity_idx"
  ON "PostAttachment" ("projectId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "PostComment_project_entity_idx"
  ON "PostComment" ("projectId", "entityType", "entityId");

DROP TRIGGER IF EXISTS update_post_scene_readiness_updated_at ON "PostSceneReadiness";
CREATE TRIGGER update_post_scene_readiness_updated_at
  BEFORE UPDATE ON "PostSceneReadiness"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_day_readiness_updated_at ON "PostDayReadiness";
CREATE TRIGGER update_post_day_readiness_updated_at
  BEFORE UPDATE ON "PostDayReadiness"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_dependency_alert_updated_at ON "PostDependencyAlert";
CREATE TRIGGER update_post_dependency_alert_updated_at
  BEFORE UPDATE ON "PostDependencyAlert"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_ingest_batch_updated_at ON "PostIngestBatch";
CREATE TRIGGER update_post_ingest_batch_updated_at
  BEFORE UPDATE ON "PostIngestBatch"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_ingest_item_updated_at ON "PostIngestItem";
CREATE TRIGGER update_post_ingest_item_updated_at
  BEFORE UPDATE ON "PostIngestItem"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_issue_updated_at ON "PostIssue";
CREATE TRIGGER update_post_issue_updated_at
  BEFORE UPDATE ON "PostIssue"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_edit_version_updated_at ON "EditVersion";
CREATE TRIGGER update_edit_version_updated_at
  BEFORE UPDATE ON "EditVersion"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_edit_review_note_updated_at ON "EditReviewNote";
CREATE TRIGGER update_edit_review_note_updated_at
  BEFORE UPDATE ON "EditReviewNote"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vfx_shot_updated_at ON "VfxShot";
CREATE TRIGGER update_vfx_shot_updated_at
  BEFORE UPDATE ON "VfxShot"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vfx_turnover_updated_at ON "VfxTurnover";
CREATE TRIGGER update_vfx_turnover_updated_at
  BEFORE UPDATE ON "VfxTurnover"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_checklist_updated_at ON "DeliveryChecklistItem";
CREATE TRIGGER update_delivery_checklist_updated_at
  BEFORE UPDATE ON "DeliveryChecklistItem"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_budget_link_updated_at ON "PostBudgetLink";
CREATE TRIGGER update_post_budget_link_updated_at
  BEFORE UPDATE ON "PostBudgetLink"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_post_comment_updated_at ON "PostComment";
CREATE TRIGGER update_post_comment_updated_at
  BEFORE UPDATE ON "PostComment"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "PostSceneReadiness" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostDayReadiness" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostDependencyAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostIngestBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostIngestItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostIssue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EditVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EditReviewNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VfxShot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VfxTurnover" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostBudgetLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_scene_readiness_select" ON "PostSceneReadiness";
CREATE POLICY "post_scene_readiness_select"
  ON "PostSceneReadiness" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_scene_readiness_manage" ON "PostSceneReadiness";
CREATE POLICY "post_scene_readiness_manage"
  ON "PostSceneReadiness" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_day_readiness_select" ON "PostDayReadiness";
CREATE POLICY "post_day_readiness_select"
  ON "PostDayReadiness" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_day_readiness_manage" ON "PostDayReadiness";
CREATE POLICY "post_day_readiness_manage"
  ON "PostDayReadiness" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_dependency_alert_select" ON "PostDependencyAlert";
CREATE POLICY "post_dependency_alert_select"
  ON "PostDependencyAlert" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_dependency_alert_manage" ON "PostDependencyAlert";
CREATE POLICY "post_dependency_alert_manage"
  ON "PostDependencyAlert" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_ingest_batch_select" ON "PostIngestBatch";
CREATE POLICY "post_ingest_batch_select"
  ON "PostIngestBatch" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_ingest_batch_manage" ON "PostIngestBatch";
CREATE POLICY "post_ingest_batch_manage"
  ON "PostIngestBatch" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_ingest_item_select" ON "PostIngestItem";
CREATE POLICY "post_ingest_item_select"
  ON "PostIngestItem" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PostIngestBatch" pb
      WHERE pb.id = "PostIngestItem"."batchId"
        AND check_project_membership(pb."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "post_ingest_item_manage" ON "PostIngestItem";
CREATE POLICY "post_ingest_item_manage"
  ON "PostIngestItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "PostIngestBatch" pb
      WHERE pb.id = "PostIngestItem"."batchId"
        AND check_post_manager(pb."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "PostIngestBatch" pb
      WHERE pb.id = "PostIngestItem"."batchId"
        AND check_post_manager(pb."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "post_issue_select" ON "PostIssue";
CREATE POLICY "post_issue_select"
  ON "PostIssue" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_issue_manage" ON "PostIssue";
CREATE POLICY "post_issue_manage"
  ON "PostIssue" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "edit_version_select" ON "EditVersion";
CREATE POLICY "edit_version_select"
  ON "EditVersion" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "edit_version_manage" ON "EditVersion";
CREATE POLICY "edit_version_manage"
  ON "EditVersion" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "edit_review_note_select" ON "EditReviewNote";
CREATE POLICY "edit_review_note_select"
  ON "EditReviewNote" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "EditVersion" ev
      WHERE ev.id = "EditReviewNote"."versionId"
        AND check_project_membership(ev."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "edit_review_note_insert" ON "EditReviewNote";
CREATE POLICY "edit_review_note_insert"
  ON "EditReviewNote" FOR INSERT
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    AND EXISTS (
      SELECT 1
      FROM "EditVersion" ev
      WHERE ev.id = "EditReviewNote"."versionId"
        AND check_project_membership(ev."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "edit_review_note_update" ON "EditReviewNote";
CREATE POLICY "edit_review_note_update"
  ON "EditReviewNote" FOR UPDATE
  USING (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "EditVersion" ev
      WHERE ev.id = "EditReviewNote"."versionId"
        AND check_post_manager(ev."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "EditVersion" ev
      WHERE ev.id = "EditReviewNote"."versionId"
        AND check_post_manager(ev."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "edit_review_note_delete" ON "EditReviewNote";
CREATE POLICY "edit_review_note_delete"
  ON "EditReviewNote" FOR DELETE
  USING (
    "authorId" = auth.uid()::TEXT
    OR EXISTS (
      SELECT 1
      FROM "EditVersion" ev
      WHERE ev.id = "EditReviewNote"."versionId"
        AND check_post_manager(ev."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "vfx_shot_select" ON "VfxShot";
CREATE POLICY "vfx_shot_select"
  ON "VfxShot" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "vfx_shot_manage" ON "VfxShot";
CREATE POLICY "vfx_shot_manage"
  ON "VfxShot" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "vfx_turnover_select" ON "VfxTurnover";
CREATE POLICY "vfx_turnover_select"
  ON "VfxTurnover" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "VfxShot" vs
      WHERE vs.id = "VfxTurnover"."vfxShotId"
        AND check_project_membership(vs."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "vfx_turnover_manage" ON "VfxTurnover";
CREATE POLICY "vfx_turnover_manage"
  ON "VfxTurnover" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "VfxShot" vs
      WHERE vs.id = "VfxTurnover"."vfxShotId"
        AND check_post_manager(vs."projectId", auth.uid()::TEXT)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "VfxShot" vs
      WHERE vs.id = "VfxTurnover"."vfxShotId"
        AND check_post_manager(vs."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "delivery_checklist_select" ON "DeliveryChecklistItem";
CREATE POLICY "delivery_checklist_select"
  ON "DeliveryChecklistItem" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "delivery_checklist_manage" ON "DeliveryChecklistItem";
CREATE POLICY "delivery_checklist_manage"
  ON "DeliveryChecklistItem" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_budget_link_select" ON "PostBudgetLink";
CREATE POLICY "post_budget_link_select"
  ON "PostBudgetLink" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_budget_link_manage" ON "PostBudgetLink";
CREATE POLICY "post_budget_link_manage"
  ON "PostBudgetLink" FOR ALL
  USING (check_post_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_post_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_attachment_select" ON "PostAttachment";
CREATE POLICY "post_attachment_select"
  ON "PostAttachment" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_attachment_insert" ON "PostAttachment";
CREATE POLICY "post_attachment_insert"
  ON "PostAttachment" FOR INSERT
  WITH CHECK (
    "uploadedBy" = auth.uid()::TEXT
    AND check_project_membership("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "post_attachment_update" ON "PostAttachment";
CREATE POLICY "post_attachment_update"
  ON "PostAttachment" FOR UPDATE
  USING (
    "uploadedBy" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  )
  WITH CHECK (
    "uploadedBy" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "post_attachment_delete" ON "PostAttachment";
CREATE POLICY "post_attachment_delete"
  ON "PostAttachment" FOR DELETE
  USING (
    "uploadedBy" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "post_comment_select" ON "PostComment";
CREATE POLICY "post_comment_select"
  ON "PostComment" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "post_comment_insert" ON "PostComment";
CREATE POLICY "post_comment_insert"
  ON "PostComment" FOR INSERT
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    AND check_project_membership("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "post_comment_update" ON "PostComment";
CREATE POLICY "post_comment_update"
  ON "PostComment" FOR UPDATE
  USING (
    "authorId" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  )
  WITH CHECK (
    "authorId" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  );

DROP POLICY IF EXISTS "post_comment_delete" ON "PostComment";
CREATE POLICY "post_comment_delete"
  ON "PostComment" FOR DELETE
  USING (
    "authorId" = auth.uid()::TEXT
    OR check_post_manager("projectId", auth.uid()::TEXT)
  );
