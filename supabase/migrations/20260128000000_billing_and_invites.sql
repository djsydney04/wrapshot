-- Billing and Project Invites Migration
-- Adds subscription/billing tables and project invite system

-- ============================================
-- ENUM TYPES
-- ============================================

-- Subscription status
CREATE TYPE subscription_status AS ENUM (
  'TRIALING',
  'ACTIVE',
  'CANCELED',
  'PAST_DUE',
  'UNPAID'
);

-- Plan type
CREATE TYPE plan_type AS ENUM (
  'FREE',
  'PRO',
  'STUDIO'
);

-- ============================================
-- TABLES
-- ============================================

-- Subscriptions (linked to organizations)
CREATE TABLE "Subscription" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT NOT NULL UNIQUE REFERENCES "Organization"(id) ON DELETE CASCADE,
  "stripeCustomerId" TEXT NOT NULL UNIQUE,
  "stripeSubscriptionId" TEXT UNIQUE,
  "stripePriceId" TEXT,
  "stripeCurrentPeriodEnd" TIMESTAMPTZ,
  status subscription_status NOT NULL DEFAULT 'TRIALING',
  plan plan_type NOT NULL DEFAULT 'FREE',
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "trialEndsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Invites
CREATE TABLE "ProjectInvite" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role project_role NOT NULL DEFAULT 'VIEWER',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdBy" TEXT NOT NULL,
  UNIQUE("projectId", email)
);

CREATE INDEX idx_project_invite_token ON "ProjectInvite"(token);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER update_subscription_updated_at
  BEFORE UPDATE ON "Subscription"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectInvite" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Subscription policies
CREATE POLICY "Org members can view their subscription"
  ON "Subscription" FOR SELECT
  USING (is_org_member("organizationId"));

CREATE POLICY "Org admins can manage subscription"
  ON "Subscription" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "Subscription"."organizationId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
  );

-- ProjectInvite policies
CREATE POLICY "Project admins can view invites"
  ON "ProjectInvite" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvite"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project admins can create invites"
  ON "ProjectInvite" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvite"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project admins can delete invites"
  ON "ProjectInvite" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ProjectInvite"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Public access to accept invites (by token)
CREATE POLICY "Anyone can view invite by token"
  ON "ProjectInvite" FOR SELECT
  USING (TRUE);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check subscription plan limits
CREATE OR REPLACE FUNCTION check_plan_limit(org_id TEXT, limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_plan plan_type;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current plan
  SELECT plan INTO current_plan FROM "Subscription" WHERE "organizationId" = org_id;

  -- If no subscription, assume FREE
  IF current_plan IS NULL THEN
    current_plan := 'FREE';
  END IF;

  -- Define limits based on plan
  CASE limit_type
    WHEN 'projects' THEN
      SELECT COUNT(*) INTO current_count FROM "Project" WHERE "organizationId" = org_id;
      max_allowed := CASE current_plan
        WHEN 'FREE' THEN 1
        WHEN 'PRO' THEN 999999  -- Unlimited
        WHEN 'STUDIO' THEN 999999  -- Unlimited
      END;
    WHEN 'team_members' THEN
      SELECT COUNT(*) INTO current_count FROM "OrganizationMember" WHERE "organizationId" = org_id;
      max_allowed := CASE current_plan
        WHEN 'FREE' THEN 3
        WHEN 'PRO' THEN 25
        WHEN 'STUDIO' THEN 999999  -- Unlimited
      END;
    ELSE
      RETURN TRUE;
  END CASE;

  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get organization's active plan
CREATE OR REPLACE FUNCTION get_org_plan(org_id TEXT)
RETURNS plan_type AS $$
DECLARE
  sub_plan plan_type;
  sub_status subscription_status;
  trial_end TIMESTAMPTZ;
BEGIN
  SELECT plan, status, "trialEndsAt"
  INTO sub_plan, sub_status, trial_end
  FROM "Subscription"
  WHERE "organizationId" = org_id;

  -- No subscription = FREE
  IF sub_plan IS NULL THEN
    RETURN 'FREE';
  END IF;

  -- Check if trial has expired
  IF sub_status = 'TRIALING' AND trial_end < NOW() THEN
    RETURN 'FREE';
  END IF;

  -- Active subscription
  IF sub_status IN ('ACTIVE', 'TRIALING') THEN
    RETURN sub_plan;
  END IF;

  -- Canceled/unpaid = FREE
  RETURN 'FREE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON "Subscription" TO authenticated;
GRANT ALL ON "ProjectInvite" TO authenticated;
