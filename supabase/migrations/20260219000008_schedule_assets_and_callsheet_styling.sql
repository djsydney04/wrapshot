-- Schedule assets and call sheet styling customization

ALTER TABLE "ShootingDay"
  ADD COLUMN IF NOT EXISTS "filmScheduleTemplate" TEXT,
  ADD COLUMN IF NOT EXISTS "filmScheduleItems" JSONB;

ALTER TABLE "CallSheet"
  ADD COLUMN IF NOT EXISTS "brandDisplayName" TEXT,
  ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "headerAccentColor" TEXT DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS "headerTextColor" TEXT DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS "footerText" TEXT;
