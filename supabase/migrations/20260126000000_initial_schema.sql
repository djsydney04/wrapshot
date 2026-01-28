-- SetSync Database Schema Migration
-- Initial schema for film production scheduling platform

-- ============================================
-- ENUM TYPES
-- ============================================

-- Organization roles
CREATE TYPE org_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- Project status
CREATE TYPE project_status AS ENUM (
  'DEVELOPMENT',
  'PRE_PRODUCTION',
  'PRODUCTION',
  'POST_PRODUCTION',
  'COMPLETED',
  'ON_HOLD'
);

-- Project member roles
CREATE TYPE project_role AS ENUM (
  'ADMIN',
  'COORDINATOR',
  'DEPARTMENT_HEAD',
  'CREW',
  'CAST',
  'VIEWER'
);

-- Cast work status
CREATE TYPE cast_work_status AS ENUM (
  'ON_HOLD',
  'CONFIRMED',
  'WORKING',
  'WRAPPED',
  'DROPPED'
);

-- Availability status
CREATE TYPE availability_status AS ENUM (
  'AVAILABLE',
  'UNAVAILABLE',
  'TENTATIVE',
  'FIRST_CHOICE'
);

-- Location type
CREATE TYPE location_type AS ENUM (
  'PRACTICAL',
  'STUDIO',
  'BACKLOT',
  'VIRTUAL'
);

-- Interior/Exterior
CREATE TYPE int_ext AS ENUM ('INT', 'EXT', 'BOTH');

-- Permit status
CREATE TYPE permit_status AS ENUM (
  'NOT_STARTED',
  'APPLIED',
  'APPROVED',
  'DENIED',
  'EXPIRED'
);

-- Day/Night
CREATE TYPE day_night AS ENUM (
  'DAY',
  'NIGHT',
  'DAWN',
  'DUSK',
  'MORNING',
  'AFTERNOON',
  'EVENING'
);

-- Scene status
CREATE TYPE scene_status AS ENUM (
  'NOT_SCHEDULED',
  'SCHEDULED',
  'PARTIALLY_SHOT',
  'COMPLETED',
  'CUT'
);

-- Element category
CREATE TYPE element_category AS ENUM (
  'PROP',
  'WARDROBE',
  'VEHICLE',
  'ANIMAL',
  'SPECIAL_EQUIPMENT',
  'VFX',
  'SFX',
  'STUNT',
  'MAKEUP',
  'HAIR',
  'GREENERY',
  'ART_DEPARTMENT',
  'SOUND',
  'MUSIC',
  'BACKGROUND',
  'OTHER'
);

-- Shooting day status
CREATE TYPE shooting_day_status AS ENUM (
  'TENTATIVE',
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

-- Day work status (for cast on shooting days)
CREATE TYPE day_work_status AS ENUM (
  'W',   -- Work
  'SW',  -- Start Work
  'WF',  -- Work Finish
  'SWF', -- Start Work Finish
  'H',   -- Hold
  'R',   -- Rehearse
  'T',   -- Travel
  'WD'   -- Work Drop
);

-- ============================================
-- TABLES
-- ============================================

-- Organizations
CREATE TABLE "Organization" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members
CREATE TABLE "OrganizationMember" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL, -- References auth.users.id
  role org_role NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("organizationId", "userId")
);

CREATE INDEX idx_organization_member_user ON "OrganizationMember"("userId");

-- Projects
CREATE TABLE "Project" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'DEVELOPMENT',
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project Members
CREATE TABLE "ProjectMember" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL, -- References auth.users.id
  role project_role NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", "userId")
);

CREATE INDEX idx_project_member_user ON "ProjectMember"("userId");

-- Scripts
CREATE TABLE "Script" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  color TEXT, -- White, Blue, Pink, etc.
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "fileUrl" TEXT,
  content TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE
);

-- Cast Members
CREATE TABLE "CastMember" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "characterName" TEXT NOT NULL,
  "actorName" TEXT,
  "castNumber" INTEGER,
  "contractStart" TIMESTAMPTZ,
  "contractEnd" TIMESTAMPTZ,
  "dropDeadDate" TIMESTAMPTZ,
  "dailyRate" DECIMAL(10, 2),
  "weeklyRate" DECIMAL(10, 2),
  "workStatus" cast_work_status NOT NULL DEFAULT 'ON_HOLD',
  "unionAffiliation" TEXT,
  email TEXT,
  phone TEXT,
  "agentName" TEXT,
  "agentContact" TEXT,
  notes TEXT,
  "hairMakeupMins" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cast Availability
CREATE TABLE "CastAvailability" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "castMemberId" TEXT NOT NULL REFERENCES "CastMember"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status availability_status NOT NULL DEFAULT 'AVAILABLE',
  notes TEXT,
  UNIQUE("castMemberId", date)
);

