"use client";

import * as React from "react";
import { Plus, ChevronDown, ChevronRight, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CrewCard } from "@/components/crew/crew-card";
import { CrewProfileModal } from "@/components/crew/crew-profile-modal";
import { AddCrewForm } from "@/components/forms/add-crew-form";
import { DEPARTMENT_LABELS, type DepartmentType } from "@/lib/types";
import {
  deleteCrewMember,
  updateCrewMember,
  type CrewMemberWithInviteStatus,
  type CrewMemberInput,
} from "@/lib/actions/crew";
import {
  inviteCrewMember,
  resendCastCrewInvite,
} from "@/lib/actions/cast-crew-invites";
import type { InviteStatus } from "@/components/ui/invite-status-badge";

interface CrewSectionProps {
  projectId: string;
  crew: CrewMemberWithInviteStatus[];
}

export function CrewSection({ projectId, crew }: CrewSectionProps) {
  const [showAddCrew, setShowAddCrew] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<CrewMemberWithInviteStatus | null>(null);
  const [collapsedDepts, setCollapsedDepts] = React.useState<Set<DepartmentType>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [localCrew, setLocalCrew] = React.useState<CrewMemberWithInviteStatus[]>(crew);

  // Sync local state with props when crew changes
  React.useEffect(() => {
    setLocalCrew(crew);
  }, [crew]);

  // Filter crew by search query
  const filteredCrew = React.useMemo(() => {
    if (!searchQuery) return localCrew;
    const query = searchQuery.toLowerCase();
    return localCrew.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.role.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
  }, [localCrew, searchQuery]);

  // Group crew by department
  const crewByDepartment = React.useMemo(() => {
    const grouped: Partial<Record<DepartmentType, CrewMemberWithInviteStatus[]>> = {};
    filteredCrew.forEach((member) => {
      if (!grouped[member.department]) {
        grouped[member.department] = [];
      }
      grouped[member.department]!.push(member);
    });
    // Sort each department: heads first
    Object.keys(grouped).forEach((dept) => {
      grouped[dept as DepartmentType]!.sort((a, b) => {
        if (a.isHead && !b.isHead) return -1;
        if (!a.isHead && b.isHead) return 1;
        return a.name.localeCompare(b.name);
      });
    });
    return grouped;
  }, [filteredCrew]);

  const toggleDeptCollapse = (dept: DepartmentType) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else {
        next.add(dept);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    const { success, error } = await deleteCrewMember(id, projectId);
    if (success) {
      setLocalCrew((prev) => prev.filter((c) => c.id !== id));
      setSelectedMember(null);
    } else {
      console.error("Failed to delete crew member:", error);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<CrewMemberInput>) => {
    const { data, error } = await updateCrewMember(id, updates);
    if (data) {
      setLocalCrew((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      // Update selected member if it's the one being edited
      if (selectedMember?.id === id) {
        setSelectedMember({ ...selectedMember, ...data });
      }
    } else {
      console.error("Failed to update crew member:", error);
    }
  };

  const handleSendInvite = async (memberId: string) => {
    try {
      const result = await inviteCrewMember(memberId, projectId);
      if (result.success) {
        setLocalCrew((prev) =>
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
        setLocalCrew((prev) =>
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

  const handleCrewAdded = () => {
    // The page will revalidate and pass new crew data
    // This is handled by the server action's revalidatePath
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search crew..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Button size="sm" onClick={() => setShowAddCrew(true)}>
          <Plus className="h-4 w-4" />
          Add Crew Member
        </Button>
      </div>

      {/* Crew by Department */}
      <div className="space-y-3">
        {(Object.keys(DEPARTMENT_LABELS) as DepartmentType[]).map((dept) => {
          const deptCrew = crewByDepartment[dept];
          if (!deptCrew || deptCrew.length === 0) return null;

          const isCollapsed = collapsedDepts.has(dept);
          const head = deptCrew.find((c) => c.isHead);

          return (
            <div key={dept} className="rounded-lg border border-border overflow-hidden">
              {/* Department Header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/70 transition-colors"
                onClick={() => toggleDeptCollapse(dept)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-medium">{DEPARTMENT_LABELS[dept]}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {deptCrew.length}
                  </Badge>
                </div>
                {head && (
                  <p className="text-sm text-muted-foreground">
                    Head: {head.name}
                  </p>
                )}
              </button>

              {/* Crew List */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {deptCrew.map((member) => (
                    <div key={member.id} className="px-2 py-1">
                      <CrewCard
                        member={member}
                        onClick={() => setSelectedMember(member)}
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredCrew.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">
              {searchQuery ? "No crew found" : "No crew members yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Try a different search term"
                : "Add crew members to your project"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowAddCrew(true)}>
                <Plus className="h-4 w-4" />
                Add First Crew Member
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Crew Form */}
      <AddCrewForm
        projectId={projectId}
        open={showAddCrew}
        onOpenChange={setShowAddCrew}
        onSuccess={handleCrewAdded}
      />

      {/* Crew Profile Modal */}
      {selectedMember && (
        <CrewProfileModal
          member={selectedMember}
          open={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
