"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  FileText,
  Clock,
  Users,
  Package,
  Image as ImageIcon,
  Trash2,
  Edit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatScenePages } from "@/lib/utils/page-eighths";
import type { Scene } from "@/lib/actions/scenes";
import type { CastMember } from "@/lib/types";

interface SceneCardProps {
  scene: Scene;
  cast: CastMember[];
  onEdit?: (scene: Scene) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
  compact?: boolean;
}

export function SceneCard({
  scene,
  cast,
  onEdit,
  onDelete,
  isDragging,
  compact = false,
}: SceneCardProps) {
  // Get cast count from joined data or fallback to filtering
  const sceneCastCount = scene.cast?.length || 0;
  const sceneElements = scene.elementDetails || [];

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-3 transition-all",
          isDragging && "shadow-lg ring-2 ring-primary"
        )}
      >
        {/* Placeholder */}
        <div className="aspect-video rounded-md bg-muted mb-2 overflow-hidden relative">
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <div className="absolute top-1 left-1">
            <Badge className="bg-black/70 text-white text-xs font-mono">
              {scene.sceneNumber}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Badge variant={scene.intExt === "INT" ? "int" : "ext"} className="text-[10px] px-1">
              {scene.intExt}
            </Badge>
            <Badge variant={scene.dayNight === "DAY" ? "day" : "night"} className="text-[10px] px-1">
              {scene.dayNight}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{scene.synopsis || "No synopsis"}</p>
          {sceneElements.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {sceneElements.slice(0, 2).map((element) => (
                <Badge key={element.id} variant="secondary" className="text-[10px] px-1 py-0">
                  {element.name}
                </Badge>
              ))}
              {sceneElements.length > 2 && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  +{sceneElements.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden transition-all group",
        isDragging && "shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-32 md:w-40 flex-shrink-0 bg-muted relative">
          <div className="w-full h-full flex items-center justify-center aspect-video">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <div className="absolute top-2 left-2">
            <Badge className="bg-black/70 text-white font-mono">
              {scene.sceneNumber}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={scene.intExt === "INT" ? "int" : "ext"} className="text-[10px]">
                  {scene.intExt}
                </Badge>
                <Badge variant={scene.dayNight === "DAY" ? "day" : "night"} className="text-[10px]">
                  {scene.dayNight}
                </Badge>
                {scene.location && (
                  <span className="text-xs text-muted-foreground">{scene.location.name}</span>
                )}
              </div>
              <p className="text-sm mt-1 line-clamp-2">{scene.synopsis || "No synopsis"}</p>
            </div>
            <Badge
              variant={
                scene.status === "COMPLETED"
                  ? "wrapped"
                  : scene.status === "SCHEDULED"
                  ? "scheduled"
                  : "secondary"
              }
              className="flex-shrink-0"
            >
              {scene.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {formatScenePages(scene)}p
            </span>
            {scene.estimatedMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {scene.estimatedMinutes}m
              </span>
            )}
            {sceneCastCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {sceneCastCount}
              </span>
            )}
            {sceneElements.length > 0 && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {sceneElements.length}
              </span>
            )}
          </div>
          {sceneElements.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sceneElements.slice(0, 4).map((element) => (
                <Badge key={element.id} variant="secondary" className="text-[10px]">
                  {element.name}
                </Badge>
              ))}
              {sceneElements.length > 4 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{sceneElements.length - 4} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(scene)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(scene.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sortable wrapper for drag and drop
export function SortableSceneCard({
  scene,
  cast,
  onEdit,
  onDelete,
  compact,
}: SceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "z-50")}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-muted/50 to-transparent rounded-l-lg"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <SceneCard
        scene={scene}
        cast={cast}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
        compact={compact}
      />
    </div>
  );
}
