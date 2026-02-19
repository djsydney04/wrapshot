"use client";

import * as React from "react";
import { AlertTriangle, Check, X, Clapperboard, MapPin, Users, Calendar, Package, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlannedAction } from "@/lib/ai/tools/types";

interface ToolConfirmationCardProps {
  confirmationId: string;
  actions: PlannedAction[];
  onApprove: (confirmationId: string) => void;
  onDecline: (confirmationId: string) => void;
  resolved?: "approved" | "declined";
  disabled?: boolean;
}

function getActionIcon(toolName: string) {
  if (toolName.includes("scene")) return Clapperboard;
  if (toolName.includes("location")) return MapPin;
  if (toolName.includes("cast")) return Users;
  if (toolName.includes("shooting_day")) return Calendar;
  if (toolName.includes("element")) return Package;
  if (toolName.includes("crew")) return UserPlus;
  return Package;
}

export function ToolConfirmationCard({
  confirmationId,
  actions,
  onApprove,
  onDecline,
  resolved,
  disabled,
}: ToolConfirmationCardProps) {
  const hasDestructive = actions.some((a) => a.tier === "destructive");

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3 text-sm",
        hasDestructive
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {hasDestructive ? (
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span className={hasDestructive ? "text-destructive" : "text-amber-600 dark:text-amber-400"}>
          {actions.length} planned action{actions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        {actions.map((action, i) => {
          const Icon = getActionIcon(action.toolName);
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                action.tier === "destructive"
                  ? "border-destructive/20 bg-destructive/5"
                  : "border-border bg-background/60"
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="leading-5">{action.description}</span>
            </div>
          );
        })}
      </div>

      {resolved ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {resolved === "approved" ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Approved</span>
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Declined</span>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant={hasDestructive ? "destructive" : "default"}
            className="h-7 gap-1 text-xs"
            onClick={() => onApprove(confirmationId)}
            disabled={disabled}
          >
            <Check className="h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => onDecline(confirmationId)}
            disabled={disabled}
          >
            <X className="h-3 w-3" />
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}