-- Locations
CREATE TABLE "Location" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  "locationType" location_type NOT NULL DEFAULT 'PRACTICAL',
  "interiorExterior" int_ext NOT NULL DEFAULT 'BOTH',
  "permitStatus" permit_status NOT NULL DEFAULT 'NOT_STARTED',
  "permitStartDate" TIMESTAMPTZ,
  "permitEndDate" TIMESTAMPTZ,
  "locationFee" DECIMAL(10, 2),
  "contactName" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "technicalNotes" TEXT,
  "parkingNotes" TEXT,
  "loadInNotes" TEXT,
  "soundNotes" TEXT,
  "backupLocationId" TEXT REFERENCES "Location"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scenes
CREATE TABLE "Scene" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  "scriptId" TEXT REFERENCES "Script"(id),
  "sceneNumber" TEXT NOT NULL,
  synopsis TEXT,
  "intExt" int_ext NOT NULL DEFAULT 'INT',
  "dayNight" day_night NOT NULL DEFAULT 'DAY',
  "locationId" TEXT REFERENCES "Location"(id),
  "pageCount" DECIMAL(4, 3) NOT NULL DEFAULT 1,
  "scriptDay" TEXT,
  "estimatedMinutes" INTEGER,
  notes TEXT,
  status scene_status NOT NULL DEFAULT 'NOT_SCHEDULED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scene Cast Members (junction table)
CREATE TABLE "SceneCastMember" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "castMemberId" TEXT NOT NULL REFERENCES "CastMember"(id) ON DELETE CASCADE,
  UNIQUE("sceneId", "castMemberId")
);

-- Elements (Props, Wardrobe, etc.)
CREATE TABLE "Element" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  category element_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scene Elements (junction table)
CREATE TABLE "SceneElement" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "elementId" TEXT NOT NULL REFERENCES "Element"(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  UNIQUE("sceneId", "elementId")
);

-- Shooting Days
CREATE TABLE "ShootingDay" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'MAIN',
  "isShootingDay" BOOLEAN NOT NULL DEFAULT TRUE,
  "generalCall" TIME,
  "shootingCall" TIME,
  "estimatedWrap" TIME,
  "actualWrap" TIME,
  "weatherNotes" TEXT,
  notes TEXT,
  status shooting_day_status NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("projectId", date, unit)
);

-- Shooting Day Scenes (junction table)
CREATE TABLE "ShootingDayScene" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL REFERENCES "Scene"(id) ON DELETE CASCADE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "estimatedMins" INTEGER,
  notes TEXT,
  UNIQUE("shootingDayId", "sceneId")
);

-- Shooting Day Cast (junction table with work status)
CREATE TABLE "ShootingDayCast" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "shootingDayId" TEXT NOT NULL REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  "castMemberId" TEXT NOT NULL REFERENCES "CastMember"(id) ON DELETE CASCADE,
  "workStatus" day_work_status NOT NULL DEFAULT 'W',
  "pickupTime" TIME,
  "muHairCall" TIME,
  "onSetCall" TIME,
  remarks TEXT,
  UNIQUE("shootingDayId", "castMemberId")
);

-- Call Sheets
CREATE TABLE "CallSheet" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "shootingDayId" TEXT NOT NULL UNIQUE REFERENCES "ShootingDay"(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMPTZ,
  "nearestHospital" TEXT,
  "safetyNotes" TEXT,
  "parkingNotes" TEXT,
  "mealNotes" TEXT,
  "advanceNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Call Sheet Departments
CREATE TABLE "CallSheetDepartment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "callSheetId" TEXT NOT NULL REFERENCES "CallSheet"(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  "callTime" TIME NOT NULL,
  notes TEXT,
  UNIQUE("callSheetId", department)
);

-- Departments
CREATE TABLE "Department" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "projectId" TEXT NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "headName" TEXT,
  "headEmail" TEXT,
  "headPhone" TEXT,
  UNIQUE("projectId", name)
);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updatedAt
CREATE TRIGGER update_organization_updated_at
  BEFORE UPDATE ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_updated_at
  BEFORE UPDATE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cast_member_updated_at
  BEFORE UPDATE ON "CastMember"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_updated_at
  BEFORE UPDATE ON "Location"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scene_updated_at
  BEFORE UPDATE ON "Scene"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_element_updated_at
  BEFORE UPDATE ON "Element"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shooting_day_updated_at
  BEFORE UPDATE ON "ShootingDay"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_sheet_updated_at
  BEFORE UPDATE ON "CallSheet"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Script" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CastMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CastAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Scene" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SceneCastMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Element" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SceneElement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShootingDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShootingDayScene" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShootingDayCast" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallSheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallSheetDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Helper function to check organization membership
CREATE OR REPLACE FUNCTION is_org_member(org_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "OrganizationMember"
    WHERE "organizationId" = org_id
    AND "userId" = auth.uid()::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check project membership
CREATE OR REPLACE FUNCTION is_project_member(proj_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "ProjectMember"
    WHERE "projectId" = proj_id
    AND "userId" = auth.uid()::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organization policies
CREATE POLICY "Users can view organizations they belong to"
  ON "Organization" FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Org admins can update their organization"
  ON "Organization" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = id
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Users can create organizations"
  ON "Organization" FOR INSERT
  WITH CHECK (TRUE);

-- OrganizationMember policies
CREATE POLICY "Users can view members of their organizations"
  ON "OrganizationMember" FOR SELECT
  USING (is_org_member("organizationId"));

CREATE POLICY "Org admins can manage members"
  ON "OrganizationMember" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember" om
      WHERE om."organizationId" = "OrganizationMember"."organizationId"
      AND om."userId" = auth.uid()::TEXT
      AND om.role IN ('OWNER', 'ADMIN')
    )
  );

