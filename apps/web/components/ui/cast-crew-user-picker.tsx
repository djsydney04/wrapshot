"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserSearchCombobox, type UserSelection } from "./user-search-combobox";
import { UserPlus, PencilLine } from "lucide-react";

interface CastCrewUserPickerProps {
  projectId: string;
  onUserSelect: (selection: UserSelection | null) => void;
  onManualEntry: (name: string, email: string) => void;
  defaultMode?: "manual" | "search";
  nameLabel?: string;
  namePlaceholder?: string;
  emailPlaceholder?: string;
  disabled?: boolean;
  initialName?: string;
  initialEmail?: string;
}

export function CastCrewUserPicker({
  projectId,
  onUserSelect,
  onManualEntry,
  defaultMode = "manual",
  nameLabel = "Name",
  namePlaceholder = "Enter name",
  emailPlaceholder = "Email (optional)",
  disabled = false,
  initialName = "",
  initialEmail = "",
}: CastCrewUserPickerProps) {
  const [mode, setMode] = React.useState<"manual" | "search">(defaultMode);
  const [manualName, setManualName] = React.useState(initialName);
  const [manualEmail, setManualEmail] = React.useState(initialEmail);
  const [selectedUser, setSelectedUser] = React.useState<UserSelection | null>(null);

  // Notify parent of manual entry changes
  React.useEffect(() => {
    if (mode === "manual") {
      onManualEntry(manualName, manualEmail);
      onUserSelect(null);
    }
  }, [manualName, manualEmail, mode, onManualEntry, onUserSelect]);

  const handleUserSelect = (selection: UserSelection) => {
    setSelectedUser(selection);
    onUserSelect(selection);

    // Auto-fill manual fields with user data for reference
    if (selection.type === "existing_user") {
      const name =
        selection.user.displayName ||
        `${selection.user.firstName || ""} ${selection.user.lastName || ""}`.trim() ||
        "";
      setManualName(name);
      setManualEmail(selection.user.email);
      onManualEntry(name, selection.user.email);
    } else if (selection.type === "new_email") {
      setManualEmail(selection.email);
      onManualEntry(manualName, selection.email);
    }
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode as "manual" | "search");
    if (newMode === "manual") {
      setSelectedUser(null);
      onUserSelect(null);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue={defaultMode} value={mode} onValueChange={handleModeChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" disabled={disabled} className="gap-2">
            <PencilLine className="h-4 w-4" />
            Enter Details
          </TabsTrigger>
          <TabsTrigger value="search" disabled={disabled} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Find User
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="cast-crew-name">{nameLabel}</Label>
            <Input
              id="cast-crew-name"
              placeholder={namePlaceholder}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cast-crew-email">Email</Label>
            <Input
              id="cast-crew-email"
              type="email"
              placeholder={emailPlaceholder}
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Optional. If provided, you can send them a platform invite later.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Search Platform Users</Label>
            <UserSearchCombobox
              projectId={projectId}
              onSelect={handleUserSelect}
              placeholder="Search by name or enter email..."
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              Search for existing users or enter an email to invite someone new.
            </p>
          </div>

          {selectedUser && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              {selectedUser.type === "existing_user" ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium">
                    {selectedUser.user.displayName ||
                      `${selectedUser.user.firstName || ""} ${selectedUser.user.lastName || ""}`.trim() ||
                      selectedUser.user.email}
                  </span>
                  <span className="text-muted-foreground">
                    will be linked to their account
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="font-medium">{selectedUser.email}</span>
                  <span className="text-muted-foreground">
                    will receive an invite
                  </span>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
