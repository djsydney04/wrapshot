-- Migration: Plan Tiers Configuration
-- Centralizes all plan tier configuration in a single table for easy management

-- ============================================
-- PLAN TIERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "PlanTier" (
  id TEXT PRIMARY KEY,  -- 'FREE', 'PRO', 'STUDIO'
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing (in cents for precision)
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
  "yearlyPriceCents" INTEGER NOT NULL DEFAULT 0,

  -- Limits (-1 means unlimited)
  "maxProjects" INTEGER NOT NULL DEFAULT 1,
  "maxTeamMembersPerProject" INTEGER NOT NULL DEFAULT 3,
  "historyRetentionDays" INTEGER NOT NULL DEFAULT 7,

  -- Feature flags
  "hasCallSheetGeneration" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasPrioritySupport" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasCustomIntegrations" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasApiAccess" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasAdvancedScheduling" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasAiFeatures" BOOLEAN NOT NULL DEFAULT FALSE,

  -- Stripe Price IDs (can be null for FREE tier)
  "stripeMonthlyPriceId" TEXT,
  "stripeYearlyPriceId" TEXT,

  -- Display order
  "displayOrder" INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INSERT DEFAULT TIERS
-- ============================================

INSERT INTO "PlanTier" (
  id, name, description,
  "monthlyPriceCents", "yearlyPriceCents",
  "maxProjects", "maxTeamMembersPerProject", "historyRetentionDays",
  "hasCallSheetGeneration", "hasPrioritySupport", "hasCustomIntegrations",
  "hasApiAccess", "hasAdvancedScheduling", "hasAiFeatures",
  "displayOrder"
) VALUES
(
  'FREE', 'Free', 'For individuals getting started',
  0, 0,
  1, 5, 7,
  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
  1
),
(
  'PRO', 'Pro', 'For professionals on multiple productions',
  2900, 29000,  -- $29/mo, $290/yr (save ~17%)
  -1, 25, 30,  -- -1 = unlimited projects
  TRUE, FALSE, FALSE, FALSE, TRUE, TRUE,
  2
),
(
  'STUDIO', 'Studio', 'For power users and studios',
  9900, 99000,  -- $99/mo, $990/yr (save ~17%)
  -1, -1, -1,  -- -1 = unlimited everything
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
  3
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "monthlyPriceCents" = EXCLUDED."monthlyPriceCents",
  "yearlyPriceCents" = EXCLUDED."yearlyPriceCents",
  "maxProjects" = EXCLUDED."maxProjects",
  "maxTeamMembersPerProject" = EXCLUDED."maxTeamMembersPerProject",
  "historyRetentionDays" = EXCLUDED."historyRetentionDays",
  "hasCallSheetGeneration" = EXCLUDED."hasCallSheetGeneration",
  "hasPrioritySupport" = EXCLUDED."hasPrioritySupport",
  "hasCustomIntegrations" = EXCLUDED."hasCustomIntegrations",
  "hasApiAccess" = EXCLUDED."hasApiAccess",
  "hasAdvancedScheduling" = EXCLUDED."hasAdvancedScheduling",
  "hasAiFeatures" = EXCLUDED."hasAiFeatures",
  "displayOrder" = EXCLUDED."displayOrder",
  "updatedAt" = NOW();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

-- Drop first so reruns and remote pushes stay idempotent
DROP TRIGGER IF EXISTS update_plan_tier_updated_at ON "PlanTier";

CREATE TRIGGER update_plan_tier_updated_at
  BEFORE UPDATE ON "PlanTier"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get plan tier limits
CREATE OR REPLACE FUNCTION get_plan_tier(plan plan_type)
RETURNS "PlanTier" AS $$
  SELECT * FROM "PlanTier" WHERE id = plan::TEXT;
$$ LANGUAGE SQL STABLE;

-- Function to check if user can join another project (updated to use PlanTier table)
CREATE OR REPLACE FUNCTION check_user_plan_limit(user_id UUID, limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_plan plan_type;
  current_count INTEGER;
  max_allowed INTEGER;
  tier_record RECORD;
BEGIN
  -- Get current plan
  current_plan := get_user_plan(user_id);

  -- Get tier configuration
  SELECT * INTO tier_record FROM "PlanTier" WHERE id = current_plan::TEXT;

  -- If no tier found, deny access
  IF tier_record IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE limit_type
    WHEN 'projects' THEN
      -- Count how many projects this user is a member of
      SELECT COUNT(*) INTO current_count
      FROM "ProjectMember"
      WHERE "userId" = user_id::TEXT;

      max_allowed := tier_record."maxProjects";

    WHEN 'team_members' THEN
      -- This would need project context, return true for now
      RETURN TRUE;

    ELSE
      RETURN TRUE;
  END CASE;

  -- -1 means unlimited
  IF max_allowed = -1 THEN
    RETURN TRUE;
  END IF;

  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has a specific feature
CREATE OR REPLACE FUNCTION user_has_feature(user_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  current_plan plan_type;
  tier_record RECORD;
BEGIN
  current_plan := get_user_plan(user_id);

  SELECT * INTO tier_record FROM "PlanTier" WHERE id = current_plan::TEXT;

  IF tier_record IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE feature_name
    WHEN 'call_sheet_generation' THEN RETURN tier_record."hasCallSheetGeneration";
    WHEN 'priority_support' THEN RETURN tier_record."hasPrioritySupport";
    WHEN 'custom_integrations' THEN RETURN tier_record."hasCustomIntegrations";
    WHEN 'api_access' THEN RETURN tier_record."hasApiAccess";
    WHEN 'advanced_scheduling' THEN RETURN tier_record."hasAdvancedScheduling";
    WHEN 'ai_features' THEN RETURN tier_record."hasAiFeatures";
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE "PlanTier" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to keep migration idempotent
DROP POLICY IF EXISTS "Anyone can view plan tiers" ON "PlanTier";
DROP POLICY IF EXISTS "Only service role can modify tiers" ON "PlanTier";

-- Everyone can read plan tiers (public info)
CREATE POLICY "Anyone can view plan tiers"
  ON "PlanTier" FOR SELECT
  USING (TRUE);

-- Only service role can modify tiers
CREATE POLICY "Only service role can modify tiers"
  ON "PlanTier" FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- GRANTS
-- ============================================

GRANT SELECT ON "PlanTier" TO authenticated;
GRANT SELECT ON "PlanTier" TO anon;
GRANT EXECUTE ON FUNCTION get_plan_tier(plan_type) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_feature(UUID, TEXT) TO authenticated;
