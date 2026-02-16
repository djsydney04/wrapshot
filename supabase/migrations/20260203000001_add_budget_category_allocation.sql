-- Add allocated budget to categories for department-level caps
ALTER TABLE "BudgetCategory"
  ADD COLUMN IF NOT EXISTS "allocatedBudget" NUMERIC NOT NULL DEFAULT 0;
