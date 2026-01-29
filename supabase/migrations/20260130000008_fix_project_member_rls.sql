-- Comprehensive fix for ProjectMember RLS issues
-- The root problem: policies check ProjectMember, but ProjectMember has its own RLS policies
-- Solution: Use SECURITY DEFINER functions that bypass RLS for membership checks

-- ============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================

-- Check if user is a member of a project (any role) - bypasses RLS
CREATE OR REPLACE FUNCTION check_project_membership(proj_id TEXT, user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "ProjectMember"
    WHERE "projectId" = proj_id
    AND "userId" = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a member with specific roles - bypasses RLS
CREATE OR REPLACE FUNCTION check_project_role(proj_id TEXT, user_id TEXT, allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "ProjectMember"
    WHERE "projectId" = proj_id
    AND "userId" = user_id
    AND role = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in a project - bypasses RLS
CREATE OR REPLACE FUNCTION get_user_project_role(proj_id TEXT, user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM "ProjectMember"
  WHERE "projectId" = proj_id
  AND "userId" = user_id;

  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_project_membership(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_project_role(TEXT, TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_role(TEXT, TEXT) TO authenticated;

-- ============================================
-- FIX PROJECTMEMBER POLICIES
-- ============================================

-- Drop all existing ProjectMember policies
DROP POLICY IF EXISTS "Users can view project members" ON "ProjectMember";
DROP POLICY IF EXISTS "Project admins can manage project members" ON "ProjectMember";
DROP POLICY IF EXISTS "Org admins can add project members" ON "ProjectMember";
DROP POLICY IF EXISTS "Org admins can manage project members in their org" ON "ProjectMember";

-- New SELECT policy: Users can see members of projects they belong to
CREATE POLICY "Users can view project members"
  ON "ProjectMember" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

-- New INSERT policy: Project admins OR org admins can add members
CREATE POLICY "Admins can add project members"
  ON "ProjectMember" FOR INSERT
  WITH CHECK (
    -- Project admin
    check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN'])
    OR
    -- Org admin (for the project's org)
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ProjectMember"."projectId"
      AND is_org_admin(p."organizationId")
    )
  );

-- New UPDATE policy: Project admins can update member roles
CREATE POLICY "Project admins can update members"
  ON "ProjectMember" FOR UPDATE
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN']));

-- New DELETE policy: Project admins can remove members
CREATE POLICY "Project admins can remove members"
  ON "ProjectMember" FOR DELETE
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN']));

-- ============================================
-- FIX PROJECT POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view projects" ON "Project";
DROP POLICY IF EXISTS "Users can view projects they belong to" ON "Project";
DROP POLICY IF EXISTS "Org admins can manage projects" ON "Project";

-- SELECT: Org members or project members can view
CREATE POLICY "Users can view projects"
  ON "Project" FOR SELECT
  USING (
    is_org_member("organizationId")
    OR check_project_membership(id, auth.uid()::TEXT)
  );

-- INSERT/UPDATE/DELETE: Org admins only
CREATE POLICY "Org admins can manage projects"
  ON "Project" FOR ALL
  USING (is_org_admin("organizationId"));

-- ============================================
-- FIX BUDGET POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view budgets for their projects" ON "Budget";
DROP POLICY IF EXISTS "Project admins can insert budgets" ON "Budget";
DROP POLICY IF EXISTS "Project admins can update budgets" ON "Budget";
DROP POLICY IF EXISTS "Project admins can delete budgets" ON "Budget";

CREATE POLICY "Project members can view budgets"
  ON "Budget" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can insert budgets"
  ON "Budget" FOR INSERT
  WITH CHECK (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

CREATE POLICY "Project admins can update budgets"
  ON "Budget" FOR UPDATE
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

CREATE POLICY "Project admins can delete budgets"
  ON "Budget" FOR DELETE
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN']));

-- ============================================
-- FIX SCENE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view scenes" ON "Scene";
DROP POLICY IF EXISTS "Project admins can manage scenes" ON "Scene";

CREATE POLICY "Project members can view scenes"
  ON "Scene" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can manage scenes"
  ON "Scene" FOR ALL
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

-- ============================================
-- FIX CAST MEMBER POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view cast" ON "CastMember";
DROP POLICY IF EXISTS "Project admins can manage cast" ON "CastMember";

CREATE POLICY "Project members can view cast"
  ON "CastMember" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can manage cast"
  ON "CastMember" FOR ALL
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

-- ============================================
-- FIX LOCATION POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view locations" ON "Location";
DROP POLICY IF EXISTS "Project admins can manage locations" ON "Location";

CREATE POLICY "Project members can view locations"
  ON "Location" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can manage locations"
  ON "Location" FOR ALL
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

-- ============================================
-- FIX SHOOTING DAY POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view shooting days" ON "ShootingDay";
DROP POLICY IF EXISTS "Project admins can manage shooting days" ON "ShootingDay";

CREATE POLICY "Project members can view shooting days"
  ON "ShootingDay" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can manage shooting days"
  ON "ShootingDay" FOR ALL
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR']));

-- ============================================
-- FIX ELEMENT (GEAR/PROPS) POLICIES
-- ============================================

DROP POLICY IF EXISTS "Project members can view elements" ON "Element";
DROP POLICY IF EXISTS "Project admins can manage elements" ON "Element";

CREATE POLICY "Project members can view elements"
  ON "Element" FOR SELECT
  USING (check_project_membership("projectId", auth.uid()::TEXT));

CREATE POLICY "Project admins can manage elements"
  ON "Element" FOR ALL
  USING (check_project_role("projectId", auth.uid()::TEXT, ARRAY['ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD']));
