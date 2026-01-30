-- Receipts Storage Bucket Migration
-- Creates storage bucket and policies for receipt uploads (financial documents)

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Receipts bucket (private - 10MB, images + PDFs)
-- Path format: {budgetId}/{transactionId or 'pending'}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10 MiB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- RLS: Project members can view receipts (via budget relationship)
-- Path format: receipts/{budgetId}/{transactionId or 'pending'}/{filename}
CREATE POLICY "Project members can view receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM "Budget" b
      JOIN "ProjectMember" pm ON pm."projectId" = b."projectId"
      WHERE b."id"::TEXT = split_part(name, '/', 1)
      AND pm."userId" = auth.uid()::TEXT
    )
  );

-- RLS: Coordinators/Admins/Dept Heads can upload receipts
CREATE POLICY "Project coordinators can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM "Budget" b
      JOIN "ProjectMember" pm ON pm."projectId" = b."projectId"
      WHERE b."id"::TEXT = split_part(name, '/', 1)
      AND pm."userId" = auth.uid()::TEXT
      AND pm."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

-- RLS: Coordinators/Admins can update receipts
CREATE POLICY "Project coordinators can update receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM "Budget" b
      JOIN "ProjectMember" pm ON pm."projectId" = b."projectId"
      WHERE b."id"::TEXT = split_part(name, '/', 1)
      AND pm."userId" = auth.uid()::TEXT
      AND pm."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

-- RLS: Coordinators/Admins can delete receipts
CREATE POLICY "Project coordinators can delete receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM "Budget" b
      JOIN "ProjectMember" pm ON pm."projectId" = b."projectId"
      WHERE b."id"::TEXT = split_part(name, '/', 1)
      AND pm."userId" = auth.uid()::TEXT
      AND pm."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

