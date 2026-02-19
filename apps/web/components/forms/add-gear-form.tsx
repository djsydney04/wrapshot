"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { useProjectStore } from "@/lib/stores/project-store";
import { DEPARTMENT_LABELS, GEAR_CATEGORIES, type GearItem, type DepartmentType, type Scene } from "@/lib/types";

interface AddGearFormProps {
  projectId: string;
  scenes: Scene[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editItem?: GearItem | null;
  defaultDepartment?: DepartmentType;
}

export function AddGearForm({
  projectId,
  scenes,
  open,
  onOpenChange,
  onSuccess,
  editItem,
  defaultDepartment,
}: AddGearFormProps) {
  const { addGearItem, updateGearItem } = useProjectStore();
  const [loading, setLoading] = React.useState(false);

  const isEditing = !!editItem;

  const [formData, setFormData] = React.useState({
    name: "",
    category: "PROPS" as GearItem["category"],
    department: (defaultDepartment || "CAMERA") as DepartmentType,
    quantity: "1",
    notes: "",
    photoUrl: null as string | null,
    assignedScenes: [] as string[],
  });

  React.useEffect(() => {
    if (open && editItem) {
      setFormData({
        name: editItem.name,
        category: editItem.category,
        department: editItem.department,
        quantity: editItem.quantity.toString(),
        notes: editItem.notes || "",
        photoUrl: editItem.photoUrl || null,
        assignedScenes: editItem.assignedScenes || [],
      });
    } else if (open && !editItem) {
      setFormData({
        name: "",
        category: "PROPS",
        department: defaultDepartment || "CAMERA",
        quantity: "1",
        notes: "",
        photoUrl: null,
        assignedScenes: [],
      });
    }
  }, [open, editItem, defaultDepartment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const itemData = {
      projectId,
      name: formData.name,
      category: formData.category,
      department: formData.department,
      quantity: parseInt(formData.quantity) || 1,
      notes: formData.notes || undefined,
      photoUrl: formData.photoUrl || undefined,
      assignedScenes: formData.assignedScenes.length > 0 ? formData.assignedScenes : undefined,
    };

    if (isEditing && editItem) {
      updateGearItem(editItem.id, itemData);
    } else {
      addGearItem(itemData);
    }

    setLoading(false);
    onOpenChange(false);
    onSuccess?.();
  };

  const toggleScene = (sceneId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedScenes: prev.assignedScenes.includes(sceneId)
        ? prev.assignedScenes.filter((id) => id !== sceneId)
        : [...prev.assignedScenes, sceneId],
    }));
  };

  const categoryOptions = Object.entries(GEAR_CATEGORIES).map(([value, label]) => ({
    value,
    label,
  }));

  const departmentOptions = (Object.keys(DEPARTMENT_LABELS) as DepartmentType[]).map((dept) => ({
    value: dept,
    label: DEPARTMENT_LABELS[dept],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Item" : "Add Gear/Prop"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update item details" : "Add equipment, props, or other items to track"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Photo */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Photo (optional)
              </label>
              <ImageUpload
                value={formData.photoUrl}
                onChange={(url) => setFormData({ ...formData, photoUrl: url })}
                bucket="project-assets"
                folder={`${projectId}/gear`}
                aspectRatio="square"
                placeholder="Add item photo"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Item Name *
              </label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., RED Komodo 6K, Vintage Typewriter"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as GearItem["category"] })
                  }
                  options={categoryOptions}
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Department
                </label>
                <Select
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value as DepartmentType })
                  }
                  options={departmentOptions}
                />
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Quantity
              </label>
              <Input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            {/* Assign to Scenes */}
            {scenes.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Assign to Scenes
                </label>
                <div className="flex flex-wrap gap-2 p-3 border border-border rounded-lg max-h-32 overflow-y-auto">
                  {scenes.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => toggleScene(scene.id)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        formData.assignedScenes.includes(scene.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      Scene {scene.sceneNumber}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.assignedScenes.length} scenes selected
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Rental info, special requirements, etc."
                rows={2}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="skeuo-outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="skeuo" disabled={loading}>
              {loading ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Changes" : "Add Item")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
