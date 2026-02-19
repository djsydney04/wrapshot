-- Market-style shot list fields + project cover image support

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;

ALTER TABLE "CameraShot"
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS setup TEXT,
  ADD COLUMN IF NOT EXISTS "shotSize" TEXT,
  ADD COLUMN IF NOT EXISTS "cameraAngle" TEXT,
  ADD COLUMN IF NOT EXISTS lens TEXT,
  ADD COLUMN IF NOT EXISTS "cameraBody" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "syncSound" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "vfxRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "referenceImageUrl" TEXT;

CREATE INDEX IF NOT EXISTS "CameraShot_project_day_status_sort_idx"
  ON "CameraShot" ("projectId", "shootingDayId", "sceneId", status, "sortOrder");

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-covers',
  'project-covers',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view project covers" ON storage.objects;
CREATE POLICY "Anyone can view project covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-covers');

DROP POLICY IF EXISTS "Project coordinators can upload project covers" ON storage.objects;
CREATE POLICY "Project coordinators can upload project covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-covers'
    AND auth.role() = 'authenticated'
    -- Path format: project-covers/{projectId}/{filename}
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

DROP POLICY IF EXISTS "Project coordinators can update project covers" ON storage.objects;
CREATE POLICY "Project coordinators can update project covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-covers'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

DROP POLICY IF EXISTS "Project coordinators can delete project covers" ON storage.objects;
CREATE POLICY "Project coordinators can delete project covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-covers'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );
