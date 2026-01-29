-- Fix all RLS infinite recursion issues and add helper functions
-- This migration fixes OrganizationMember and ProjectMember policies

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Function to check if user is an org admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_org_admin(org_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = org_id
    AND "userId" = auth.uid()::TEXT
    AND role IN ('OWNER', 'ADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a project admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_project_admin(proj_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "ProjectMember"
    WHERE "projectId" = proj_id
    AND "userId" = auth.uid()::TEXT
    AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create a user's personal organization
CREATE OR REPLACE FUNCTION get_or_create_user_organization(user_id TEXT)
RETURNS TEXT AS $$
DECLARE
  org_id TEXT;
  user_email TEXT;
  org_name TEXT;
  org_slug TEXT;
BEGIN
  -- First, try to find an existing organization where user is a member
  SELECT om."organizationId" INTO org_id
  FROM "OrganizationMember" om
  WHERE om."userId" = user_id
  LIMIT 1;

  -- If user has an organization, return it
  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  -- Get user's email for creating org name
  SELECT email INTO user_email FROM auth.users WHERE id::TEXT = user_id;

  -- Create a personal organization for the user
  org_name := COALESCE(SPLIT_PART(user_email, '@', 1), 'My') || '''s Workspace';
  org_slug := LOWER(REPLACE(REPLACE(gen_random_uuid()::TEXT, '-', ''), '_', ''));

  INSERT INTO "Organization" (id, name, slug)
  VALUES (gen_random_uuid()::TEXT, org_name, org_slug)
  RETURNING id INTO org_id;

  -- Add user as owner of their organization
  INSERT INTO "OrganizationMember" ("organizationId", "userId", role)
  VALUES (org_id, user_id, 'OWNER');

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check plan limit by user ID
CREATE OR REPLACE FUNCTION check_plan_limit_user(user_id TEXT, limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  org_id TEXT;
BEGIN
  -- Get user's organization (don't create if doesn't exist for checking)
  SELECT om."organizationId" INTO org_id
  FROM "OrganizationMember" om
  WHERE om."userId" = user_id
  LIMIT 1;

  -- If no organization, allow the operation (first-time users)
  IF org_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Delegate to existing check_plan_limit function
  RETURN check_plan_limit(org_id, limit_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX PROBLEMATIC POLICIES
-- ============================================

-- Drop the problematic OrganizationMember policy that causes infinite recursion
DROP POLICY IF EXISTS "Org admins can manage org members" ON "OrganizationMember";

-- Recreate with SECURITY DEFINER function
CREATE POLICY "Org admins can manage org members"
  ON "OrganizationMember" FOR ALL
  USING (is_org_admin("organizationId"));

-- Drop the problematic ProjectMember policy that causes infinite recursion
DROP POLICY IF EXISTS "Project admins can manage project members" ON "ProjectMember";

-- Recreate with SECURITY DEFINER function
CREATE POLICY "Project admins can manage project members"
  ON "ProjectMember" FOR ALL
  USING (is_project_admin("projectId"));

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION is_org_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_project_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_organization(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_plan_limit_user(TEXT, TEXT) TO authenticated;
