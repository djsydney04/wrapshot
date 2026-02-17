"use client";

import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/agents/constants";
import type { AgentJobStatus } from "@/lib/agents/types";
import {
  Clock,
  FileText,
  Scissors,
  Film,
  Package,
  Users,
  Edit,
  CheckCircle,
  XCircle,
  X,
  Loader2,
} from "lucide-react";

interface AgentStatusBadgeProps {
  status: AgentJobStatus;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const iconMap = {
  clock: Clock,
  "file-text": FileText,
  scissors: Scissors,
  film: Film,
  package: Package,
  users: Users,
  edit: Edit,
  "check-circle": CheckCircle,
  "x-circle": XCircle,
  x: X,
};

const colorClasses = {
  gray: "bg-gray-100 text-gray-700 border-gray-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  red: "bg-red-100 text-red-700 border-red-200",
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function AgentStatusBadge({
  status,
  className,
  showIcon = true,
  size = "md",
}: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const IconComponent = iconMap[config.icon as keyof typeof iconMap] || Clock;
  const isRunning = !["completed", "failed", "cancelled", "pending"].includes(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        colorClasses[config.color as keyof typeof colorClasses],
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        isRunning ? (
          <Loader2
            size={iconSizes[size]}
            className="animate-spin"
          />
        ) : (
          <IconComponent size={iconSizes[size]} />
        )
      )}
      <span>{config.label}</span>
    </span>
  );
}
