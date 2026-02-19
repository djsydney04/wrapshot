"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { SceneBreakdownEditor } from "@/components/scenes/scene-breakdown-editor";
import { CreateSceneBreakdownEditor } from "@/components/scenes/create-scene-breakdown-editor";
import { createScene, updateScene as updateSceneAction, addCastToScene, type Scene, type IntExt, type DayNight } from "@/lib/actions/scenes";
import { trackSceneCreated } from "@/lib/analytics/posthog";
import { getLocations, type Location } from "@/lib/actions/locations";
import { getElements, type Element, getSceneElements, assignElementToScene } from "@/lib/actions/elements";
import { getCastMembers, type CastMember } from "@/lib/actions/cast";
import type { SceneElementItem } from "@/components/scenes/breakdown-category";

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
  setName: "",
  locationId: "",
  pageCount: "1",
  estimatedMinutes: "",
  notes: "",
};

// Pending element for new scenes (stored locally until scene is created)
interface PendingElement {
  elementId: string;
  quantity: number;
  notes: string | null;
  element: Element;
}

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
  const [elements, setElements] = React.useState<Element[]>([]);
  const [sceneElements, setSceneElements] = React.useState<SceneElementItem[]>([]);
  const [pendingElements, setPendingElements] = React.useState<PendingElement[]>([]);
  const [pendingCastIds, setPendingCastIds] = React.useState<string[]>([]);
  const [cast, setCast] = React.useState<CastMember[]>([]);
  const [formData, setFormData] = React.useState(initialFormData);
  const [activeTab, setActiveTab] = React.useState<string>("basic");
  const isEditing = !!editScene;

  // Load data when dialog opens
  React.useEffect(() => {
    if (open) {
      // Load locations, elements, and cast
      getLocations(projectId).then(({ data }) => {
        if (data) setLocations(data);
      });

      getElements(projectId).then(({ data }) => {
        if (data) setElements(data);
      });

      getCastMembers(projectId).then(({ data }) => {
        if (data) setCast(data);
      });

      // Load scene elements if editing
      if (editScene) {
        getSceneElements(editScene.id).then(({ data }) => {
          if (data) {
            const mapped = data.map((se: { id: string; elementId: string; quantity: number; notes: string | null; element: Element }) => ({
              id: se.id,
              elementId: se.elementId,
              quantity: se.quantity,
              notes: se.notes,
              element: se.element,
            }));
            setSceneElements(mapped);
          }
        });
      }
    } else {
      // Reset tab when dialog closes
      setActiveTab("basic");
    }
  }, [open, projectId, isEditing, editScene]);

  // Reset form when dialog opens/closes or when editing a different scene
  React.useEffect(() => {
    if (open && editScene) {
      setFormData({
        sceneNumber: editScene.sceneNumber,
        synopsis: editScene.synopsis || "",
        intExt: editScene.intExt,
        dayNight: editScene.dayNight,
        setName: editScene.setName || "",
        locationId: editScene.locationId || "",
        pageCount: editScene.pageCount.toString(),
        estimatedMinutes: editScene.estimatedMinutes?.toString() || "",
        notes: editScene.notes || "",
      });
      setError(null);
    } else if (open && !editScene) {
      setFormData(initialFormData);
      setSceneElements([]);
      setPendingElements([]);
      setPendingCastIds([]);
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
        setName: formData.setName || undefined,
        locationId: formData.locationId || undefined,
        pageCount: parseFloat(formData.pageCount),
        estimatedMinutes: formData.estimatedMinutes ? parseInt(formData.estimatedMinutes) : undefined,
        notes: formData.notes || undefined,
      };

      if (isEditing && editScene) {
        const { error: updateError } = await updateSceneAction(editScene.id, sceneData);
        if (updateError) throw new Error(updateError);
      } else {
        const { data: newScene, error: createError } = await createScene(sceneData);
        if (createError) throw new Error(createError);
        if (newScene) {
          trackSceneCreated(projectId, newScene.id);

          // Assign pending elements to the newly created scene
          for (const pending of pendingElements) {
            await assignElementToScene(pending.elementId, newScene.id, pending.quantity, pending.notes || undefined);
          }

          // Assign pending cast to the newly created scene
          for (const castId of pendingCastIds) {
            await addCastToScene(newScene.id, castId, projectId);
          }
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scene");
    } finally {
      setLoading(false);
    }
  };

  const handleBreakdownUpdate = () => {
    // Refresh scene elements
    if (editScene) {
      getSceneElements(editScene.id).then(({ data }) => {
        if (data) {
          const mapped = data.map((se: { id: string; elementId: string; quantity: number; notes: string | null; element: Element }) => ({
            id: se.id,
            elementId: se.elementId,
            quantity: se.quantity,
            notes: se.notes,
            element: se.element,
          }));
          setSceneElements(mapped);
        }
      });
    }
  };

  // Handle adding pending element (for new scenes)
  const handleAddPendingElement = (element: Element, quantity: number = 1) => {
    setPendingElements((prev) => {
      const existing = prev.find((e) => e.elementId === element.id);
      if (existing) return prev;
      return [...prev, { elementId: element.id, quantity, notes: null, element }];
    });
  };

  // Handle removing pending element (for new scenes)
  const handleRemovePendingElement = (elementId: string) => {
    setPendingElements((prev) => prev.filter((e) => e.elementId !== elementId));
  };

  // Handle adding pending cast (for new scenes)
  const handleAddPendingCast = (castId: string) => {
    setPendingCastIds((prev) => {
      if (prev.includes(castId)) return prev;
      return [...prev, castId];
    });
  };

  // Handle removing pending cast (for new scenes)
  const handleRemovePendingCast = (castId: string) => {
    setPendingCastIds((prev) => prev.filter((id) => id !== castId));
  };

  // Handle new element creation for pending elements
  const handleCreatePendingElement = async (category: string, name: string): Promise<Element | null> => {
    const { quickCreateElement } = await import("@/lib/actions/elements");
    const { data, error } = await quickCreateElement(projectId, category as Element["category"], name);
    if (error || !data) return null;
    // Add to local elements list
    setElements((prev) => [...prev, data]);
    return data;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClose={() => onOpenChange(false)}
        className="max-w-6xl w-[96vw] max-h-[92vh]"
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Scene" : "Add Scene"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update scene details and breakdown" : "Add a new scene with elements, cast, and more"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="basic">
          <TabsList className="w-full">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="breakdown">
              Elements & Cast
              {!isEditing && (pendingElements.length > 0 || pendingCastIds.length > 0) && (
                <span className="ml-1.5 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {pendingElements.length + pendingCastIds.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <form onSubmit={handleSubmit}>
              <DialogBody className="space-y-4">
                <BasicInfoFields
                  formData={formData}
                  setFormData={setFormData}
                  locations={locations}
                  error={error}
                />
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="skeuo-outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button variant="skeuo" type="submit" disabled={loading}>
                  {loading ? "Saving..." : (isEditing ? "Save Changes" : "Create Scene")}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="breakdown">
            <DialogBody>
              {isEditing && editScene ? (
                <SceneBreakdownEditor
                  scene={editScene}
                  projectId={projectId}
                  cast={cast}
                  elements={elements}
                  sceneElements={sceneElements}
                  locations={locations}
                  onUpdate={handleBreakdownUpdate}
                />
              ) : (
                <CreateSceneBreakdownEditor
                  projectId={projectId}
                  cast={cast}
                  elements={elements}
                  pendingElements={pendingElements}
                  pendingCastIds={pendingCastIds}
                  onAddElement={handleAddPendingElement}
                  onRemoveElement={handleRemovePendingElement}
                  onAddCast={handleAddPendingCast}
                  onRemoveCast={handleRemovePendingCast}
                  onCreateElement={handleCreatePendingElement}
                />
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="skeuo-outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              {!isEditing && (
                <Button variant="skeuo" onClick={(e) => handleSubmit(e as unknown as React.FormEvent)} disabled={loading || !formData.sceneNumber || !formData.synopsis}>
                  {loading ? "Creating..." : "Create Scene"}
                </Button>
              )}
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Extract basic info fields to a separate component for reuse
interface BasicInfoFieldsProps {
  formData: typeof initialFormData;
  setFormData: React.Dispatch<React.SetStateAction<typeof initialFormData>>;
  locations: Location[];
  error: string | null;
}

function BasicInfoFields({ formData, setFormData, locations, error }: BasicInfoFieldsProps) {
  return (
    <>
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
          Set / Location Name
        </label>
        <Input
          value={formData.setName}
          onChange={(e) =>
            setFormData({ ...formData, setName: e.target.value })
          }
          placeholder="e.g., JOHN'S APARTMENT - LIVING ROOM"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          If no location is selected, we&apos;ll auto-create one from this name.
        </p>
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
    </>
  );
}
