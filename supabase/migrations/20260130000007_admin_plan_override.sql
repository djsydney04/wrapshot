-- Admin function to override a user's plan
-- This allows manually upgrading users to PRO or STUDIO without going through Stripe

-- First, make stripeCustomerId nullable for manual overrides
ALTER TABLE "Subscription" ALTER COLUMN "stripeCustomerId" DROP NOT NULL;

-- Function to set a user's plan by email
CREATE OR REPLACE FUNCTION admin_set_user_plan(
  user_email TEXT,
  new_plan plan_type,
  reason TEXT DEFAULT 'Manual admin override'
)
RETURNS JSON AS $$
DECLARE
  target_user_id TEXT;
  org_id TEXT;
  sub_id TEXT;
  result JSON;
BEGIN
  -- Find user by email
  SELECT id::TEXT INTO target_user_id
  FROM auth.users
  WHERE email = user_email;

  IF target_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found with email: ' || user_email);
  END IF;

  -- Get user's organization
  SELECT om."organizationId" INTO org_id
  FROM "OrganizationMember" om
  WHERE om."userId" = target_user_id
  LIMIT 1;

  IF org_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User has no organization');
  END IF;

  -- Check if subscription exists
  SELECT id INTO sub_id
  FROM "Subscription"
  WHERE "organizationId" = org_id;

  IF sub_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE "Subscription"
    SET
      plan = new_plan,
      status = 'ACTIVE',
      "updatedAt" = NOW()
    WHERE id = sub_id;
  ELSE
    -- Create new subscription with manual override
    INSERT INTO "Subscription" (
      "organizationId",
      "stripeCustomerId",
      plan,
      status,
      "createdAt",
      "updatedAt"
    ) VALUES (
      org_id,
      NULL,  -- No Stripe customer for manual overrides
      new_plan,
      'ACTIVE',
      NOW(),
      NOW()
    )
    RETURNING id INTO sub_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'userId', target_user_id,
    'organizationId', org_id,
    'subscriptionId', sub_id,
    'plan', new_plan,
    'reason', reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only allow service role to execute this (not regular users)
REVOKE EXECUTE ON FUNCTION admin_set_user_plan(TEXT, plan_type, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_set_user_plan(TEXT, plan_type, TEXT) FROM authenticated;
-- Service role and postgres will still have access
