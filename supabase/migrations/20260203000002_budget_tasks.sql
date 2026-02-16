-- Budget tasks for finance tracking and assignments
CREATE TYPE budget_task_status AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

CREATE TABLE "BudgetTask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "budgetId" UUID REFERENCES "Budget"(id) ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "status" budget_task_status NOT NULL DEFAULT 'OPEN',
  "assigneeEmail" TEXT,
  "assigneeName" TEXT,
  "dueDate" DATE,
  "createdBy" UUID NOT NULL REFERENCES auth.users("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "BudgetTask_projectId_idx" ON "BudgetTask"("projectId");
CREATE INDEX "BudgetTask_budgetId_idx" ON "BudgetTask"("budgetId");
CREATE INDEX "BudgetTask_status_idx" ON "BudgetTask"("status");
CREATE INDEX "BudgetTask_dueDate_idx" ON "BudgetTask"("dueDate");

CREATE TRIGGER update_budget_task_updated_at
  BEFORE UPDATE ON "BudgetTask"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "BudgetTask" ENABLE ROW LEVEL SECURITY;

-- Budget task policies (project member access)
CREATE POLICY "Project members can view budget tasks"
  ON "BudgetTask" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project members can create budget tasks"
  ON "BudgetTask" FOR INSERT
  WITH CHECK (is_project_member("projectId"));

CREATE POLICY "Project members can update budget tasks"
  ON "BudgetTask" FOR UPDATE
  USING (is_project_member("projectId"));

CREATE POLICY "Project members can delete budget tasks"
  ON "BudgetTask" FOR DELETE
  USING (is_project_member("projectId"));
