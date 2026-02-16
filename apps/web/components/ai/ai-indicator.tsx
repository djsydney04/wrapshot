"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WRAPSHOT_INTELLIGENCE_LABEL } from "@/lib/ai/config";

interface AIIndicatorProps {
  variant?: "badge" | "pill" | "inline" | "loading";
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function AIIndicator({
  variant = "badge",
  size = "sm",
  label = WRAPSHOT_INTELLIGENCE_LABEL,
  className,
}: AIIndicatorProps) {
  const sizeClasses = {
    sm: "text-[10px] px-1 py-0.5 gap-0.5",
    md: "text-xs px-1.5 py-0.5 gap-1",
    lg: "text-sm px-2 py-1 gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-3.5 w-3.5",
  };

  if (variant === "loading") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-primary",
          sizeClasses[size],
          className
        )}
      >
        <Loader2 className={cn(iconSizes[size], "animate-spin")} />
        {label && <span>{label}</span>}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center text-primary/70",
          sizeClasses[size],
          className
        )}
      >
        <Sparkles className={iconSizes[size]} />
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-primary/10 text-primary font-medium",
          sizeClasses[size],
          className
        )}
      >
        <Sparkles className={iconSizes[size]} />
        {label && <span>{label}</span>}
      </span>
    );
  }

  // Default badge variant
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-primary/10 text-primary",
        sizeClasses[size],
        className
      )}
    >
      <Sparkles className={iconSizes[size]} />
      {label && <span>{label}</span>}
    </span>
  );
}

// Loading skeleton for AI-generated content
interface AILoadingSkeletonProps {
  lines?: number;
  className?: string;
}

export function AILoadingSkeleton({
  lines = 2,
  className,
}: AILoadingSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Generating...</span>
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 rounded bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse",
              i === lines - 1 && "w-2/3"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Animated typing indicator
export function AITypingIndicator({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="text-muted-foreground animate-pulse">|</span>
    </span>
  );
}
