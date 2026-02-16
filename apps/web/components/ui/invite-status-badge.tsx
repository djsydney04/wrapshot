"use client";

import * as React from "react";
import { Check, Clock, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { cn } from "@/lib/utils";

export type InviteStatus =
  | "linked"        // Connected to platform user
  | "invite_sent"   // Pending invite
  | "invite_expired" // Invite expired
  | "no_account";   // Has email but no invite sent

interface InviteStatusBadgeProps {
  status: InviteStatus;
  email?: string | null;
  /** Callback to resend invite */
  onResendInvite?: () => void;
  /** Callback to send initial invite */
  onSendInvite?: () => void;
  /** Show compact version */
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<
  InviteStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ElementType;
    className: string;
    tooltip: string;
  }
> = {
  linked: {
    label: "Linked",
    variant: "default",
    icon: Check,
    className: "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20",
    tooltip: "Connected to platform account",
  },
  invite_sent: {
    label: "Invite Sent",
    variant: "secondary",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20",
    tooltip: "Waiting for user to accept invite",
  },
  invite_expired: {
    label: "Expired",
    variant: "outline",
    icon: AlertCircle,
    className: "bg-gray-500/10 text-gray-500 border-gray-500/30 hover:bg-gray-500/20",
    tooltip: "Invite has expired - resend to try again",
  },
  no_account: {
    label: "No Account",
    variant: "outline",
    icon: Mail,
    className: "text-muted-foreground",
    tooltip: "Has email but no platform invite sent",
  },
};

export function InviteStatusBadge({
  status,
  email,
  onResendInvite,
  onSendInvite,
  compact = false,
  className,
}: InviteStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1 font-normal",
        config.className,
        compact && "px-1.5 py-0.5 text-xs",
        className
      )}
    >
      <Icon className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
      {!compact && config.label}
    </Badge>
  );

  // If we have actions, wrap with tooltip
  const showResendAction = status === "invite_expired" && onResendInvite;
  const showSendAction = status === "no_account" && email && onSendInvite;

  if (showResendAction || showSendAction) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={showResendAction ? onResendInvite : onSendInvite}
              className="cursor-pointer"
            >
              {badge}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2">
            <RefreshCw className="h-3 w-3" />
            {showResendAction ? "Click to resend invite" : "Click to send invite"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{config.tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Determine the invite status based on member data
 */
export function getInviteStatus(
  member: {
    userId?: string | null;
    email?: string | null;
  },
  invite?: {
    expiresAt: string;
    acceptedAt?: string | null;
  } | null
): InviteStatus {
  // If linked to a user, they're connected
  if (member.userId) {
    return "linked";
  }

  // If there's an invite
  if (invite) {
    // Check if accepted (shouldn't happen if userId is null, but just in case)
    if (invite.acceptedAt) {
      return "linked";
    }

    // Check if expired
    if (new Date(invite.expiresAt) < new Date()) {
      return "invite_expired";
    }

    return "invite_sent";
  }

  // Has email but no invite
  if (member.email) {
    return "no_account";
  }

  // No email, no way to invite
  return "no_account";
}
