"use client";

import * as React from "react";
import { Building, Clock, Save, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ShootingDay } from "@/lib/mock-data";

interface DepartmentCallTimesEditorProps {
  shootingDay: ShootingDay;
  onUpdate?: (
    shootingDayId: string,
    deptTimes: Array<{
      department: string;
      callTime: string;
      notes?: string;
    }>
  ) => Promise<void>;
}

interface DepartmentCallTime {
  department: string;
  callTime: string;
  notes: string;
}

const DEFAULT_DEPARTMENTS = [
  { id: "production", name: "Production", defaultOffset: 0 },
  { id: "camera", name: "Camera", defaultOffset: 0 },
  { id: "grip", name: "Grip", defaultOffset: 0 },
  { id: "electric", name: "Electric", defaultOffset: 0 },
  { id: "sound", name: "Sound", defaultOffset: 0 },
  { id: "art", name: "Art Department", defaultOffset: -30 },
  { id: "wardrobe", name: "Wardrobe", defaultOffset: -30 },
  { id: "hair_makeup", name: "Hair & Makeup", defaultOffset: -60 },
  { id: "locations", name: "Locations", defaultOffset: -60 },
  { id: "transportation", name: "Transportation", defaultOffset: -30 },
  { id: "catering", name: "Catering", defaultOffset: -60 },
];

function addMinutesToTime(time: string, minutes: number): string {
  if (!time) return "";
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`;
}

export function DepartmentCallTimesEditor({
  shootingDay,
  onUpdate,
}: DepartmentCallTimesEditorProps) {
  const [deptTimes, setDeptTimes] = React.useState<DepartmentCallTime[]>([]);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showAddDept, setShowAddDept] = React.useState(false);
  const [newDeptName, setNewDeptName] = React.useState("");

  // Initialize department times with defaults
  React.useEffect(() => {
    const generalCall = shootingDay.generalCall || shootingDay.crewCall || "07:00";
    const initial = DEFAULT_DEPARTMENTS.map((dept) => ({
      department: dept.name,
      callTime: addMinutesToTime(generalCall, dept.defaultOffset),
      notes: "",
    }));
    setDeptTimes(initial);
    setHasChanges(false);
  }, [shootingDay.generalCall, shootingDay.crewCall]);

  const updateDeptTime = (
    index: number,
    field: keyof DepartmentCallTime,
    value: string
  ) => {
    setDeptTimes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const removeDept = (index: number) => {
    setDeptTimes((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addCustomDept = () => {
    if (!newDeptName.trim()) return;
    setDeptTimes((prev) => [
      ...prev,
      {
        department: newDeptName.trim(),
        callTime: shootingDay.generalCall || "07:00",
        notes: "",
      },
    ]);
    setNewDeptName("");
    setShowAddDept(false);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const times = deptTimes
        .filter((dt) => dt.callTime) // Only save departments with call times
        .map((dt) => ({
          department: dt.department,
          callTime: dt.callTime,
          notes: dt.notes || undefined,
        }));
      await onUpdate?.(shootingDay.id, times);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const setAllToGeneralCall = () => {
    const generalCall = shootingDay.generalCall || "07:00";
    setDeptTimes((prev) =>
      prev.map((dt) => ({ ...dt, callTime: generalCall }))
    );
    setHasChanges(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {deptTimes.length} department{deptTimes.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={setAllToGeneralCall}
          >
            <Clock className="h-4 w-4 mr-1" />
            Reset All
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Department List */}
      <div className="space-y-2">
        {deptTimes.map((dept, index) => (
          <div
            key={`${dept.department}-${index}`}
            className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card"
          >
            {/* Department Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-sm truncate">
                  {dept.department}
                </span>
              </div>
            </div>

            {/* Call Time */}
            <div className="w-28">
              <Input
                type="time"
                value={dept.callTime}
                onChange={(e) =>
                  updateDeptTime(index, "callTime", e.target.value)
                }
                className="text-sm"
              />
            </div>

            {/* Notes */}
            <div className="w-32">
              <Input
                type="text"
                value={dept.notes}
                onChange={(e) => updateDeptTime(index, "notes", e.target.value)}
                placeholder="Notes"
                className="text-sm"
              />
            </div>

            {/* Remove Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={() => removeDept(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Custom Department */}
      {showAddDept ? (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-border">
          <Input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="Department name"
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustomDept();
              if (e.key === "Escape") {
                setShowAddDept(false);
                setNewDeptName("");
              }
            }}
          />
          <Button size="sm" onClick={addCustomDept} disabled={!newDeptName.trim()}>
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddDept(false);
              setNewDeptName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddDept(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Custom Department
        </Button>
      )}

      {/* Quick Reference */}
      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">General Call:</strong>{" "}
        {shootingDay.generalCall || "Not set"}
        {shootingDay.crewCall && (
          <>
            {" · "}
            <strong className="text-foreground">Crew Call:</strong>{" "}
            {shootingDay.crewCall}
          </>
        )}
      </div>
    </div>
  );
}
