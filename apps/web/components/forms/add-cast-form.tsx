"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(initialFormData);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: createError } = await createCastMember({
        projectId,
        characterName: formData.characterName,
        actorName: formData.actorName || undefined,
        workStatus: formData.workStatus,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
      });

      if (createError) throw new Error(createError);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add cast member");
    } finally {
      setLoading(false);
    }
  };

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
            <div className="grid gap-4 sm:grid-cols-2">
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
                <label className="block text-sm font-medium mb-1.5">
                  Actor Name *
                </label>
                <Input
                  required
                  value={formData.actorName}
                  onChange={(e) =>
                    setFormData({ ...formData, actorName: e.target.value })
                  }
                  placeholder="e.g., Robert Downey Jr."
                />
              </div>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="actor@email.com"
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
              {loading ? "Adding..." : "Add Cast Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
