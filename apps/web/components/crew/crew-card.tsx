"use client";

import * as React from "react";
import { Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { InviteStatusBadge } from "@/components/ui/invite-status-badge";
import { cn } from "@/lib/utils";
import { type CrewMemberWithInviteStatus } from "@/lib/actions/crew";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS } from "@/lib/permissions";

interface CrewCardProps {
  member: CrewMemberWithInviteStatus;
  onClick?: () => void;
  compact?: boolean;
  onSendInvite?: () => void;
  onResendInvite?: () => void;
}

export function CrewCard({
  member,
  onClick,
  compact = false,
  onSendInvite,
  onResendInvite,
}: CrewCardProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Avatar
          alt={member.name}
          src={member.profilePhotoUrl}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{member.name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {member.projectRole && (
            <Badge variant="outline" className={cn("text-[10px] flex-shrink-0", PROJECT_ROLE_COLORS[member.projectRole])}>
              {PROJECT_ROLE_LABELS[member.projectRole]}
            </Badge>
          )}
          {member.inviteStatus && (
            <InviteStatusBadge
              status={member.inviteStatus}
              email={member.email}
              onSendInvite={onSendInvite}
              onResendInvite={onResendInvite}
              compact
            />
          )}
          {member.isHead && (
            <Badge variant="default" className="text-[10px] flex-shrink-0">HEAD</Badge>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-all group"
    >
      {/* Avatar */}
      <div className="relative">
        <Avatar
          alt={member.name}
          src={member.profilePhotoUrl}
          size="lg"
        />
        {member.isHead && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[8px] font-bold px-1 py-0.5 rounded">
            HEAD
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{member.name}</p>
          {member.projectRole && (
            <Badge variant="outline" className={cn("text-[10px]", PROJECT_ROLE_COLORS[member.projectRole])}>
              {PROJECT_ROLE_LABELS[member.projectRole]}
            </Badge>
          )}
          {member.inviteStatus && (
            <InviteStatusBadge
              status={member.inviteStatus}
              email={member.email}
              onSendInvite={onSendInvite}
              onResendInvite={onResendInvite}
              compact
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{member.role}</p>

        {/* Contact Links */}
        <div className="flex items-center gap-3 mt-2">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline truncate max-w-[150px]">{member.email}</span>
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="h-3 w-3" />
              <span className="hidden sm:inline">{member.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-4 w-4" />
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${member.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
      </div>
    </button>
  );
}
