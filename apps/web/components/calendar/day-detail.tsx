"use client";

import * as React from "react";
import { format } from "date-fns";
import { X, Clock, Film, Users, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ShootingDay, Scene } from "@/lib/mock-data";

interface DayDetailPanelProps {
  date: Date;
  shootingDays: ShootingDay[];
  scenes: Scene[];
  onClose: () => void;
  className?: string;
}

export function DayDetailPanel({
  date,
  shootingDays,
  scenes,
  onClose,
  className,
}: DayDetailPanelProps) {
  const getSceneDetails = (sceneIds: string[]) => {
    return scenes.filter((s) => sceneIds.includes(s.id));
  };

  const getStatusColor = (status: ShootingDay["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "production";
      case "CONFIRMED":
        return "pre-production";
      case "SCHEDULED":
        return "development";
      default:
        return "secondary";
    }
  };

  return (
    <div
      className={cn(
        "w-[360px] border-l border-border bg-background overflow-auto",
        className
      )}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div>
          <h3 className="font-medium">
            {format(date, "EEEE, MMMM d")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {shootingDays.length} shooting day{shootingDays.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4">
        {shootingDays.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No shooting scheduled for this day
            </p>
            <Button variant="outline" size="sm" className="mt-4">
              Add Shooting Day
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {shootingDays.map((day) => {
              const dayScenes = getSceneDetails(day.scenes);

              return (
                <div
                  key={day.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Day {day.dayNumber}</h4>
                        <Badge variant={day.unit === "MAIN" ? "default" : "secondary"}>
                          {day.unit}
                        </Badge>
                      </div>
                      <Badge variant={getStatusColor(day.status) as any} className="mt-1">
                        {day.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Call: {day.generalCall}</span>
                    </div>
                  </div>

                  {day.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {day.notes}
                    </p>
                  )}

                  {dayScenes.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div>
                        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          Scenes ({dayScenes.length})
                        </h5>
                        <div className="space-y-2">
                          {dayScenes.map((scene) => (
                            <div
                              key={scene.id}
                              className="rounded bg-muted/50 p-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium">
                                  {scene.sceneNumber}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Badge variant={scene.intExt === "INT" ? "int" : "ext"} className="text-[10px] px-1">
                                    {scene.intExt}
                                  </Badge>
                                  <Badge variant={scene.dayNight === "DAY" ? "day" : "night"} className="text-[10px] px-1">
                                    {scene.dayNight}
                                  </Badge>
                                </div>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {scene.synopsis}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{scene.location}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
