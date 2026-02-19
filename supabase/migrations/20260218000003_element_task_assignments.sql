-- Add actionable task metadata to elements

DO $$ BEGIN
  CREATE TYPE "ElementTaskType" AS ENUM (
    'FIND',
    'PICK_UP',
    'SOURCE',
    'PREP',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Element"
  ADD COLUMN IF NOT EXISTS "taskType" "ElementTaskType",
  ADD COLUMN IF NOT EXISTS "assignedToCrewId" TEXT REFERENCES "CrewMember"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Element_taskType_idx" ON "Element"("taskType");
CREATE INDEX IF NOT EXISTS "Element_assignedToCrewId_idx" ON "Element"("assignedToCrewId");
