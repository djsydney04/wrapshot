"use client";

import * as React from "react";
import { AlertCircle, X, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ScriptChange {
  sceneNumber: string;
  changeType: "added" | "modified" | "deleted";
  summary: string;
  productionImpact: "low" | "medium" | "high";
}

interface ScriptChangeBannerProps {
  changes: ScriptChange[];
  previousVersion: number;
  newVersion: number;
  onReview: () => void;
  onDismiss: () => void;
  className?: string;
}

export function ScriptChangeBanner({
  changes,
  previousVersion,
  newVersion,
  onReview,
  onDismiss,
  className,
}: ScriptChangeBannerProps) {
  if (changes.length === 0) return null;

  // Count by impact level
  const highImpact = changes.filter((c) => c.productionImpact === "high").length;
  const mediumImpact = changes.filter((c) => c.productionImpact === "medium").length;

  // Determine banner color based on impact
  const bannerStyle =
    highImpact > 0
      ? "bg-red-50 border-red-200 text-red-800"
      : mediumImpact > 0
        ? "bg-yellow-50 border-yellow-200 text-yellow-800"
        : "bg-blue-50 border-blue-200 text-blue-800";

  const iconColor =
    highImpact > 0
      ? "text-red-500"
      : mediumImpact > 0
        ? "text-yellow-500"
        : "text-blue-500";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border",
        bannerStyle,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className={cn("h-5 w-5", iconColor)} />
        <AlertCircle className={cn("h-5 w-5", iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">
          Script Updated: {changes.length} scene{changes.length !== 1 ? "s" : ""} changed
        </p>
        <p className="text-xs opacity-80">
          Version {previousVersion} → {newVersion}
          {highImpact > 0 && (
            <span className="ml-2 text-red-600 font-medium">
              {highImpact} high impact
            </span>
          )}
          {mediumImpact > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">
              {mediumImpact} medium impact
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReview}
          className="bg-white/50 hover:bg-white gap-1"
        >
          Review Changes
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDismiss}
          className="hover:bg-white/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
