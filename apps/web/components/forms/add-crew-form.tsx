"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
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
import { SmartUserInput, type SmartUserSelection } from "@/components/ui/smart-user-input";
import { DEPARTMENT_LABELS } from "@/lib/types";

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
  const [userSelection, setUserSelection] = React.useState<SmartUserSelection>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError(null);
      setUserSelection(null);
    }
  }, [open]);

  const handleSelectionChange = React.useCallback((selection: SmartUserSelection) => {
    setUserSelection(selection);
  }, []);

  const handleValueChange = React.useCallback((name: string, email: string) => {
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
        userSelection?.type === "existing_user"
          ? userSelection.user.userId
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

      // Auto-send invite if a new email was selected (not linked to existing user)
      if (crewMember && userSelection?.type === "new_invite" && formData.email) {
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
              <SmartUserInput
                projectId={projectId}
                onSelectionChange={handleSelectionChange}
                onValueChange={handleValueChange}
                nameLabel="Name"
                placeholder="Search by name or enter email..."
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
