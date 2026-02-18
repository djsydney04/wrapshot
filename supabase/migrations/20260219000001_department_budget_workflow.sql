-- Per-department budget workflow: department heads build & submit, financial head reviews

-- Department-level approval status
DO $$ BEGIN
  CREATE TYPE "DepartmentBudgetStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'SUBMITTED',
    'REVISION_REQUESTED',
    'APPROVED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add workflow columns to BudgetCategory (meaningful on top-level categories only)
ALTER TABLE "BudgetCategory"
  ADD COLUMN IF NOT EXISTS "departmentStatus" "DepartmentBudgetStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "submittedBy" UUID,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewedBy" UUID;

CREATE INDEX IF NOT EXISTS "BudgetCategory_assignedUserId_idx"
  ON "BudgetCategory" ("assignedUserId")
  WHERE "assignedUserId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "BudgetCategory_departmentStatus_idx"
  ON "BudgetCategory" ("departmentStatus")
  WHERE "parentCategoryId" IS NULL;

-- RLS: Assigned department heads can manage categories in their department
-- (only when department is in an editable status)
DROP POLICY IF EXISTS "Assigned dept heads can manage own categories" ON "BudgetCategory";
CREATE POLICY "Assigned dept heads can manage own categories"
  ON "BudgetCategory" FOR ALL
  USING (
    -- Top-level category assigned to this user
    (
      "parentCategoryId" IS NULL
      AND "assignedUserId" = auth.uid()::TEXT
      AND "departmentStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED')
    )
    OR
    -- Sub-category whose parent is assigned to this user
    EXISTS (
      SELECT 1 FROM "BudgetCategory" parent
      WHERE parent."id" = "BudgetCategory"."parentCategoryId"
        AND parent."parentCategoryId" IS NULL
        AND parent."assignedUserId" = auth.uid()::TEXT
        AND parent."departmentStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED')
    )
  );

-- RLS: Assigned department heads can manage line items in their categories
DROP POLICY IF EXISTS "Assigned dept heads can manage own line items" ON "BudgetLineItem";
CREATE POLICY "Assigned dept heads can manage own line items"
  ON "BudgetLineItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "BudgetCategory" cat
      LEFT JOIN "BudgetCategory" parent ON parent."id" = cat."parentCategoryId"
      WHERE cat."id" = "BudgetLineItem"."categoryId"
        AND (
          -- Line item in a top-level category assigned to this user
          (cat."parentCategoryId" IS NULL
           AND cat."assignedUserId" = auth.uid()::TEXT
           AND cat."departmentStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED'))
          OR
          -- Line item in a sub-category whose parent is assigned to this user
          (parent."parentCategoryId" IS NULL
           AND parent."assignedUserId" = auth.uid()::TEXT
           AND parent."departmentStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED'))
        )
    )
  );
