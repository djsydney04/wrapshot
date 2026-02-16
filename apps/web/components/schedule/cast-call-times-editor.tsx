"use client";

import * as React from "react";
import { Users, Clock, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import type { ShootingDay, Scene, CastMember } from "@/lib/types";

interface CastCallTimesEditorProps {
  shootingDay: ShootingDay;
  scenes: Scene[];
  cast: CastMember[];
  onUpdate?: (
    shootingDayId: string,
    castTimes: Array<{
      castMemberId: string;
      workStatus: string;
      pickupTime?: string;
      muHairCall?: string;
      onSetCall?: string;
      remarks?: string;
    }>
  ) => Promise<void>;
}

interface CastCallTime {
  castMemberId: string;
  workStatus: "W" | "SW" | "WF" | "SWF" | "H" | "R" | "T" | "WD";
  pickupTime: string;
  muHairCall: string;
  onSetCall: string;
  remarks: string;
}

const WORK_STATUS_OPTIONS = [
  { value: "W", label: "W - Work" },
  { value: "SW", label: "SW - Start Work" },
  { value: "WF", label: "WF - Work Finish" },
  { value: "SWF", label: "SWF - Start Work Finish" },
  { value: "H", label: "H - Hold" },
  { value: "R", label: "R - Rehearse" },
  { value: "T", label: "T - Travel" },
  { value: "WD", label: "WD - Work Drop" },
];

const WORK_STATUS_BADGES: Record<string, string> = {
  W: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  SW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  WF: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SWF: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  H: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  R: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  T: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  WD: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function CastCallTimesEditor({
  shootingDay,
  scenes,
  cast,
  onUpdate,
}: CastCallTimesEditorProps) {
  const [castTimes, setCastTimes] = React.useState<Record<string, CastCallTime>>(
    {}
  );
  const [hasChanges, setHasChanges] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Get cast members from scenes
  const sceneCastIds = React.useMemo(() => {
    const ids = new Set<string>();
    scenes.forEach((scene) => {
      scene.castIds?.forEach((id) => ids.add(id));
    });
    return ids;
  }, [scenes]);

  const dayCast = React.useMemo(() => {
    return cast.filter((c) => sceneCastIds.has(c.id));
  }, [cast, sceneCastIds]);

  // Initialize cast times
  React.useEffect(() => {
    const initial: Record<string, CastCallTime> = {};
    dayCast.forEach((member) => {
      initial[member.id] = {
        castMemberId: member.id,
        workStatus: "W",
        pickupTime: "",
        muHairCall: "",
        onSetCall: shootingDay.talentCall || shootingDay.generalCall || "",
        remarks: "",
      };
    });
    setCastTimes(initial);
    setHasChanges(false);
  }, [dayCast, shootingDay.talentCall, shootingDay.generalCall]);

  const updateCastTime = (
    memberId: string,
    field: keyof CastCallTime,
    value: string
  ) => {
    setCastTimes((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const times = Object.values(castTimes).map((ct) => ({
        castMemberId: ct.castMemberId,
        workStatus: ct.workStatus,
        pickupTime: ct.pickupTime || undefined,
        muHairCall: ct.muHairCall || undefined,
        onSetCall: ct.onSetCall || undefined,
        remarks: ct.remarks || undefined,
      }));
      await onUpdate?.(shootingDay.id, times);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (dayCast.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg px-4 py-8 text-center">
        <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No cast assigned to scenes</p>
        <p className="text-xs text-muted-foreground mt-1">
          Assign scenes with cast members to set call times
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {dayCast.length} cast member{dayCast.length !== 1 ? "s" : ""}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Cast List */}
      <div className="space-y-3">
        {dayCast.map((member) => {
          const times = castTimes[member.id];
          if (!times) return null;

          return (
            <div
              key={member.id}
              className="border border-border rounded-lg p-3 space-y-3"
            >
              {/* Cast Member Header */}
              <div className="flex items-center gap-3">
                <Avatar
                  alt={member.actorName || member.characterName}
                  fallback={getInitials(member.actorName || member.characterName)}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {member.castNumber && (
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium">
                        {member.castNumber}
                      </span>
                    )}
                    <span className="font-medium text-sm truncate">
                      {member.characterName}
                    </span>
                  </div>
                  {member.actorName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {member.actorName}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    WORK_STATUS_BADGES[times.workStatus]
                  )}
                >
                  {times.workStatus}
                </span>
              </div>

              {/* Work Status & Times */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Work Status
                  </label>
                  <Select
                    value={times.workStatus}
                    onChange={(e) =>
                      updateCastTime(
                        member.id,
                        "workStatus",
                        e.target.value as CastCallTime["workStatus"]
                      )
                    }
                    options={WORK_STATUS_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    On-Set Call
                  </label>
                  <Input
                    type="time"
                    value={times.onSetCall}
                    onChange={(e) =>
                      updateCastTime(member.id, "onSetCall", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Pickup Time
                  </label>
                  <Input
                    type="time"
                    value={times.pickupTime}
                    onChange={(e) =>
                      updateCastTime(member.id, "pickupTime", e.target.value)
                    }
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    MU/Hair Call
                  </label>
                  <Input
                    type="time"
                    value={times.muHairCall}
                    onChange={(e) =>
                      updateCastTime(member.id, "muHairCall", e.target.value)
                    }
                    placeholder="—"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Remarks
                </label>
                <Input
                  type="text"
                  value={times.remarks}
                  onChange={(e) =>
                    updateCastTime(member.id, "remarks", e.target.value)
                  }
                  placeholder="Optional notes..."
                  className="text-sm"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
