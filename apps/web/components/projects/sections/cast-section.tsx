"use client";

import * as React from "react";
import { Plus, Users, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { InviteStatusBadge, type InviteStatus } from "@/components/ui/invite-status-badge";
import { AddCastForm } from "@/components/forms/add-cast-form";
import { useProjectStore } from "@/lib/stores/project-store";
import {
  inviteCastMember,
  resendCastCrewInvite,
} from "@/lib/actions/cast-crew-invites";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";

interface CastSectionProps {
  projectId: string;
  cast: CastMemberWithInviteStatus[];
}

export function CastSection({ projectId, cast }: CastSectionProps) {
  const [showAddCast, setShowAddCast] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [localCast, setLocalCast] = React.useState(cast);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { deleteCastMember } = useProjectStore();

  // Sync with props
  React.useEffect(() => {
    setLocalCast(cast);
  }, [cast]);

  const filteredCast = React.useMemo(() => {
    if (!searchQuery) return localCast;
    const query = searchQuery.toLowerCase();
    return localCast.filter(
      (c) =>
        c.characterName.toLowerCase().includes(query) ||
        (c.actorName && c.actorName.toLowerCase().includes(query))
    );
  }, [localCast, searchQuery]);

  const sortedCast = React.useMemo(() => {
    return [...filteredCast].sort((a, b) => (a.castNumber || 0) - (b.castNumber || 0));
  }, [filteredCast]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this cast member?")) {
      deleteCastMember(id);
      setLocalCast((prev) => prev.filter((c) => c.id !== id));
      forceUpdate();
    }
  };

  const handleSendInvite = async (memberId: string) => {
    try {
      const result = await inviteCastMember(memberId, projectId);
      if (result.success) {
        // Update local state to reflect the new status
        setLocalCast((prev) =>
          prev.map((c) =>
            c.id === memberId
              ? { ...c, inviteStatus: "invite_sent" as InviteStatus }
              : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const result = await resendCastCrewInvite(inviteId, projectId);
      if (result.success) {
        // Update local state
        setLocalCast((prev) =>
          prev.map((c) =>
            c.inviteId === inviteId
              ? { ...c, inviteStatus: "invite_sent" as InviteStatus }
              : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to resend invite:", error);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case "WORKING":
        return "production";
      case "CONFIRMED":
        return "pre-production";
      case "WRAPPED":
        return "completed";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cast..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button size="sm" variant="skeuo" onClick={() => setShowAddCast(true)}>
          <Plus className="h-4 w-4" />
          Add Cast Member
        </Button>
      </div>

      {/* Cast Table */}
      {sortedCast.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Character</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedCast.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="font-mono">
                      {member.castNumber}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar alt={member.characterName} size="sm" />
                      <span className="font-medium">{member.characterName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.actorName || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(member.workStatus)}>
                      {member.workStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <InviteStatusBadge
                      status={member.inviteStatus}
                      email={member.email}
                      onSendInvite={
                        member.inviteStatus === "no_account" && member.email
                          ? () => handleSendInvite(member.id)
                          : undefined
                      }
                      onResendInvite={
                        member.inviteStatus === "invite_expired" && member.inviteId
                          ? () => handleResendInvite(member.inviteId!)
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="hover:text-foreground">
                          {member.email}
                        </a>
                      )}
                      {!member.email && "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">
            {searchQuery ? "No cast found" : "No cast members yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Try a different search term" : "Add cast members to your project"}
          </p>
          {!searchQuery && (
            <Button variant="skeuo" onClick={() => setShowAddCast(true)}>
              <Plus className="h-4 w-4" />
              Add First Cast Member
            </Button>
          )}
        </div>
      )}

      <AddCastForm
        projectId={projectId}
        open={showAddCast}
        onOpenChange={setShowAddCast}
        onSuccess={forceUpdate}
      />
    </div>
  );
}
