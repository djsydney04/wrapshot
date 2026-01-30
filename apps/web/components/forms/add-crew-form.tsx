"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
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
import { createCrewMember, type DepartmentType } from "@/lib/actions/crew";
import { inviteCrewMember } from "@/lib/actions/cast-crew-invites";
import { CastCrewUserPicker } from "@/components/ui/cast-crew-user-picker";
import { type UserSelection } from "@/components/ui/user-search-combobox";
import { DEPARTMENT_LABELS } from "@/lib/mock-data";

interface AddCrewFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const departmentOptions = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const initialFormData = {
  name: "",
  role: "",
  department: "PRODUCTION" as DepartmentType,
  email: "",
  phone: "",
  isHead: false,
  profilePhotoUrl: null as string | null,
};

export function AddCrewForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: AddCrewFormProps) {
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
      name: name,
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

      // Create the crew member using server action
      const { data: crewMember, error: createError } = await createCrewMember({
        projectId,
        name: formData.name,
        role: formData.role,
        department: formData.department,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        isHead: formData.isHead,
        profilePhotoUrl: formData.profilePhotoUrl || undefined,
        userId,
      });

      if (createError) throw new Error(createError);

      // If sendInvite is checked and we have an email (but not linked to existing user)
      // send the invite
      if (crewMember && formData.email && sendInvite && !userId) {
        try {
          await inviteCrewMember(crewMember.id, projectId);
        } catch (inviteError) {
          console.error("Failed to send invite:", inviteError);
          // Don't fail the whole operation if invite fails
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add crew member");
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
          <DialogTitle>Add Crew Member</DialogTitle>
          <DialogDescription>
            Add a new crew member to your production team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Profile Photo */}
            <div className="flex justify-center">
              <div className="w-32">
                <label className="block text-sm font-medium mb-1.5 text-center">
                  Profile Photo
                </label>
                <ImageUpload
                  value={formData.profilePhotoUrl}
                  onChange={(url) =>
                    setFormData({ ...formData, profilePhotoUrl: url })
                  }
                  bucket="profile-photos"
                  folder={projectId}
                  className="aspect-square rounded-full"
                  placeholder="Add photo"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">
                Crew Member Details
              </label>
              <CastCrewUserPicker
                projectId={projectId}
                onUserSelect={handleUserSelect}
                onManualEntry={handleManualEntry}
                nameLabel="Name"
                namePlaceholder="e.g., John Smith"
                emailPlaceholder="email@example.com (optional)"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Role / Job Title *
              </label>
              <Input
                required
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                placeholder="e.g., Director of Photography"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Department *
                </label>
                <Select
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      department: e.target.value as DepartmentType,
                    })
                  }
                  options={departmentOptions}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={formData.isHead}
                    onChange={(e) =>
                      setFormData({ ...formData, isHead: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Department Head</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Phone
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 555 123 4567"
              />
            </div>

            {showInviteOption && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox
                  id="send-crew-invite"
                  checked={sendInvite}
                  onCheckedChange={(checked) => setSendInvite(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="send-crew-invite" className="cursor-pointer">
                    Send platform invite
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    They&apos;ll receive an email to create an account and link to
                    this crew role.
                  </p>
                </div>
              </div>
            )}

            {isUserLinked && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>
                  This crew member will be linked to{" "}
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
              {loading ? "Adding..." : "Add Crew Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
