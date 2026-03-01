"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Calendar, Clock, Loader2, Focus, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableSceneStrip } from "./scene-strip";
import { cn } from "@/lib/utils";
import { formatPageEighths, sumPageEighths } from "@/lib/utils/page-eighths";
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
  collapsed?: boolean;
  focused?: boolean;
  onToggleCollapsed?: () => void;
  onToggleFocused?: () => void;
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
  collapsed = false,
  focused = false,
  onToggleCollapsed,
  onToggleFocused,
}: ShootDayContainerProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${shootingDay.id}`,
    data: { shootingDayId: shootingDay.id, type: "shooting-day" },
  });

  // Dim non-target containers when dragging
  const isDimmed = activeId && !isOver;

  const totalPageEighths = sumPageEighths(scenes);

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
          "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-white",
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

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            {onToggleFocused && (
              <Button
                type="button"
                variant={focused ? "secondary" : "ghost"}
                size="sm"
                className="h-7 bg-white/20 px-2 text-white hover:bg-white/30 hover:text-white"
                onClick={onToggleFocused}
              >
                <Focus className="h-3.5 w-3.5" />
                {focused ? "Focused" : "Focus"}
              </Button>
            )}
            {onToggleCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 bg-white/20 px-2 text-white hover:bg-white/30 hover:text-white"
                onClick={onToggleCollapsed}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {collapsed ? "Expand" : "Collapse"}
              </Button>
            )}
          </div>
          <span className="flex max-w-[250px] items-center gap-1 truncate opacity-80">
            <Clock className="h-3.5 w-3.5" />
            {shootingDay.generalCall}
            {shootingDay.wrapTime && ` - ${shootingDay.wrapTime}`}
          </span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {scenes.length} scenes · {formatPageEighths(totalPageEighths)} pages
          </span>
        </div>
      </div>

      {/* Scenes */}
      {!collapsed && (
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
      )}

      {/* Footer Notes */}
      {shootingDay.notes && !collapsed && (
        <div className="px-4 py-2 bg-muted/50 border-t border-border">
          <p className="text-xs text-muted-foreground">{shootingDay.notes}</p>
        </div>
      )}
    </div>
  );
}
