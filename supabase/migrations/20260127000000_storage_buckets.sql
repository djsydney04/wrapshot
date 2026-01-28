-- Storage Buckets Migration
-- Creates storage buckets and policies for file uploads

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Scene photos bucket (public - for reference images, storyboards)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scene-photos',
  'scene-photos',
  true,
  10485760, -- 10 MiB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Profile photos bucket (public - for cast/crew headshots)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5 MiB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Resumes bucket (private - for crew resumes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760, -- 10 MiB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Scripts bucket (private - for confidential script files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scripts',
  'scripts',
  false,
  52428800, -- 50 MiB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Project assets bucket (private - for call sheets, attachments, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-assets',
  'project-assets',
  false,
  52428800, -- 50 MiB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Scene Photos Policies (Public bucket)
CREATE POLICY "Anyone can view scene photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scene-photos');

CREATE POLICY "Authenticated users can upload scene photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'scene-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own scene photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'scene-photos'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

CREATE POLICY "Users can delete their own scene photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scene-photos'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

-- Profile Photos Policies (Public bucket)
CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Authenticated users can upload profile photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own profile photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

CREATE POLICY "Users can delete their own profile photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

-- Resumes Policies (Private bucket)
CREATE POLICY "Authenticated users can view resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own resumes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

CREATE POLICY "Users can delete their own resumes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::TEXT = owner_id::TEXT
  );

-- Scripts Policies (Private bucket - project-based access)
CREATE POLICY "Project members can view scripts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scripts'
    AND auth.role() = 'authenticated'
    -- Path format: scripts/{projectId}/{filename}
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can upload scripts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'scripts'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project coordinators can update scripts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'scripts'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project coordinators can delete scripts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'scripts'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Project Assets Policies (Private bucket - project-based access)
CREATE POLICY "Project members can view project assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-assets'
    AND auth.role() = 'authenticated'
    -- Path format: project-assets/{projectId}/{filename}
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project coordinators can upload project assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-assets'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

CREATE POLICY "Project coordinators can update project assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-assets'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

CREATE POLICY "Project coordinators can delete project assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-assets'
    AND EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "projectId" = split_part(name, '/', 1)
      AND "userId" = auth.uid()::TEXT
      AND role IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );
