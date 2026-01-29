-- Fix project_role enum comparison with TEXT[]
-- The check_project_role function was comparing project_role enum with TEXT array
-- which PostgreSQL cannot do without explicit casting

CREATE OR REPLACE FUNCTION check_project_role(proj_id TEXT, user_id TEXT, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "ProjectMember"
    WHERE "projectId" = proj_id
    AND "userId" = user_id
    AND "role"::TEXT = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix get_user_project_role to return TEXT for consistency
CREATE OR REPLACE FUNCTION get_user_project_role(proj_id TEXT, user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT "role"::TEXT INTO v_role
  FROM "ProjectMember"
  WHERE "projectId" = proj_id AND "userId" = user_id;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
