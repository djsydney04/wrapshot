"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/lib/stores/project-store";

interface AddCastFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddCastForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: AddCastFormProps) {
  const { addCastMember, getCastForProject } = useProjectStore();
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    characterName: "",
    actorName: "",
    status: "ON_HOLD" as const,
    email: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Get next cast number
    const existingCast = getCastForProject(projectId);
    const nextCastNumber = existingCast.length + 1;

    addCastMember({
      projectId,
      characterName: formData.characterName,
      actorName: formData.actorName,
      castNumber: nextCastNumber,
      status: formData.status,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
    });

    setLoading(false);
    setFormData({
      characterName: "",
      actorName: "",
      status: "ON_HOLD",
      email: "",
      phone: "",
    });
    onOpenChange(false);
    onSuccess?.();
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
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as typeof formData.status,
                  })
                }
                options={[
                  { value: "ON_HOLD", label: "On Hold" },
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "WORKING", label: "Working" },
                  { value: "WRAPPED", label: "Wrapped" },
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
