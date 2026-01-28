"use client";

import * as React from "react";
import { Plus, ChevronDown, ChevronRight, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CrewCard } from "@/components/crew/crew-card";
import { CrewProfileModal } from "@/components/crew/crew-profile-modal";
import { AddCrewForm } from "@/components/forms/add-crew-form";
import { DEPARTMENT_LABELS, type CrewMember, type DepartmentType } from "@/lib/mock-data";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";

interface CrewSectionProps {
  projectId: string;
  crew: CrewMember[];
}

export function CrewSection({ projectId, crew }: CrewSectionProps) {
  const [showAddCrew, setShowAddCrew] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<CrewMember | null>(null);
  const [collapsedDepts, setCollapsedDepts] = React.useState<Set<DepartmentType>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { deleteCrewMember, updateCrewMember } = useProjectStore();

  // Filter crew by search query
  const filteredCrew = React.useMemo(() => {
    if (!searchQuery) return crew;
    const query = searchQuery.toLowerCase();
    return crew.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.role.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    );
  }, [crew, searchQuery]);

  // Group crew by department
  const crewByDepartment = React.useMemo(() => {
    const grouped: Partial<Record<DepartmentType, CrewMember[]>> = {};
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

  const handleDelete = (id: string) => {
    deleteCrewMember(id);
    setSelectedMember(null);
    forceUpdate();
  };

  const handleUpdate = (id: string, updates: Partial<CrewMember>) => {
    updateCrewMember(id, updates);
    forceUpdate();
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
          <Plus className="h-4 w-4 mr-1" />
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
                <Plus className="h-4 w-4 mr-1" />
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
        onSuccess={forceUpdate}
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
