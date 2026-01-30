-- Migration: Add CrewMember table, CastCrewInvite table, and userId to CastMember
-- This enables soft-linking cast/crew to platform user accounts

-- Add userId to CastMember for optional user account linking
ALTER TABLE "CastMember" ADD COLUMN IF NOT EXISTS "userId" TEXT;
CREATE INDEX IF NOT EXISTS "CastMember_userId_idx" ON "CastMember"("userId");

-- Create DepartmentType enum
DO $$ BEGIN
    CREATE TYPE "DepartmentType" AS ENUM (
        'PRODUCTION',
        'DIRECTION',
        'CAMERA',
        'SOUND',
        'LIGHTING',
        'ART',
        'COSTUME',
        'HAIR_MAKEUP',
        'LOCATIONS',
        'STUNTS',
        'VFX',
        'TRANSPORTATION',
        'CATERING',
        'ACCOUNTING',
        'POST_PRODUCTION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CrewMember table
CREATE TABLE IF NOT EXISTS "CrewMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "profilePhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- Create indexes for CrewMember
CREATE INDEX IF NOT EXISTS "CrewMember_projectId_idx" ON "CrewMember"("projectId");
CREATE INDEX IF NOT EXISTS "CrewMember_userId_idx" ON "CrewMember"("userId");

-- Add foreign key for CrewMember -> Project
DO $$ BEGIN
    ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CastCrewType enum
DO $$ BEGIN
    CREATE TYPE "CastCrewType" AS ENUM ('CAST', 'CREW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CastCrewInvite table
CREATE TABLE IF NOT EXISTS "CastCrewInvite" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteType" "CastCrewType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "CastCrewInvite_pkey" PRIMARY KEY ("id")
);

-- Create indexes for CastCrewInvite
CREATE UNIQUE INDEX IF NOT EXISTS "CastCrewInvite_token_key" ON "CastCrewInvite"("token");
CREATE INDEX IF NOT EXISTS "CastCrewInvite_token_idx" ON "CastCrewInvite"("token");
CREATE INDEX IF NOT EXISTS "CastCrewInvite_email_idx" ON "CastCrewInvite"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "CastCrewInvite_projectId_email_targetId_key"
    ON "CastCrewInvite"("projectId", "email", "targetId");

-- Add foreign key for CastCrewInvite -> Project
DO $$ BEGIN
    ALTER TABLE "CastCrewInvite" ADD CONSTRAINT "CastCrewInvite_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enable RLS on new tables
ALTER TABLE "CrewMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CastCrewInvite" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CrewMember
-- Users can view crew members of projects they're a member of
CREATE POLICY "Users can view crew of their projects"
    ON "CrewMember" FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewMember"."projectId"
            AND pm."userId" = auth.uid()::text
        )
    );

-- Users with edit permission can insert crew members
CREATE POLICY "Users can insert crew to their projects"
    ON "CrewMember" FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewMember"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- Users with edit permission can update crew members
CREATE POLICY "Users can update crew of their projects"
    ON "CrewMember" FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewMember"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- Users with edit permission can delete crew members
CREATE POLICY "Users can delete crew from their projects"
    ON "CrewMember" FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CrewMember"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- RLS Policies for CastCrewInvite
-- Users can view invites of projects they're a member of
CREATE POLICY "Users can view cast/crew invites of their projects"
    ON "CastCrewInvite" FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CastCrewInvite"."projectId"
            AND pm."userId" = auth.uid()::text
        )
        OR "email" = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Users with manage permission can insert invites
CREATE POLICY "Users can create cast/crew invites"
    ON "CastCrewInvite" FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CastCrewInvite"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );

-- Users with manage permission can update invites
CREATE POLICY "Users can update cast/crew invites"
    ON "CastCrewInvite" FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CastCrewInvite"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
        OR "email" = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Users with manage permission can delete invites
CREATE POLICY "Users can delete cast/crew invites"
    ON "CastCrewInvite" FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "ProjectMember" pm
            WHERE pm."projectId" = "CastCrewInvite"."projectId"
            AND pm."userId" = auth.uid()::text
            AND pm."role" IN ('ADMIN', 'COORDINATOR')
        )
    );
