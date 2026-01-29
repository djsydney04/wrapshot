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
import { createScene, updateScene as updateSceneAction, type Scene, type IntExt, type DayNight } from "@/lib/actions/scenes";
import { getLocations, type Location } from "@/lib/actions/locations";

interface AddSceneFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editScene?: Scene | null;
}

const initialFormData = {
  sceneNumber: "",
  synopsis: "",
  intExt: "INT" as IntExt,
  dayNight: "DAY" as DayNight,
  locationId: "",
  pageCount: "1",
  estimatedMinutes: "",
  notes: "",
};

export function AddSceneForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  editScene,
}: AddSceneFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [formData, setFormData] = React.useState(initialFormData);
  const isEditing = !!editScene;

  // Load locations when dialog opens
  React.useEffect(() => {
    if (open) {
      getLocations(projectId).then(({ data }) => {
        if (data) setLocations(data);
      });
    }
  }, [open, projectId]);

  // Reset form when dialog opens/closes or when editing a different scene
  React.useEffect(() => {
    if (open && editScene) {
      setFormData({
        sceneNumber: editScene.sceneNumber,
        synopsis: editScene.synopsis || "",
        intExt: editScene.intExt,
        dayNight: editScene.dayNight,
        locationId: editScene.locationId || "",
        pageCount: editScene.pageCount.toString(),
        estimatedMinutes: editScene.estimatedMinutes?.toString() || "",
        notes: editScene.notes || "",
      });
      setError(null);
    } else if (open && !editScene) {
      setFormData(initialFormData);
      setError(null);
    }
  }, [open, editScene]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const sceneData = {
        projectId,
        sceneNumber: formData.sceneNumber,
        synopsis: formData.synopsis || undefined,
        intExt: formData.intExt,
        dayNight: formData.dayNight,
        locationId: formData.locationId || undefined,
        pageCount: parseFloat(formData.pageCount),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
        notes: formData.notes || undefined,
      };

      if (isEditing && editScene) {
        const { error: updateError } = await updateSceneAction(editScene.id, sceneData);
        if (updateError) throw new Error(updateError);
      } else {
        const { error: createError } = await createScene(sceneData);
        if (createError) throw new Error(createError);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scene");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Scene" : "Add Scene"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update scene details" : "Add a new scene to your project"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Scene Number *
                </label>
                <Input
                  required
                  value={formData.sceneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, sceneNumber: e.target.value })
                  }
                  placeholder="e.g., 1, 2A, 3B"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Page Count
                </label>
                <Input
                  type="number"
                  step="0.125"
                  min="0.125"
                  value={formData.pageCount}
                  onChange={(e) =>
                    setFormData({ ...formData, pageCount: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Synopsis *
              </label>
              <Textarea
                required
                value={formData.synopsis}
                onChange={(e) =>
                  setFormData({ ...formData, synopsis: e.target.value })
                }
                placeholder="Brief description of the scene..."
                rows={3}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  INT/EXT
                </label>
                <Select
                  value={formData.intExt}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      intExt: e.target.value as IntExt,
                    })
                  }
                  options={[
                    { value: "INT", label: "Interior" },
                    { value: "EXT", label: "Exterior" },
                    { value: "BOTH", label: "Both" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Day/Night
                </label>
                <Select
                  value={formData.dayNight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dayNight: e.target.value as DayNight,
                    })
                  }
                  options={[
                    { value: "DAY", label: "Day" },
                    { value: "NIGHT", label: "Night" },
                    { value: "DAWN", label: "Dawn" },
                    { value: "DUSK", label: "Dusk" },
                    { value: "MORNING", label: "Morning" },
                    { value: "AFTERNOON", label: "Afternoon" },
                    { value: "EVENING", label: "Evening" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Est. Minutes
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.estimatedMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, estimatedMinutes: e.target.value })
                  }
                  placeholder="Runtime"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Location
              </label>
              <Select
                value={formData.locationId}
                onChange={(e) =>
                  setFormData({ ...formData, locationId: e.target.value })
                }
                options={[
                  { value: "", label: "Select a location..." },
                  ...locations.map((loc) => ({
                    value: loc.id,
                    label: loc.name,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes about the scene..."
                rows={2}
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
              {loading ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Changes" : "Add Scene")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
