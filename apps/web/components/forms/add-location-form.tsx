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

interface AddLocationFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddLocationForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: AddLocationFormProps) {
  const { addLocation } = useProjectStore();
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    address: "",
    type: "PRACTICAL" as "PRACTICAL" | "STUDIO" | "BACKLOT",
    intExt: "INT" as "INT" | "EXT" | "BOTH",
    permitStatus: "NOT_STARTED" as "NOT_STARTED" | "APPLIED" | "APPROVED" | "DENIED",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    addLocation({
      projectId,
      name: formData.name,
      address: formData.address,
      type: formData.type,
      intExt: formData.intExt,
      permitStatus: formData.permitStatus,
    });

    setLoading(false);
    setFormData({
      name: "",
      address: "",
      type: "PRACTICAL",
      intExt: "INT",
      permitStatus: "NOT_STARTED",
    });
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Add Location</DialogTitle>
          <DialogDescription>
            Add a new shooting location to your project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Location Name *
              </label>
              <Input
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Central Park - Bethesda Fountain"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Address *
              </label>
              <Input
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Full street address"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">Type</label>
                <Select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as typeof formData.type,
                    })
                  }
                  options={[
                    { value: "PRACTICAL", label: "Practical Location" },
                    { value: "STUDIO", label: "Studio" },
                    { value: "BACKLOT", label: "Backlot" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  INT/EXT
                </label>
                <Select
                  value={formData.intExt}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      intExt: e.target.value as typeof formData.intExt,
                    })
                  }
                  options={[
                    { value: "INT", label: "Interior" },
                    { value: "EXT", label: "Exterior" },
                    { value: "BOTH", label: "Both" },
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Permit Status
              </label>
              <Select
                value={formData.permitStatus}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    permitStatus: e.target.value as typeof formData.permitStatus,
                  })
                }
                options={[
                  { value: "NOT_STARTED", label: "Not Started" },
                  { value: "APPLIED", label: "Applied" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "DENIED", label: "Denied" },
                ]}
              />
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
              {loading ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
