-- Fix infinite recursion in BudgetCategory RLS policy used during project deletion.
-- Root cause: policy queried BudgetCategory from within BudgetCategory policy evaluation.

CREATE OR REPLACE FUNCTION check_assigned_department_category_access(
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
DECLARE
  parent_assigned_user_id TEXT;
  parent_department_status "DepartmentBudgetStatus";
  parent_parent_category_id UUID;
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Top-level category assigned directly to current user.
  IF parent_category_id IS NULL THEN
    RETURN assigned_user_id = user_id
      AND department_status IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED');
  END IF;

  -- Sub-category: inherit access from the top-level parent assignment.
  SELECT bc."assignedUserId", bc."departmentStatus", bc."parentCategoryId"
    INTO parent_assigned_user_id, parent_department_status, parent_parent_category_id
  FROM "BudgetCategory" bc
  WHERE bc."id" = parent_category_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN parent_parent_category_id IS NULL
    AND parent_assigned_user_id = user_id
    AND parent_department_status IN ('NOT_STARTED', 'IN_PROGRESS', 'REVISION_REQUESTED');
END;
$$;

GRANT EXECUTE ON FUNCTION check_assigned_department_category_access(
  UUID,
  TEXT,
  "DepartmentBudgetStatus",
  TEXT
) TO authenticated;

DROP POLICY IF EXISTS "Assigned dept heads can manage own categories" ON "BudgetCategory";
CREATE POLICY "Assigned dept heads can manage own categories"
  ON "BudgetCategory" FOR ALL
  USING (
    check_assigned_department_category_access(
      "parentCategoryId",
      "assignedUserId",
      "departmentStatus",
      auth.uid()::TEXT
    )
  )
  WITH CHECK (
    check_assigned_department_category_access(
      "parentCategoryId",
      "assignedUserId",
      "departmentStatus",
      auth.uid()::TEXT
    )
  );
