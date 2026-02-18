-- Department budget requests + project financial head permissions

-- Add designated financial head to each project
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "financialHeadUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_financialHeadUserId_idx"
  ON "Project" ("financialHeadUserId");

-- Helper: check if user is designated as project financial head
CREATE OR REPLACE FUNCTION check_project_financial_head(proj_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM "Project" p
    WHERE p.id = proj_id
      AND p."financialHeadUserId" = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if user can manage budget approvals/requests
CREATE OR REPLACE FUNCTION check_project_finance_manager(proj_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    check_project_role(proj_id, user_id, ARRAY['ADMIN', 'COORDINATOR'])
    OR check_project_financial_head(proj_id, user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_project_financial_head(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_project_finance_manager(TEXT, TEXT) TO authenticated;

-- Department budget request status
DO $$ BEGIN
  CREATE TYPE "DepartmentBudgetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Department-level budget increase requests
CREATE TABLE IF NOT EXISTS "DepartmentBudgetRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "budgetId" UUID NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "categoryId" UUID REFERENCES "BudgetCategory"("id") ON DELETE SET NULL,
  "department" TEXT NOT NULL,
  "requestedAmount" DECIMAL(12,2) NOT NULL CHECK ("requestedAmount" > 0),
  "reason" TEXT NOT NULL,
  "status" "DepartmentBudgetRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" UUID NOT NULL REFERENCES auth.users("id"),
  "reviewedBy" UUID REFERENCES auth.users("id"),
  "reviewedAt" TIMESTAMPTZ,
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_projectId_idx"
  ON "DepartmentBudgetRequest" ("projectId");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_budgetId_idx"
  ON "DepartmentBudgetRequest" ("budgetId");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_status_idx"
  ON "DepartmentBudgetRequest" ("status");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_requestedBy_idx"
  ON "DepartmentBudgetRequest" ("requestedBy");

DROP TRIGGER IF EXISTS update_department_budget_request_updated_at ON "DepartmentBudgetRequest";
CREATE TRIGGER update_department_budget_request_updated_at
  BEFORE UPDATE ON "DepartmentBudgetRequest"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for department requests
ALTER TABLE "DepartmentBudgetRequest" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view department budget requests" ON "DepartmentBudgetRequest";
CREATE POLICY "Project members can view department budget requests"
  ON "DepartmentBudgetRequest" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "Department heads can create budget requests" ON "DepartmentBudgetRequest";
CREATE POLICY "Department heads can create budget requests"
  ON "DepartmentBudgetRequest" FOR INSERT
  WITH CHECK (
    "requestedBy" = auth.uid()
    AND check_project_role(
      "projectId",
      auth.uid()::TEXT,
      ARRAY['ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD']
    )
  );

DROP POLICY IF EXISTS "Finance managers can review budget requests" ON "DepartmentBudgetRequest";
CREATE POLICY "Finance managers can review budget requests"
  ON "DepartmentBudgetRequest" FOR UPDATE
  USING (check_project_finance_manager("projectId", auth.uid()::TEXT))
  WITH CHECK (check_project_finance_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "Request creators can delete pending requests" ON "DepartmentBudgetRequest";
CREATE POLICY "Request creators can delete pending requests"
  ON "DepartmentBudgetRequest" FOR DELETE
  USING (
    (
      "requestedBy" = auth.uid()
      AND "status" = 'PENDING'
    )
    OR check_project_finance_manager("projectId", auth.uid()::TEXT)
  );

-- Update budget-related policies so designated financial head can manage budgets
DROP POLICY IF EXISTS "Project admins can insert budgets" ON "Budget";
CREATE POLICY "Project admins can insert budgets"
  ON "Budget" FOR INSERT
  WITH CHECK (check_project_finance_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "Project admins can update budgets" ON "Budget";
CREATE POLICY "Project admins can update budgets"
  ON "Budget" FOR UPDATE
  USING (check_project_finance_manager("projectId", auth.uid()::TEXT));

DROP POLICY IF EXISTS "Project admins can manage categories" ON "BudgetCategory";
CREATE POLICY "Project admins can manage categories"
  ON "BudgetCategory" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "BudgetCategory"."budgetId"
        AND check_project_finance_manager(b."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "Project admins can manage line items" ON "BudgetLineItem";
CREATE POLICY "Project admins can manage line items"
  ON "BudgetLineItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "BudgetCategory" bc
      JOIN "Budget" b ON b."id" = bc."budgetId"
      WHERE bc."id" = "BudgetLineItem"."categoryId"
        AND check_project_finance_manager(b."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "Project admins can manage alerts" ON "BudgetAlert";
CREATE POLICY "Project admins can manage alerts"
  ON "BudgetAlert" FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "BudgetAlert"."budgetId"
        AND check_project_finance_manager(b."projectId", auth.uid()::TEXT)
    )
  );

