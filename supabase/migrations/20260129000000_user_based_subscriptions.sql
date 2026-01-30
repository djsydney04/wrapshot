-- Migration: User-Based Subscriptions
-- Changes subscription model from organization-based to user-based
-- Users now have individual subscriptions that control how many projects they can join

-- ============================================
-- SCHEMA CHANGES
-- ============================================

-- Add userId column to Subscription table
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop the organizationId requirement (make it nullable for backwards compat)
ALTER TABLE "Subscription" ALTER COLUMN "organizationId" DROP NOT NULL;

-- Add unique constraint on userId
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_key";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_key" UNIQUE ("userId");

-- Create index for faster userId lookups
CREATE INDEX IF NOT EXISTS idx_subscription_user_id ON "Subscription"("userId");

-- ============================================
-- UPDATE RLS POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS "Org members can view their subscription" ON "Subscription";
DROP POLICY IF EXISTS "Org admins can manage subscription" ON "Subscription";

-- New policies: Users can manage their own subscriptions
CREATE POLICY "Users can view their own subscription"
  ON "Subscription" FOR SELECT
  USING ("userId" = auth.uid()::TEXT);

CREATE POLICY "Users can manage their own subscription"
  ON "Subscription" FOR ALL
  USING ("userId" = auth.uid()::TEXT);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's plan (replaces org-based function)
CREATE OR REPLACE FUNCTION get_user_plan(user_id TEXT)
RETURNS plan_type AS $$
DECLARE
  sub_plan plan_type;
  sub_status subscription_status;
  trial_end TIMESTAMPTZ;
BEGIN
  SELECT plan, status, "trialEndsAt"
  INTO sub_plan, sub_status, trial_end
  FROM "Subscription"
  WHERE "userId" = user_id;

  -- No subscription = FREE
  IF sub_plan IS NULL THEN
    RETURN 'FREE';
  END IF;

  -- Check if trial has expired
  IF sub_status = 'TRIALING' AND trial_end IS NOT NULL AND trial_end < NOW() THEN
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

-- Function to check user's plan limits
-- This version checks user's PROJECT MEMBERSHIP count (how many projects they're part of)
CREATE OR REPLACE FUNCTION check_user_plan_limit(user_id TEXT, limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_plan plan_type;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current plan
  current_plan := get_user_plan(user_id);

  -- Define limits based on plan and limit type
  CASE limit_type
    WHEN 'projects' THEN
      -- Count how many projects this user is a member of
      SELECT COUNT(*) INTO current_count
      FROM "ProjectMember"
      WHERE "userId" = user_id;

      max_allowed := CASE current_plan
        WHEN 'FREE' THEN 1      -- Free users can be on 1 project
        WHEN 'PRO' THEN 999999  -- Unlimited projects
        WHEN 'STUDIO' THEN 999999  -- Unlimited projects
      END;
    ELSE
      RETURN TRUE;
  END CASE;

  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create user subscription
CREATE OR REPLACE FUNCTION get_or_create_user_subscription(user_id TEXT)
RETURNS TABLE (
  id TEXT,
  "userId" TEXT,
  plan plan_type,
  status subscription_status,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT
) AS $$
DECLARE
  sub_id TEXT;
BEGIN
  -- Try to get existing subscription
  SELECT s.id INTO sub_id
  FROM "Subscription" s
  WHERE s."userId" = user_id;

  -- If no subscription exists, create one
  IF sub_id IS NULL THEN
    INSERT INTO "Subscription" ("userId", plan, status)
    VALUES (user_id, 'FREE', 'ACTIVE')
    RETURNING "Subscription".id INTO sub_id;
  END IF;

  -- Return the subscription
  RETURN QUERY
  SELECT s.id, s."userId", s.plan, s.status, s."stripeCustomerId", s."stripeSubscriptionId"
  FROM "Subscription" s
  WHERE s.id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATE EXISTING DATA (if any)
-- ============================================

-- For existing org-based subscriptions, migrate them to the org owner's user
-- This creates user subscriptions for org owners who had org subscriptions
INSERT INTO "Subscription" ("userId", plan, status, "stripeCustomerId", "stripeSubscriptionId", "stripePriceId", "stripeCurrentPeriodEnd", "cancelAtPeriodEnd", "trialEndsAt")
SELECT
  om."userId",
  s.plan,
  s.status,
  s."stripeCustomerId",
  s."stripeSubscriptionId",
  s."stripePriceId",
  s."stripeCurrentPeriodEnd",
  s."cancelAtPeriodEnd",
  s."trialEndsAt"
FROM "Subscription" s
JOIN "OrganizationMember" om ON om."organizationId" = s."organizationId" AND om.role = 'OWNER'
WHERE s."userId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Subscription" existing WHERE existing."userId" = om."userId"
  )
ON CONFLICT ("userId") DO NOTHING;

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION get_user_plan(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_plan_limit(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_subscription(TEXT) TO authenticated;
