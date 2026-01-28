"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
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
import type { Scene } from "@/lib/mock-data";

interface AddSceneFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editScene?: Scene | null;
}

export function AddSceneForm({
  projectId,
  open,
  onOpenChange,
  onSuccess,
  editScene,
}: AddSceneFormProps) {
  const { addScene, updateScene, getLocationsForProject } = useProjectStore();
  const [loading, setLoading] = React.useState(false);

  const locations = getLocationsForProject(projectId);
  const isEditing = !!editScene;

  const [formData, setFormData] = React.useState({
    sceneNumber: "",
    synopsis: "",
    intExt: "INT" as "INT" | "EXT" | "BOTH",
    dayNight: "DAY" as "DAY" | "NIGHT" | "DAWN" | "DUSK",
    location: "",
    pageCount: "1",
    estimatedMinutes: "",
    notes: "",
    imageUrl: null as string | null,
    images: [] as string[],
  });

  // Reset form when dialog opens/closes or when editing a different scene
  React.useEffect(() => {
    if (open && editScene) {
      setFormData({
        sceneNumber: editScene.sceneNumber,
        synopsis: editScene.synopsis,
        intExt: editScene.intExt,
        dayNight: editScene.dayNight,
        location: editScene.location,
        pageCount: editScene.pageCount.toString(),
        estimatedMinutes: editScene.estimatedMinutes?.toString() || "",
        notes: editScene.notes || "",
        imageUrl: editScene.imageUrl || null,
        images: editScene.images || [],
      });
    } else if (open && !editScene) {
      setFormData({
        sceneNumber: "",
        synopsis: "",
        intExt: "INT",
        dayNight: "DAY",
        location: "",
        pageCount: "1",
        estimatedMinutes: "",
        notes: "",
        imageUrl: null,
        images: [],
      });
    }
  }, [open, editScene]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const sceneData = {
      projectId,
      sceneNumber: formData.sceneNumber,
      synopsis: formData.synopsis,
      intExt: formData.intExt,
      dayNight: formData.dayNight,
      location: formData.location,
      pageCount: parseFloat(formData.pageCount),
      estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
      notes: formData.notes || undefined,
      imageUrl: formData.imageUrl || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
    };

    if (isEditing && editScene) {
      updateScene(editScene.id, sceneData);
    } else {
      addScene({
        ...sceneData,
        status: "NOT_SCHEDULED",
        castIds: [],
      });
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess?.();
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
            {/* Storyboard Image */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Storyboard Image
              </label>
              <ImageUpload
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                bucket="scene-photos"
                folder={projectId}
                aspectRatio="video"
                placeholder="Drop a storyboard image or click to upload"
              />
            </div>

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
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Day/Night
                </label>
                <Select
                  value={formData.dayNight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dayNight: e.target.value as typeof formData.dayNight,
                    })
                  }
                  options={[
                    { value: "DAY", label: "Day" },
                    { value: "NIGHT", label: "Night" },
                    { value: "DAWN", label: "Dawn" },
                    { value: "DUSK", label: "Dusk" },
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
              <Input
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g., Coffee Shop - Downtown"
                list="locations-list"
              />
              <datalist id="locations-list">
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name} />
                ))}
              </datalist>
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

            {/* Additional Images */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Additional Reference Images
              </label>
              <MultiImageUpload
                value={formData.images}
                onChange={(urls) => setFormData({ ...formData, images: urls })}
                bucket="scene-photos"
                folder={`${projectId}/references`}
                maxImages={6}
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
              {loading ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Changes" : "Add Scene")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
