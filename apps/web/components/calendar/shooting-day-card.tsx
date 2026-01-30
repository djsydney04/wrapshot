"use client";

import * as React from "react";
import { Clock, MapPin, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import type { ShootingDay, Scene, CastMember, Location } from "@/lib/mock-data";

interface ShootingDayCardProps {
  shootingDay: ShootingDay;
  scenes?: Scene[];
  cast?: CastMember[];
  locations?: Location[];
  variant?: "compact" | "expanded";
  onClick?: () => void;
  className?: string;
  isDragging?: boolean;
}

const STATUS_COLORS: Record<ShootingDay["status"], string> = {
  COMPLETED: "bg-emerald-500",
  CONFIRMED: "bg-blue-500",
  SCHEDULED: "bg-amber-500",
  TENTATIVE: "bg-neutral-400",
  CANCELLED: "bg-red-400",
};

const STATUS_BADGES: Record<ShootingDay["status"], string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SCHEDULED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  TENTATIVE: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function ShootingDayCard({
  shootingDay,
  scenes = [],
  cast = [],
  locations = [],
  variant = "compact",
  onClick,
  className,
  isDragging = false,
}: ShootingDayCardProps) {
  // Get scenes for this shooting day
  const dayScenes = scenes.filter((s) => shootingDay.scenes.includes(s.id));

  // Get total pages
  const totalPages = dayScenes.reduce((sum, s) => sum + s.pageCount, 0);

  // Get unique cast from scenes
  const castIds = new Set(dayScenes.flatMap((s) => s.castIds || []));
  const dayCast = cast.filter((c) => castIds.has(c.id));

  // Get location
  const location = shootingDay.locationId
    ? locations.find((l) => l.id === shootingDay.locationId)
    : null;

  // Format time range
  const formatTimeRange = () => {
    const start = shootingDay.generalCall;
    const end = shootingDay.wrapTime || shootingDay.expectedWrap || "—";
    return `${start} – ${end}`;
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (variant === "compact") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full rounded px-1.5 py-0.5 text-left text-[11px] text-white font-medium truncate",
          "transition-all cursor-pointer",
          STATUS_COLORS[shootingDay.status],
          isDragging && "opacity-50 ring-2 ring-primary shadow-lg",
          className
        )}
      >
        <span className="font-semibold">Day {shootingDay.dayNumber}</span>
        {shootingDay.generalCall && (
          <span className="opacity-80 ml-1">· {shootingDay.generalCall}</span>
        )}
      </button>
    );
  }

  // Expanded variant
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg text-left cursor-pointer",
        "transition-all shadow-sm",
        "text-white",
        STATUS_COLORS[shootingDay.status],
        isDragging && "opacity-50 ring-2 ring-primary shadow-lg",
        className
      )}
    >
      <div className="px-2.5 py-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-sm">Day {shootingDay.dayNumber}</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              "bg-white/20"
            )}
          >
            {shootingDay.status}
          </span>
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-1 text-xs opacity-90 mb-1.5">
          <Clock className="h-3 w-3" />
          <span>{formatTimeRange()}</span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-[10px] opacity-80 mb-2">
          {dayScenes.length > 0 && (
            <span className="flex items-center gap-0.5">
              <FileText className="h-2.5 w-2.5" />
              {dayScenes.length} scene{dayScenes.length !== 1 ? "s" : ""}
            </span>
          )}
          {totalPages > 0 && (
            <span>{totalPages.toFixed(1)} pg</span>
          )}
          {dayCast.length > 0 && (
            <span className="flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {dayCast.length}
            </span>
          )}
        </div>

        {/* Cast Avatars */}
        {dayCast.length > 0 && (
          <div className="flex items-center -space-x-1 mb-2">
            {dayCast.slice(0, 3).map((member) => (
              <Avatar
                key={member.id}
                alt={member.actorName || member.characterName}
                fallback={getInitials(member.actorName || member.characterName)}
                size="sm"
                className="h-5 w-5 border border-white/30 text-[8px] bg-white/20"
              />
            ))}
            {dayCast.length > 3 && (
              <span className="ml-1.5 text-[10px] opacity-80">
                +{dayCast.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="flex items-center gap-1 text-[10px] opacity-70 truncate">
            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{location.name}</span>
          </div>
        )}

        {/* Unit Badge (if not MAIN) */}
        {shootingDay.unit !== "MAIN" && (
          <div className="mt-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/15">
              {shootingDay.unit} Unit
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

// Calendar-specific wrapper for drag and drop
export function DraggableShootingDayCard({
  shootingDay,
  scenes,
  cast,
  locations,
  variant = "compact",
  onClick,
  className,
}: ShootingDayCardProps) {
  // This will be enhanced in Phase 2 with dnd-kit
  return (
    <ShootingDayCard
      shootingDay={shootingDay}
      scenes={scenes}
      cast={cast}
      locations={locations}
      variant={variant}
      onClick={onClick}
      className={className}
    />
  );
}