-- Project policies
CREATE POLICY "Users can view projects in their organizations"
  ON "Project" FOR SELECT
  USING (is_org_member("organizationId") OR is_project_member(id));

CREATE POLICY "Org admins can manage projects"
  ON "Project" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "OrganizationMember"
      WHERE "organizationId" = "Project"."organizationId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('OWNER', 'ADMIN')
    )
  );

-- ProjectMember policies
CREATE POLICY "Users can view project members"
  ON "ProjectMember" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project admins can manage project members"
  ON "ProjectMember" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember" pm
      WHERE pm."projectId" = "ProjectMember"."projectId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role = 'ADMIN'
    )
  );

-- Script policies
CREATE POLICY "Project members can view scripts"
  ON "Script" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project admins can manage scripts"
  ON "Script" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "Script"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- CastMember policies
CREATE POLICY "Project members can view cast"
  ON "CastMember" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project coordinators can manage cast"
  ON "CastMember" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "CastMember"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- CastAvailability policies
CREATE POLICY "Project members can view cast availability"
  ON "CastAvailability" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "CastMember" cm
      JOIN "ProjectMember" pm ON pm."projectId" = cm."projectId"
      WHERE cm.id = "CastAvailability"."castMemberId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage cast availability"
  ON "CastAvailability" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CastMember" cm
      JOIN "ProjectMember" pm ON pm."projectId" = cm."projectId"
      WHERE cm.id = "CastAvailability"."castMemberId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Location policies
CREATE POLICY "Project members can view locations"
  ON "Location" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project coordinators can manage locations"
  ON "Location" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "Location"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Scene policies
CREATE POLICY "Project members can view scenes"
  ON "Scene" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project coordinators can manage scenes"
  ON "Scene" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "Scene"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- SceneCastMember policies
CREATE POLICY "Project members can view scene cast"
  ON "SceneCastMember" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Scene" s
      JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
      WHERE s.id = "SceneCastMember"."sceneId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage scene cast"
  ON "SceneCastMember" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Scene" s
      JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
      WHERE s.id = "SceneCastMember"."sceneId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Element policies
CREATE POLICY "Project members can view elements"
  ON "Element" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project coordinators can manage elements"
  ON "Element" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "Element"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

-- SceneElement policies
CREATE POLICY "Project members can view scene elements"
  ON "SceneElement" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Scene" s
      JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
      WHERE s.id = "SceneElement"."sceneId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage scene elements"
  ON "SceneElement" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Scene" s
      JOIN "ProjectMember" pm ON pm."projectId" = s."projectId"
      WHERE s.id = "SceneElement"."sceneId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

-- ShootingDay policies
CREATE POLICY "Project members can view shooting days"
  ON "ShootingDay" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project coordinators can manage shooting days"
  ON "ShootingDay" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "ShootingDay"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- ShootingDayScene policies
CREATE POLICY "Project members can view shooting day scenes"
  ON "ShootingDayScene" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "ShootingDayScene"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage shooting day scenes"
  ON "ShootingDayScene" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "ShootingDayScene"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- ShootingDayCast policies
CREATE POLICY "Project members can view shooting day cast"
  ON "ShootingDayCast" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "ShootingDayCast"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage shooting day cast"
  ON "ShootingDayCast" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "ShootingDayCast"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- CallSheet policies
CREATE POLICY "Project members can view call sheets"
  ON "CallSheet" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "CallSheet"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage call sheets"
  ON "CallSheet" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ShootingDay" sd
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE sd.id = "CallSheet"."shootingDayId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- CallSheetDepartment policies
CREATE POLICY "Project members can view call sheet departments"
  ON "CallSheetDepartment" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      JOIN "ShootingDay" sd ON sd.id = cs."shootingDayId"
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE cs.id = "CallSheetDepartment"."callSheetId"
      AND pm."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can manage call sheet departments"
  ON "CallSheetDepartment" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CallSheet" cs
      JOIN "ShootingDay" sd ON sd.id = cs."shootingDayId"
      JOIN "ProjectMember" pm ON pm."projectId" = sd."projectId"
      WHERE cs.id = "CallSheetDepartment"."callSheetId"
      AND pm."userId" = auth.uid()::TEXT
      AND pm.role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Department policies
CREATE POLICY "Project members can view departments"
  ON "Department" FOR SELECT
  USING (is_project_member("projectId"));

CREATE POLICY "Project admins can manage departments"
  ON "Department" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = "Department"."projectId"
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- ============================================
-- GRANTS
-- ============================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant access to service role (for server-side operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
