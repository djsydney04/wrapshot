-- Debug function to help diagnose project visibility issues
-- This bypasses RLS to show what data actually exists

CREATE OR REPLACE FUNCTION debug_user_projects(user_id TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'userId', user_id,
    'orgMemberships', (
      SELECT json_agg(json_build_object(
        'organizationId', om."organizationId",
        'role', om.role
      ))
      FROM "OrganizationMember" om
      WHERE om."userId" = user_id
    ),
    'projectMemberships', (
      SELECT json_agg(json_build_object(
        'projectId', pm."projectId",
        'role', pm.role
      ))
      FROM "ProjectMember" pm
      WHERE pm."userId" = user_id
    ),
    'projectsInUserOrgs', (
      SELECT json_agg(json_build_object(
        'projectId', p.id,
        'projectName', p.name,
        'organizationId', p."organizationId"
      ))
      FROM "Project" p
      WHERE p."organizationId" IN (
        SELECT om."organizationId" FROM "OrganizationMember" om WHERE om."userId" = user_id
      )
    ),
    'projectsWithMembers', (
      SELECT json_agg(json_build_object(
        'projectId', p.id,
        'projectName', p.name,
        'memberCount', (SELECT COUNT(*) FROM "ProjectMember" pm WHERE pm."projectId" = p.id)
      ))
      FROM "Project" p
      WHERE p."organizationId" IN (
        SELECT om."organizationId" FROM "OrganizationMember" om WHERE om."userId" = user_id
      )
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_user_projects(TEXT) TO authenticated;
