"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCastMember, type CastWorkStatus } from "@/lib/actions/cast";
import { inviteCastMember } from "@/lib/actions/cast-crew-invites";
import { CastCrewUserPicker } from "@/components/ui/cast-crew-user-picker";
import { type UserSelection } from "@/components/ui/user-search-combobox";

interface AddCastFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const initialFormData = {
  characterName: "",
  actorName: "",
  workStatus: "ON_HOLD" as CastWorkStatus,
  email: "",
  phone: "",
};

export function AddCastForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: AddCastFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState(initialFormData);
  const [selectedUser, setSelectedUser] = React.useState<UserSelection | null>(null);
  const [sendInvite, setSendInvite] = React.useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError(null);
      setSelectedUser(null);
      setSendInvite(false);
    }
  }, [open]);

  const handleUserSelect = React.useCallback((selection: UserSelection | null) => {
    setSelectedUser(selection);
    // Reset send invite when user selection changes
    setSendInvite(false);
  }, []);

  const handleManualEntry = React.useCallback((name: string, email: string) => {
    setFormData((prev) => ({
      ...prev,
      actorName: name,
      email: email,
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Determine userId if an existing user was selected
      const userId =
        selectedUser?.type === "existing_user"
          ? selectedUser.user.userId
          : undefined;

      // Create the cast member
      const { data: castMember, error: createError } = await createCastMember({
        projectId,
        characterName: formData.characterName,
        actorName: formData.actorName || undefined,
        workStatus: formData.workStatus,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        userId,
      });

      if (createError) throw new Error(createError);

      // If sendInvite is checked and we have an email (but not linked to existing user)
      // or if a new email was selected from search, send the invite
      if (castMember && formData.email && sendInvite && !userId) {
        try {
          await inviteCastMember(castMember.id, projectId);
        } catch (inviteError) {
          console.error("Failed to send invite:", inviteError);
          // Don't fail the whole operation if invite fails
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add cast member");
    } finally {
      setLoading(false);
    }
  };

  // Show invite checkbox if email is provided and user is not already linked
  const showInviteOption =
    formData.email &&
    (!selectedUser || selectedUser.type === "new_email");

  // Show linked user indicator
  const isUserLinked = selectedUser?.type === "existing_user";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add Cast Member</DialogTitle>
          <DialogDescription>
            Add a new cast member to your project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Character Name *
              </label>
              <Input
                required
                value={formData.characterName}
                onChange={(e) =>
                  setFormData({ ...formData, characterName: e.target.value })
                }
                placeholder="e.g., John Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Actor Details
              </label>
              <CastCrewUserPicker
                projectId={projectId}
                onUserSelect={handleUserSelect}
                onManualEntry={handleManualEntry}
                nameLabel="Actor Name"
                namePlaceholder="e.g., Robert Downey Jr."
                emailPlaceholder="actor@email.com (optional)"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <Select
                value={formData.workStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    workStatus: e.target.value as CastWorkStatus,
                  })
                }
                options={[
                  { value: "ON_HOLD", label: "On Hold" },
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "WORKING", label: "Working" },
                  { value: "WRAPPED", label: "Wrapped" },
                  { value: "DROPPED", label: "Dropped" },
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
              />
            </div>

            {showInviteOption && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox
                  id="send-invite"
                  checked={sendInvite}
                  onCheckedChange={(checked) => setSendInvite(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="send-invite" className="cursor-pointer">
                    Send platform invite
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    They&apos;ll receive an email to create an account and link to
                    this cast role.
                  </p>
                </div>
              </div>
            )}

            {isUserLinked && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>
                  This cast member will be linked to{" "}
                  <strong>
                    {selectedUser.user.displayName ||
                      `${selectedUser.user.firstName || ""} ${selectedUser.user.lastName || ""}`.trim() ||
                      selectedUser.user.email}
                  </strong>
                  &apos;s account
                </span>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Cast Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
