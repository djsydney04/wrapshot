"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Clock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";

interface SceneStripProps {
  scene: Scene;
  onClick?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  isDragging?: boolean;
  layout?: "strip" | "list";
  className?: string;
  style?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  sortableProps?: React.HTMLAttributes<HTMLDivElement>;
}

// Industry standard strip colors based on INT/EXT and DAY/NIGHT
function getStripColor(intExt: string, dayNight: string) {
  const isInt = intExt === "INT";
  const timeOfDay = dayNight?.toUpperCase() || "DAY";

  // Day scenes
  if (["DAY", "MORNING", "AFTERNOON"].includes(timeOfDay)) {
    return isInt
      ? "bg-white border-gray-300 text-gray-900"
      : "bg-yellow-100 border-yellow-400 text-yellow-900";
  }

  // Night scenes
  if (["NIGHT", "EVENING"].includes(timeOfDay)) {
    return isInt
      ? "bg-blue-100 border-blue-400 text-blue-900"
      : "bg-green-100 border-green-400 text-green-900";
  }

  // Dawn/Dusk
  if (["DAWN", "DUSK"].includes(timeOfDay)) {
    return "bg-pink-100 border-pink-400 text-pink-900";
  }

  // Default
  return "bg-white border-gray-300 text-gray-900";
}

export const SceneStrip = React.forwardRef<HTMLDivElement, SceneStripProps>(
  (
    {
      scene,
      onClick,
      onDelete,
      isSelected = false,
      isDragging = false,
      layout = "strip",
      className,
      style,
      dragHandleProps,
      sortableProps,
    },
    ref
  ) => {

  const stripColor = getStripColor(scene.intExt, scene.dayNight);

  const castCount = scene.cast?.length || 0;
  const locationName = scene.location?.name || scene.setName || "No location";

    if (layout === "list") {
      return (
        <div
          ref={ref}
          style={style}
          {...sortableProps}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all cursor-pointer",
            stripColor,
            isSelected && "ring-2 ring-primary ring-offset-2",
            isDragging && "opacity-50 shadow-lg",
            className
          )}
          onClick={onClick}
        >
          <span
            {...dragHandleProps}
            className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </span>

        {/* Scene Number */}
        <span className="font-mono font-bold text-lg w-12 text-center">
          {scene.sceneNumber}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant={scene.intExt === "INT" ? "int" : "ext"}
            className="text-[10px] px-1.5 py-0"
          >
            {scene.intExt}
          </Badge>
          <Badge
            variant={
              ["DAY", "MORNING", "AFTERNOON"].includes(scene.dayNight)
                ? "day"
                : "night"
            }
            className="text-[10px] px-1.5 py-0"
          >
            {scene.dayNight}
          </Badge>
        </div>

        {/* Set Name */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{locationName}</p>
          {scene.synopsis && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {scene.synopsis}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {castCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {castCount}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {scene.pageEighths ? `${scene.pageEighths}/8` : `${scene.pageCount} pg`}
          </span>
        </div>

        {/* Status */}
        <Badge
          variant={
            scene.status === "COMPLETED"
              ? "success"
              : scene.status === "SCHEDULED"
              ? "default"
              : "secondary"
          }
          className="text-[10px]"
        >
          {scene.status.replace("_", " ")}
        </Badge>

        {/* Delete */}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      );
    }

  // Strip layout (compact, for stripeboard)
    return (
      <div
        ref={ref}
        style={style}
        {...sortableProps}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded border-2 transition-all cursor-pointer",
          stripColor,
          isSelected && "ring-2 ring-primary ring-offset-1",
          isDragging && "opacity-50 shadow-lg",
          className
        )}
        onClick={onClick}
      >
        <span
          {...dragHandleProps}
          className="h-3 w-3 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </span>

      {/* Scene Number */}
      <span className="font-mono font-bold text-xs w-8 text-center">
        {scene.sceneNumber}
      </span>

      {/* Badges */}
      <Badge
        variant={scene.intExt === "INT" ? "int" : "ext"}
        className="text-[8px] px-1 py-0"
      >
        {scene.intExt}
      </Badge>
      <Badge
        variant={
          ["DAY", "MORNING", "AFTERNOON"].includes(scene.dayNight)
            ? "day"
            : "night"
        }
        className="text-[8px] px-1 py-0"
      >
        {scene.dayNight}
      </Badge>

      {/* Set Name */}
      <span className="flex-1 text-[11px] truncate">{locationName}</span>

      {/* Page Count */}
      <span className="text-[10px] text-muted-foreground">
        {scene.pageEighths ? `${scene.pageEighths}/8` : `${scene.pageCount}pg`}
      </span>
      </div>
    );
  }
);

SceneStrip.displayName = "SceneStrip";

export function SortableSceneStrip(
  props: Omit<SceneStripProps, "dragHandleProps" | "isDragging"> & {
    disabled?: boolean;
  }
) {
  const { scene, disabled, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SceneStrip
      ref={setNodeRef}
      scene={scene}
      isDragging={isDragging}
      style={style}
      sortableProps={{ ...attributes, ...listeners }}
      dragHandleProps={{ ...attributes, ...listeners }}
      {...rest}
    />
  );
}
