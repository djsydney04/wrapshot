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
import { createLocation, type LocationType, type IntExt, type PermitStatus } from "@/lib/actions/locations";

interface AddLocationFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const initialFormData = {
  name: "",
  address: "",
  locationType: "PRACTICAL" as LocationType,
  interiorExterior: "BOTH" as IntExt,
  permitStatus: "NOT_STARTED" as PermitStatus,
};

export function AddLocationForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: AddLocationFormProps) {
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
      const { error: createError } = await createLocation({
        projectId,
        name: formData.name,
        address: formData.address || undefined,
        locationType: formData.locationType,
        interiorExterior: formData.interiorExterior,
        permitStatus: formData.permitStatus,
      });

      if (createError) throw new Error(createError);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add location");
    } finally {
      setLoading(false);
    }
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
                  value={formData.locationType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      locationType: e.target.value as LocationType,
                    })
                  }
                  options={[
                    { value: "PRACTICAL", label: "Practical Location" },
                    { value: "STUDIO", label: "Studio" },
                    { value: "BACKLOT", label: "Backlot" },
                    { value: "VIRTUAL", label: "Virtual" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  INT/EXT
                </label>
                <Select
                  value={formData.interiorExterior}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interiorExterior: e.target.value as IntExt,
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
                    permitStatus: e.target.value as PermitStatus,
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
              {loading ? "Adding..." : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
