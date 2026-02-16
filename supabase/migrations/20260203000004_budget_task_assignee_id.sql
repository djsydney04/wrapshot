-- Add assignee user id for budget tasks
ALTER TABLE "BudgetTask"
  ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

CREATE INDEX IF NOT EXISTS "BudgetTask_assigneeId_idx" ON "BudgetTask"("assigneeId");
