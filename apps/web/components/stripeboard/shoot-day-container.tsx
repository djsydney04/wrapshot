"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SortableSceneStrip } from "./scene-strip";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";
import type { ShootingDay } from "@/lib/types";
import type { SceneStripSize } from "./scene-strip";

interface ShootDayContainerProps {
  shootingDay: ShootingDay;
  scenes: Scene[];
  onSceneClick?: (sceneId: string) => void;
  selectedSceneId?: string | null;
  activeId?: string | null;
  isSaving?: boolean;
  sceneSize?: SceneStripSize;
}

const STATUS_COLORS: Record<ShootingDay["status"], string> = {
  COMPLETED: "bg-emerald-500",
  CONFIRMED: "bg-blue-500",
  SCHEDULED: "bg-amber-500",
  TENTATIVE: "bg-neutral-400",
  CANCELLED: "bg-red-400",
};

export function ShootDayContainer({
  shootingDay,
  scenes,
  onSceneClick,
  selectedSceneId,
  activeId,
  isSaving,
  sceneSize = "comfortable",
}: ShootDayContainerProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${shootingDay.id}`,
    data: { shootingDayId: shootingDay.id, type: "shooting-day" },
  });

  // Dim non-target containers when dragging
  const isDimmed = activeId && !isOver;

  const totalPages = scenes.reduce(
    (sum, s) => sum + (s.pageEighths ? s.pageEighths / 8 : s.pageCount),
    0
  );

  const formattedDate = new Date(shootingDay.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border overflow-hidden transition-all duration-200",
        isOver && "ring-2 ring-primary bg-primary/5 scale-[1.01]",
        isDimmed && "opacity-60"
      )}
    >
      {/* Day Header */}
      <div
        className={cn(
          "px-4 py-3 text-white flex items-center justify-between",
          STATUS_COLORS[shootingDay.status]
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">Day {shootingDay.dayNumber}</span>
            <Badge variant="secondary" className="text-[10px] bg-white/20 hover:bg-white/30 text-white border-0">
              {shootingDay.unit}
            </Badge>
          </div>
          <span className="text-sm opacity-80 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formattedDate}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 opacity-80">
            <Clock className="h-3.5 w-3.5" />
            {shootingDay.generalCall}
            {shootingDay.wrapTime && ` - ${shootingDay.wrapTime}`}
          </span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {scenes.length} scenes · {totalPages.toFixed(1)} pages
          </span>
        </div>
      </div>

      {/* Scenes */}
      <div className="p-2 space-y-1.5 min-h-[60px] bg-muted/30">
        {scenes.length > 0 ? (
          scenes.map((scene) => (
            <SortableSceneStrip
              key={scene.id}
              scene={scene}
              onClick={() => onSceneClick?.(scene.id)}
              isSelected={selectedSceneId === scene.id}
              layout="strip"
              sceneSize={sceneSize}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-12 border-2 border-dashed border-border rounded-lg">
            <p className="text-xs text-muted-foreground">Drop scenes here</p>
          </div>
        )}
      </div>

      {/* Footer Notes */}
      {shootingDay.notes && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <p className="text-xs text-muted-foreground">{shootingDay.notes}</p>
        </div>
      )}
    </div>
  );
}
