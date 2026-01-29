-- Add onboarding-specific fields to UserProfile
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "productionType" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;

-- Track invites sent during onboarding (before user has a project)
CREATE TABLE IF NOT EXISTS "OnboardingInvite" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "invitedBy" TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "acceptedAt" TIMESTAMPTZ,
  UNIQUE("invitedBy", email)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_invite_email ON "OnboardingInvite"(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_invite_invited_by ON "OnboardingInvite"("invitedBy");

-- RLS for OnboardingInvite
ALTER TABLE "OnboardingInvite" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding invites"
  ON "OnboardingInvite" FOR SELECT
  USING ("invitedBy" = auth.uid()::TEXT);

CREATE POLICY "Users can create onboarding invites"
  ON "OnboardingInvite" FOR INSERT
  WITH CHECK ("invitedBy" = auth.uid()::TEXT);

CREATE POLICY "Users can update their own onboarding invites"
  ON "OnboardingInvite" FOR UPDATE
  USING ("invitedBy" = auth.uid()::TEXT);

GRANT ALL ON "OnboardingInvite" TO authenticated;
