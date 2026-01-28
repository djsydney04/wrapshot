"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, FileText, Users, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scene, CastMember, ShootingDay } from "@/lib/mock-data";

interface SceneTimelineProps {
  scenes: Scene[];
  cast: CastMember[];
  shootingDays: ShootingDay[];
  onReorder: (sceneIds: string[]) => void;
  onEdit?: (scene: Scene) => void;
}

export function SceneTimeline({
  scenes,
  cast,
  shootingDays,
  onReorder,
  onEdit,
}: SceneTimelineProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth);
    }
  };

  React.useEffect(() => {
    updateScrollButtons();
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener("scroll", updateScrollButtons);
      return () => ref.removeEventListener("scroll", updateScrollButtons);
    }
  }, [scenes.length]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(scenes, oldIndex, newIndex);
      onReorder(newOrder.map((s) => s.id));
    }
  };

  // Group scenes by shooting day
  const scheduledScenes = new Set(shootingDays.flatMap((d) => d.scenes));
  const unscheduledScenes = scenes.filter((s) => !scheduledScenes.has(s.id));

  return (
    <div className="relative">
      {/* Scroll Buttons */}
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 shadow-lg"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Timeline */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pb-4"
          >
            {/* Shooting Days Row */}
            {shootingDays.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  By Shooting Day
                </h4>
                <div className="flex gap-4">
                  {shootingDays
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((day) => {
                      const dayScenes = scenes.filter((s) => day.scenes.includes(s.id));
                      if (dayScenes.length === 0) return null;

                      return (
                        <div key={day.id} className="flex-shrink-0">
                          <div className="px-2 py-1 mb-2 bg-muted rounded-md">
                            <span className="text-xs font-medium">Day {day.dayNumber}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {dayScenes.map((scene) => (
                              <TimelineCard
                                key={scene.id}
                                scene={scene}
                                cast={cast}
                                onEdit={onEdit}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Unscheduled Scenes */}
            {unscheduledScenes.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
                  Unscheduled ({unscheduledScenes.length})
                </h4>
                <div className="flex gap-2">
                  {unscheduledScenes.map((scene) => (
                    <TimelineCard
                      key={scene.id}
                      scene={scene}
                      cast={cast}
                      onEdit={onEdit}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Scenes (fallback if no shooting days) */}
            {shootingDays.length === 0 && unscheduledScenes.length === 0 && (
              <div className="flex gap-2">
                {scenes.map((scene) => (
                  <TimelineCard
                    key={scene.id}
                    scene={scene}
                    cast={cast}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function TimelineCard({
  scene,
  cast,
  onEdit,
}: {
  scene: Scene;
  cast: CastMember[];
  onEdit?: (scene: Scene) => void;
}) {
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

  const sceneCast = cast.filter((c) => scene.castIds.includes(c.id));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "flex-shrink-0 w-36 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
      onClick={() => onEdit?.(scene)}
    >
      <div
        className={cn(
          "rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors",
          isDragging && "shadow-lg ring-2 ring-primary"
        )}
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-muted relative">
          {scene.imageUrl ? (
            <img
              src={scene.imageUrl}
              alt={`Scene ${scene.sceneNumber}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute top-1 left-1">
            <Badge className="bg-black/70 text-white text-xs font-mono">
              {scene.sceneNumber}
            </Badge>
          </div>
          <div className="absolute top-1 right-1 flex gap-0.5">
            <Badge variant={scene.intExt === "INT" ? "int" : "ext"} className="text-[10px] px-1">
              {scene.intExt}
            </Badge>
            <Badge variant={scene.dayNight === "DAY" ? "day" : "night"} className="text-[10px] px-1">
              {scene.dayNight}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-2">
          <p className="text-xs line-clamp-2 text-muted-foreground">{scene.synopsis}</p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <FileText className="h-2.5 w-2.5" />
              {scene.pageCount}p
            </span>
            {sceneCast.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />
                {sceneCast.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
