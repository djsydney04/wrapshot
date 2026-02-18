"use client";

import * as React from "react";
import { Search, Loader2, Plus, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { DEPARTMENT_LABELS } from "@/lib/types";
import {
  searchCrewDirectory,
  type DirectoryCrewMember,
} from "@/lib/actions/crew-directory";
import { createCrewMember, type DepartmentType } from "@/lib/actions/crew";

interface CrewDirectoryDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCrewAdded?: () => void;
}

export function CrewDirectoryDialog({
  projectId,
  open,
  onOpenChange,
  onCrewAdded,
}: CrewDirectoryDialogProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<DirectoryCrewMember[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [addedIds, setAddedIds] = React.useState<Set<string>>(new Set());
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setAddedIds(new Set());
    }
  }, [open]);

  const handleSearch = React.useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const { data } = await searchCrewDirectory(searchQuery, projectId);
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [projectId]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const handleAddToProject = async (member: DirectoryCrewMember) => {
    setAdding(member.id);
    try {
      const { error } = await createCrewMember({
        projectId,
        name: member.name,
        role: member.role,
        department: member.department,
        email: member.email || undefined,
        phone: member.phone || undefined,
        profilePhotoUrl: member.profilePhotoUrl || undefined,
        userId: member.userId || undefined,
      });
      if (!error) {
        setAddedIds((prev) => new Set([...prev, member.id]));
        onCrewAdded?.();
      }
    } catch {
      // silently fail
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crew Directory</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, role, or email..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {searching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && query.length >= 2 && results.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No crew members found across your other projects.
              </div>
            )}

            {!searching &&
              results.map((member) => {
                const isAdded = addedIds.has(member.id);
                const isAdding = adding === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <Avatar
                      alt={member.name}
                      src={member.profilePhotoUrl}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.role}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {DEPARTMENT_LABELS[member.department] || member.department}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          from {member.projectName}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isAdded ? "secondary" : "outline"}
                      disabled={isAdded || isAdding}
                      onClick={() => handleAddToProject(member)}
                    >
                      {isAdding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isAdded ? (
                        "Added"
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}

            {!searching && query.length < 2 && (
              <div className="text-center py-8">
                <UserCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Search for crew members from your other projects
                </p>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
