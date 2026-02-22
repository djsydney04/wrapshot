-- Track friend invites sent from in-app share modal
CREATE TABLE IF NOT EXISTS "FriendInvite" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "invitedBy" TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'SHARE_MODAL',
  status TEXT NOT NULL DEFAULT 'PENDING',
  "resendEmailId" TEXT,
  "emailError" TEXT,
  "sentAt" TIMESTAMPTZ,
  "acceptedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("invitedBy", email)
);

CREATE INDEX IF NOT EXISTS idx_friend_invite_email ON "FriendInvite"(email);
CREATE INDEX IF NOT EXISTS idx_friend_invite_invited_by ON "FriendInvite"("invitedBy");
CREATE INDEX IF NOT EXISTS idx_friend_invite_status ON "FriendInvite"(status);

CREATE TRIGGER update_friend_invite_updated_at
  BEFORE UPDATE ON "FriendInvite"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE "FriendInvite" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friend invites"
  ON "FriendInvite" FOR SELECT
  USING ("invitedBy" = auth.uid()::TEXT);

CREATE POLICY "Users can create friend invites"
  ON "FriendInvite" FOR INSERT
  WITH CHECK ("invitedBy" = auth.uid()::TEXT);

CREATE POLICY "Users can update their own friend invites"
  ON "FriendInvite" FOR UPDATE
  USING ("invitedBy" = auth.uid()::TEXT);

GRANT ALL ON "FriendInvite" TO authenticated;
