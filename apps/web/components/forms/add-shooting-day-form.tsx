"use client";

import * as React from "react";
import { format } from "date-fns";
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
import { createShootingDay, updateShootingDay } from "@/lib/actions/shooting-days";
import type { ShootingDay } from "@/lib/mock-data";

interface AddShootingDayFormProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onSuccess?: () => void;
  useMockData?: boolean;
  // Edit mode props
  editingDay?: ShootingDay | null;
}

export function AddShootingDayForm({
  projectId,
  open,
  onOpenChange,
  defaultDate,
  onSuccess,
  useMockData = true,
  editingDay,
}: AddShootingDayFormProps) {
  const {
    addShootingDay: addShootingDayToStore,
    updateShootingDay: updateShootingDayInStore,
    getShootingDaysForProject,
    getScenesForProject,
  } = useProjectStore();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existingDays = getShootingDaysForProject(projectId);
  const scenes = getScenesForProject(projectId);

  const isEditMode = !!editingDay;

  const getInitialFormData = () => ({
    date: editingDay
      ? editingDay.date
      : defaultDate
      ? format(defaultDate, "yyyy-MM-dd")
      : "",
    unit: (editingDay?.unit || "MAIN") as "MAIN" | "SECOND",
    status: (editingDay?.status || "TENTATIVE") as
      | "TENTATIVE"
      | "SCHEDULED"
      | "CONFIRMED"
      | "COMPLETED"
      | "CANCELLED",
    generalCall: editingDay?.generalCall || "07:00",
    wrapTime: editingDay?.wrapTime || editingDay?.expectedWrap || "19:00",
    crewCall: editingDay?.crewCall || "06:30",
    talentCall: editingDay?.talentCall || "08:00",
    lunchTime: editingDay?.lunchTime || "12:30",
    notes: editingDay?.notes || "",
    selectedScenes: editingDay?.scenes || ([] as string[]),
  });

  const [formData, setFormData] = React.useState(getInitialFormData);

  // Reset form when editingDay changes
  React.useEffect(() => {
    setFormData(getInitialFormData());
    setError(null);
  }, [editingDay, defaultDate]);

  // Update date when defaultDate changes (for add mode only)
  React.useEffect(() => {
    if (defaultDate && !isEditMode) {
      setFormData((prev) => ({
        ...prev,
        date: format(defaultDate, "yyyy-MM-dd"),
      }));
    }
  }, [defaultDate, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && editingDay) {
        // Update existing shooting day
        if (useMockData) {
          updateShootingDayInStore(editingDay.id, {
            date: formData.date,
            unit: formData.unit,
            status: formData.status,
            generalCall: formData.generalCall,
            wrapTime: formData.wrapTime || undefined,
            crewCall: formData.crewCall || undefined,
            talentCall: formData.talentCall || undefined,
            lunchTime: formData.lunchTime || undefined,
            scenes: formData.selectedScenes,
            notes: formData.notes || undefined,
          });
        } else {
          const result = await updateShootingDay(editingDay.id, {
            date: formData.date,
            unit: formData.unit,
            status: formData.status,
            generalCall: formData.generalCall,
            estimatedWrap: formData.wrapTime || undefined,
            scenes: formData.selectedScenes,
            notes: formData.notes || undefined,
          });

          if (result.error) {
            throw new Error(result.error);
          }
        }
      } else {
        // Create new shooting day
        const nextDayNumber = existingDays.length + 1;

        if (useMockData) {
          addShootingDayToStore({
            projectId,
            date: formData.date,
            dayNumber: nextDayNumber,
            unit: formData.unit,
            status: formData.status,
            generalCall: formData.generalCall,
            wrapTime: formData.wrapTime || undefined,
            crewCall: formData.crewCall || undefined,
            talentCall: formData.talentCall || undefined,
            lunchTime: formData.lunchTime || undefined,
            scenes: formData.selectedScenes,
            notes: formData.notes || undefined,
          });
        } else {
          const result = await createShootingDay({
            projectId,
            date: formData.date,
            dayNumber: nextDayNumber,
            unit: formData.unit,
            status: formData.status,
            generalCall: formData.generalCall,
            estimatedWrap: formData.wrapTime || undefined,
            scenes: formData.selectedScenes,
            notes: formData.notes || undefined,
          });

          if (result.error) {
            throw new Error(result.error);
          }
        }
      }

      // Reset form
      setFormData({
        date: "",
        unit: "MAIN",
        status: "TENTATIVE",
        generalCall: "07:00",
        wrapTime: "19:00",
        crewCall: "06:30",
        talentCall: "08:00",
        lunchTime: "12:30",
        notes: "",
        selectedScenes: [],
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? "update" : "create"} shooting day`
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleScene = (sceneId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedScenes: prev.selectedScenes.includes(sceneId)
        ? prev.selectedScenes.filter((id) => id !== sceneId)
        : [...prev.selectedScenes, sceneId],
    }));
  };

  // Calculate estimated duration
  const getDuration = () => {
    if (!formData.generalCall || !formData.wrapTime) return null;

    const [startHours, startMinutes] = formData.generalCall.split(":").map(Number);
    const [endHours, endMinutes] = formData.wrapTime.split(":").map(Number);

    let startTotal = startHours * 60 + startMinutes;
    let endTotal = endHours * 60 + endMinutes;

    // Handle overnight shoots (wrap time is next day)
    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    const diff = endTotal - startTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? `Edit Day ${editingDay?.dayNumber}`
              : "Add Shooting Day"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the details for this shooting day"
              : "Schedule a new shooting day for your production"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Date *
                </label>
                <Input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Unit</label>
                  <Select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unit: e.target.value as typeof formData.unit,
                      })
                    }
                    options={[
                      { value: "MAIN", label: "Main" },
                      { value: "SECOND", label: "Second" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Status
                  </label>
                  <Select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as typeof formData.status,
                      })
                    }
                    options={[
                      { value: "TENTATIVE", label: "Tentative" },
                      { value: "SCHEDULED", label: "Scheduled" },
                      { value: "CONFIRMED", label: "Confirmed" },
                      ...(isEditMode
                        ? [
                            { value: "COMPLETED", label: "Completed" },
                            { value: "CANCELLED", label: "Cancelled" },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Call Times Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Call Times</h4>
                {getDuration() && (
                  <span className="text-xs text-muted-foreground">
                    Duration: {getDuration()}
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    General Call *
                  </label>
                  <Input
                    type="time"
                    required
                    value={formData.generalCall}
                    onChange={(e) =>
                      setFormData({ ...formData, generalCall: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Expected Wrap
                  </label>
                  <Input
                    type="time"
                    value={formData.wrapTime}
                    onChange={(e) =>
                      setFormData({ ...formData, wrapTime: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Crew Call
                  </label>
                  <Input
                    type="time"
                    value={formData.crewCall}
                    onChange={(e) =>
                      setFormData({ ...formData, crewCall: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Talent Call
                  </label>
                  <Input
                    type="time"
                    value={formData.talentCall}
                    onChange={(e) =>
                      setFormData({ ...formData, talentCall: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Lunch
                  </label>
                  <Input
                    type="time"
                    value={formData.lunchTime}
                    onChange={(e) =>
                      setFormData({ ...formData, lunchTime: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Scene Selection */}
            {scenes.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Scenes to Shoot
                </label>
                <div className="border border-border rounded-md max-h-40 overflow-auto">
                  {scenes.map((scene) => (
                    <label
                      key={scene.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedScenes.includes(scene.id)}
                        onChange={() => toggleScene(scene.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            Scene {scene.sceneNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {scene.intExt} • {scene.dayNight}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {scene.pageCount} pg
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {scene.synopsis}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {formData.selectedScenes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.selectedScenes.length} scene
                    {formData.selectedScenes.length !== 1 ? "s" : ""} selected
                    {" • "}
                    {scenes
                      .filter((s) => formData.selectedScenes.includes(s.id))
                      .reduce((sum, s) => sum + s.pageCount, 0)
                      .toFixed(2)}{" "}
                    pages
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Any special notes for this shooting day..."
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
              {loading
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                ? "Save Changes"
                : "Add Shooting Day"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
