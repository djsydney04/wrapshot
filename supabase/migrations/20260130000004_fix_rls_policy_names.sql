-- Fix RLS policy names - the previous migration had incorrect policy names

-- Drop the problematic OrganizationMember policy (correct name)
DROP POLICY IF EXISTS "Org admins can manage members" ON "OrganizationMember";

-- Drop the policy the previous migration created (in case it exists)
DROP POLICY IF EXISTS "Org admins can manage org members" ON "OrganizationMember";

-- Create the fixed policy using SECURITY DEFINER function
CREATE POLICY "Org admins can manage members"
  ON "OrganizationMember" FOR ALL
  USING (is_org_admin("organizationId"));

-- Do the same for ProjectMember
DROP POLICY IF EXISTS "Project admins can manage project members" ON "ProjectMember";

-- Recreate with SECURITY DEFINER function
CREATE POLICY "Project admins can manage project members"
  ON "ProjectMember" FOR ALL
  USING (is_project_admin("projectId"));
