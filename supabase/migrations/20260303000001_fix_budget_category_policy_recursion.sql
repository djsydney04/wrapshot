-- Fix BudgetCategory RLS recursion by removing self-referential policy query
-- The previous "Assigned dept heads can manage own categories" policy queried
-- BudgetCategory inside its own predicate, which can trigger:
-- infinite recursion detected in policy for relation "BudgetCategory"

CREATE OR REPLACE FUNCTION can_manage_department_budget_category(
  parent_category_id UUID,
  assigned_user_id TEXT,
  department_status "DepartmentBudgetStatus",
  user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Top-level category: direct assignee can manage while editable.
  IF parent_category_id IS NULL THEN
    RETURN (
      assigned_user_id = user_id
      AND department_status IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED')
    );
  END IF;

  -- Sub-category: inherit permissions from editable top-level parent.
  RETURN EXISTS (
    SELECT 1
    FROM "BudgetCategory" parent
    WHERE parent."id" = parent_category_id
      AND parent."parentCategoryId" IS NULL
      AND parent."assignedUserId" = user_id
      AND parent."departmentStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED')
  );
END;
$$;

GRANT EXECUTE
  ON FUNCTION can_manage_department_budget_category(UUID, TEXT, "DepartmentBudgetStatus", TEXT)
  TO authenticated;

DROP POLICY IF EXISTS "Assigned dept heads can manage own categories" ON "BudgetCategory";
CREATE POLICY "Assigned dept heads can manage own categories"
  ON "BudgetCategory" FOR ALL
  USING (
    can_manage_department_budget_category(
      "parentCategoryId",
      "assignedUserId",
      "departmentStatus",
      auth.uid()::TEXT
    )
  )
  WITH CHECK (
    can_manage_department_budget_category(
      "parentCategoryId",
      "assignedUserId",
      "departmentStatus",
      auth.uid()::TEXT
    )
  );
