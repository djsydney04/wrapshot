-- Add support for multiple crew call times on call sheets
-- This allows productions to specify different call times for different crews/units

-- Create the CallSheetCrewCall table
CREATE TABLE "CallSheetCrewCall" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "callSheetId" TEXT NOT NULL REFERENCES "CallSheet"(id) ON DELETE CASCADE,
  "crewName" TEXT NOT NULL,
  "callTime" TIME NOT NULL,
  notes TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("callSheetId", "crewName")
);

-- Create index for efficient lookups
CREATE INDEX idx_callsheet_crew_call_callsheet ON "CallSheetCrewCall"("callSheetId");

-- Add updatedAt trigger
CREATE TRIGGER update_callsheet_crew_call_updated_at
  BEFORE UPDATE ON "CallSheetCrewCall"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE "CallSheetCrewCall" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CallSheetCrewCall
CREATE POLICY "Project members can view call sheet crew calls"
  ON "CallSheetCrewCall" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      JOIN "ShootingDay" sd ON sd.id = cs."shootingDayId"
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE cs.id = "CallSheetCrewCall"."callSheetId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage call sheet crew calls"
  ON "CallSheetCrewCall" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      JOIN "ShootingDay" sd ON sd.id = cs."shootingDayId"
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE cs.id = "CallSheetCrewCall"."callSheetId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Grant access to authenticated users
GRANT ALL ON "CallSheetCrewCall" TO authenticated;
GRANT ALL ON "CallSheetCrewCall" TO service_role;
