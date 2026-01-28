-- User Profiles and Extended Settings Migration
-- Adds user profiles, notification preferences, and audit logs

-- ============================================
-- USER PROFILES
-- ============================================

-- User Profile (extends auth.users)
CREATE TABLE IF NOT EXISTS "UserProfile" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL UNIQUE, -- References auth.users.id
  "firstName" TEXT,
  "lastName" TEXT,
  "displayName" TEXT,
  phone TEXT,
  "jobTitle" TEXT,
  "avatarUrl" TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profile_user_id ON "UserProfile"("userId");

-- Trigger for updatedAt
CREATE TRIGGER update_user_profile_updated_at
  BEFORE UPDATE ON "UserProfile"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT NOT NULL UNIQUE, -- References auth.users.id
  "callSheetsEmail" BOOLEAN NOT NULL DEFAULT TRUE,
  "callSheetsPush" BOOLEAN NOT NULL DEFAULT TRUE,
  "callSheetsSms" BOOLEAN NOT NULL DEFAULT FALSE,
  "scheduleEmail" BOOLEAN NOT NULL DEFAULT TRUE,
  "schedulePush" BOOLEAN NOT NULL DEFAULT TRUE,
  "scheduleSms" BOOLEAN NOT NULL DEFAULT FALSE,
  "mentionsEmail" BOOLEAN NOT NULL DEFAULT TRUE,
  "mentionsPush" BOOLEAN NOT NULL DEFAULT TRUE,
  "mentionsSms" BOOLEAN NOT NULL DEFAULT FALSE,
  "assignmentsEmail" BOOLEAN NOT NULL DEFAULT TRUE,
  "assignmentsPush" BOOLEAN NOT NULL DEFAULT TRUE,
  "assignmentsSms" BOOLEAN NOT NULL DEFAULT FALSE,
  "remindersEmail" BOOLEAN NOT NULL DEFAULT FALSE,
  "remindersPush" BOOLEAN NOT NULL DEFAULT TRUE,
  "remindersSms" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_preference_user_id ON "NotificationPreference"("userId");

-- Trigger for updatedAt
CREATE TRIGGER update_notification_preference_updated_at
  BEFORE UPDATE ON "NotificationPreference"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROJECT INVITATIONS
-- ============================================

CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS "ProjectInvitation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role project_role NOT NULL DEFAULT 'VIEWER',
  department TEXT,
  "invitedBy" TEXT NOT NULL, -- References auth.users.id
  status invitation_status NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  "acceptedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", email)
);

CREATE INDEX idx_project_invitation_email ON "ProjectInvitation"(email);
CREATE INDEX idx_project_invitation_project ON "ProjectInvitation"("projectId");

-- ============================================
-- ORGANIZATION INVITATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS "OrganizationInvitation" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role NOT NULL DEFAULT 'MEMBER',
  "invitedBy" TEXT NOT NULL, -- References auth.users.id
  status invitation_status NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  "acceptedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("organizationId", email)
);

CREATE INDEX idx_org_invitation_email ON "OrganizationInvitation"(email);
CREATE INDEX idx_org_invitation_org ON "OrganizationInvitation"("organizationId");

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TYPE audit_action AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'INVITE',
  'ACCEPT_INVITE',
  'REMOVE_MEMBER',
  'CHANGE_ROLE',
  'PUBLISH',
  'ARCHIVE'
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT REFERENCES "Organization"(id) ON DELETE CASCADE,
  "projectId" TEXT REFERENCES "Project"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL, -- References auth.users.id
  action audit_action NOT NULL,
  "entityType" TEXT NOT NULL, -- e.g., 'Project', 'Scene', 'ShootingDay'
  "entityId" TEXT,
  details JSONB, -- Additional context about the action
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org ON "AuditLog"("organizationId");
CREATE INDEX idx_audit_log_project ON "AuditLog"("projectId");
CREATE INDEX idx_audit_log_user ON "AuditLog"("userId");
CREATE INDEX idx_audit_log_created ON "AuditLog"("createdAt" DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- User Profile policies
CREATE POLICY "Users can view their own profile"
  ON "UserProfile" FOR SELECT
  USING ("userId" = auth.uid()::TEXT);

CREATE POLICY "Users can update their own profile"
  ON "UserProfile" FOR UPDATE
  USING ("userId" = auth.uid()::TEXT);

CREATE POLICY "Users can insert their own profile"
  ON "UserProfile" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::TEXT);

-- Notification Preference policies
CREATE POLICY "Users can view their own notification preferences"
  ON "NotificationPreference" FOR SELECT
  USING ("userId" = auth.uid()::TEXT);

CREATE POLICY "Users can update their own notification preferences"
  ON "NotificationPreference" FOR UPDATE
  USING ("userId" = auth.uid()::TEXT);

CREATE POLICY "Users can insert their own notification preferences"
  ON "NotificationPreference" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::TEXT);

-- Project Invitation policies
CREATE POLICY "Project admins can view invitations"
  ON "ProjectInvitation" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvitation"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Project admins can create invitations"
  ON "ProjectInvitation" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvitation"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role = 'ADMIN'
    )
  );

CREATE POLICY "Project admins can update invitations"
  ON "ProjectInvitation" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvitation"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role = 'ADMIN'
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Organization Invitation policies
CREATE POLICY "Org admins can view invitations"
  ON "OrganizationInvitation" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "OrganizationInvitation"."organizationId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Org admins can create invitations"
  ON "OrganizationInvitation" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "OrganizationInvitation"."organizationId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Org admins can update invitations"
  ON "OrganizationInvitation" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "OrganizationInvitation"."organizationId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Audit Log policies
CREATE POLICY "Org members can view audit logs"
  ON "AuditLog" FOR SELECT
  USING (
    "organizationId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "AuditLog"."organizationId"
      AND "userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON "AuditLog" FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON "UserProfile" TO authenticated;
GRANT ALL ON "NotificationPreference" TO authenticated;
GRANT ALL ON "ProjectInvitation" TO authenticated;
GRANT ALL ON "OrganizationInvitation" TO authenticated;
GRANT ALL ON "AuditLog" TO authenticated;
