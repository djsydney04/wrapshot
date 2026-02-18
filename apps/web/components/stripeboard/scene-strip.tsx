"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Clock, Users, ChevronDown, ChevronUp, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene } from "@/lib/actions/scenes";

export type SceneStripSize = "compact" | "comfortable" | "expanded";

interface SceneStripProps {
  scene: Scene;
  onClick?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  isDragging?: boolean;
  layout?: "strip" | "list";
  sceneSize?: SceneStripSize;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
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
      sceneSize = "comfortable",
      isExpanded = false,
      onToggleExpand,
      className,
      style,
      dragHandleProps,
      sortableProps,
    },
    ref
  ) => {
    const stripColor = getStripColor(scene.intExt, scene.dayNight);
    const castCount = scene.cast?.length || 0;
    const sceneElements = scene.elementDetails || [];
    const locationName = scene.location?.name || scene.setName || "No location";
    const hasExpandableContent = Boolean(scene.synopsis || scene.notes);

    const listSizeClasses: Record<SceneStripSize, string> = {
      compact: "px-3 py-2",
      comfortable: "px-4 py-3",
      expanded: "px-4 py-4",
    };

    if (layout === "list") {
      return (
        <div
          ref={ref}
          style={style}
          {...sortableProps}
          className={cn(
            "rounded-lg border-2 transition-all cursor-pointer",
            listSizeClasses[sceneSize],
            stripColor,
            isSelected && "ring-2 ring-primary ring-offset-2",
            isDragging && "opacity-50 shadow-lg",
            className
          )}
          onClick={onClick}
        >
          <div className="flex items-center gap-3">
            <span
              {...dragHandleProps}
              className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </span>

            <span className="font-mono font-bold text-lg w-12 text-center">
              {scene.sceneNumber}
            </span>

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

            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{locationName}</p>
              {scene.synopsis && (
                <p
                  className={cn(
                    "text-xs text-muted-foreground mt-0.5",
                    isExpanded ? "whitespace-pre-wrap" : "line-clamp-1"
                  )}
                >
                  {scene.synopsis}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {castCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {castCount}
                </span>
              )}
              {sceneElements.length > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {sceneElements.length}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {scene.pageEighths ? `${scene.pageEighths}/8` : `${scene.pageCount} pg`}
              </span>
            </div>

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

            {hasExpandableContent && onToggleExpand && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="text-muted-foreground"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}

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

          {isExpanded && scene.notes && (
            <div className="mt-2 rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              {scene.notes}
            </div>
          )}

          {isExpanded && sceneElements.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1 px-0.5">
              {sceneElements.map((element) => (
                <Badge key={element.id} variant="secondary" className="text-[10px]">
                  {element.name}
                  {element.taskType ? ` • ${element.taskType.replace("_", " ")}` : ""}
                  {element.assignedCrew?.name ? ` • ${element.assignedCrew.name}` : ""}
                </Badge>
              ))}
            </div>
          )}

        </div>
      );
    }

    const stripSizeClasses: Record<SceneStripSize, string> = {
      compact: "px-2 py-1.5",
      comfortable: "px-2.5 py-2",
      expanded: "px-3 py-2.5",
    };

    const stripTextClasses: Record<SceneStripSize, string> = {
      compact: "text-[11px]",
      comfortable: "text-xs",
      expanded: "text-sm",
    };

    // Strip layout (for stripeboard scheduling)
    return (
      <div
        ref={ref}
        style={style}
        {...sortableProps}
        className={cn(
          "flex items-center gap-2 rounded border-2 transition-all cursor-pointer",
          stripSizeClasses[sceneSize],
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
      <span className={cn("flex-1 truncate", stripTextClasses[sceneSize])}>{locationName}</span>

      {/* Page Count */}
      {sceneElements.length > 0 && (
        <span
          className={cn(
            "flex items-center gap-0.5 text-muted-foreground",
            sceneSize === "expanded" ? "text-xs" : "text-[10px]"
          )}
        >
          <Package className="h-3 w-3" />
          {sceneElements.length}
        </span>
      )}
      <span className={cn("text-muted-foreground", sceneSize === "expanded" ? "text-xs" : "text-[10px]")}>
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
