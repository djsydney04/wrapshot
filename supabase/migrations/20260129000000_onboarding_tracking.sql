-- Add onboarding tracking fields to UserProfile
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMPTZ;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "tourCompletedAt" TIMESTAMPTZ;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER DEFAULT 0;

-- Add index for checking onboarding status
CREATE INDEX IF NOT EXISTS "UserProfile_onboardingCompletedAt_idx" ON "UserProfile" ("onboardingCompletedAt");
