-- Fix ProjectMember insert for new projects
-- Problem: When creating a project, the user can't add themselves as a member
-- because the policy requires them to already be an admin of that project.
-- Solution: Allow org admins to add members to projects in their organization.

-- Add policy for org admins to insert project members
CREATE POLICY "Org admins can add project members"
  ON "ProjectMember" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ProjectMember"."projectId"
      AND is_org_admin(p."organizationId")
    )
  );

-- Also allow org admins to manage all project members in their org (update/delete)
CREATE POLICY "Org admins can manage project members in their org"
  ON "ProjectMember" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ProjectMember"."projectId"
      AND is_org_admin(p."organizationId")
    )
  );
