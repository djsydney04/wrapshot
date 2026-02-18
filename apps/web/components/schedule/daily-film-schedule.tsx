"use client";

import * as React from "react";
import { Clock3, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildDailyFilmSchedule } from "@/lib/schedule/film-day";
import type { ShootingDay } from "@/lib/types";

interface DailyFilmScheduleProps {
  shootingDay?: Partial<ShootingDay> | null;
  sceneCount?: number;
  title?: string;
  description?: string;
  className?: string;
}

const ITEM_STYLES = {
  default: "border-border/70 bg-background",
  accent: "border-blue-200/70 bg-blue-50/60 dark:border-blue-800/60 dark:bg-blue-950/20",
  break: "border-amber-200/70 bg-amber-50/70 dark:border-amber-800/50 dark:bg-amber-950/20",
  wrap: "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/20",
} as const;

export function DailyFilmSchedule({
  shootingDay,
  sceneCount = 0,
  title = "Daily Film Schedule",
  description = "Film-standard run-of-day with call times, meal checkpoint, and wrap.",
  className,
}: DailyFilmScheduleProps) {
  const { items, mealWithinSixHours } = React.useMemo(
    () => buildDailyFilmSchedule(shootingDay, sceneCount),
    [shootingDay, sceneCount]
  );

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Film className="h-4 w-4 text-muted-foreground" />
            {title}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            mealWithinSixHours
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          )}
        >
          {mealWithinSixHours ? "Meal within 6h" : "Meal timing check"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[72px_1fr] gap-2 items-start">
            <div className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground pt-2">
              <Clock3 className="h-3 w-3" />
              {item.time}
            </div>
            <div
              className={cn(
                "rounded-md border px-3 py-2",
                ITEM_STYLES[item.tone ?? "default"]
              )}
            >
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
