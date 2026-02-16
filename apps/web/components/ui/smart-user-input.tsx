"use client";

import * as React from "react";
import { Search, Mail, Loader2, Check, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Avatar } from "./avatar";
import { searchUsersForInvite, type UserSearchResult } from "@/lib/actions/users";

export type SmartUserSelection =
  | { type: "existing_user"; user: UserSearchResult }
  | { type: "new_invite"; email: string; name: string }
  | null;

interface SmartUserInputProps {
  projectId: string;
  onSelectionChange: (selection: SmartUserSelection) => void;
  /** Called whenever name/email change (for form state) */
  onValueChange?: (name: string, email: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Label for the name field */
  nameLabel?: string;
  /** Initial name value */
  initialName?: string;
  /** Initial email value */
  initialEmail?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function SmartUserInput({
  projectId,
  onSelectionChange,
  onValueChange,
  placeholder = "Search by name or enter email...",
  disabled = false,
  nameLabel = "Name",
  initialName = "",
  initialEmail = "",
}: SmartUserInputProps) {
  const [query, setQuery] = React.useState(initialName || initialEmail);
  const [results, setResults] = React.useState<UserSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<SmartUserSelection>(null);
  const [manualName, setManualName] = React.useState(initialName);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (!query || query.length < 2 || selection) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const searchResults = await searchUsersForInvite(query, projectId);
        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, projectId, selection]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Notify parent of value changes
  React.useEffect(() => {
    if (selection?.type === "existing_user") {
      const user = selection.user;
      const name = user.displayName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || "";
      onValueChange?.(name, user.email);
    } else if (selection?.type === "new_invite") {
      onValueChange?.(selection.name, selection.email);
    } else if (isValidEmail(query)) {
      onValueChange?.(manualName, query);
    } else {
      onValueChange?.(query, "");
    }
  }, [selection, query, manualName, onValueChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelection(null);
    onSelectionChange(null);
    setIsOpen(true);
  };

  const handleSelectUser = (user: UserSearchResult) => {
    const newSelection: SmartUserSelection = { type: "existing_user", user };
    setSelection(newSelection);
    setQuery(user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email);
    setIsOpen(false);
    onSelectionChange(newSelection);
  };

  const handleSelectEmail = () => {
    if (!isValidEmail(query)) return;
    const newSelection: SmartUserSelection = {
      type: "new_invite",
      email: query,
      name: manualName || query.split("@")[0]
    };
    setSelection(newSelection);
    setIsOpen(false);
    onSelectionChange(newSelection);
  };

  const handleClear = () => {
    setQuery("");
    setSelection(null);
    setResults([]);
    setManualName("");
    onSelectionChange(null);
    inputRef.current?.focus();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setManualName(name);
    if (selection?.type === "new_invite") {
      const updated: SmartUserSelection = {
        ...selection,
        name,
      };
      setSelection(updated);
      onSelectionChange(updated);
    }
  };

  const showEmailOption =
    query.length >= 3 &&
    isValidEmail(query) &&
    !results.some((r) => r.email.toLowerCase() === query.toLowerCase());

  const hasOptions = results.length > 0 || showEmailOption;

  // Show name field only when email is selected for invite
  const showNameField = selection?.type === "new_invite" ||
    (isValidEmail(query) && !selection);

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Main search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => !selection && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {selection && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Dropdown */}
        {isOpen && hasOptions && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            <ul className="max-h-60 overflow-auto py-1">
              {results.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50",
                      selection?.type === "existing_user" &&
                        selection.user.id === user.id &&
                        "bg-muted"
                    )}
                  >
                    <Avatar
                      src={user.avatarUrl}
                      alt={
                        user.displayName ||
                        `${user.firstName} ${user.lastName}`.trim()
                      }
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {user.displayName ||
                          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                          "User"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                    {selection?.type === "existing_user" &&
                      selection.user.id === user.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                  </button>
                </li>
              ))}

              {showEmailOption && (
                <>
                  {results.length > 0 && (
                    <li className="border-t border-border my-1" />
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={handleSelectEmail}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50",
                        selection?.type === "new_invite" && "bg-muted"
                      )}
                    >
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <UserPlus className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Invite {query}</p>
                        <p className="text-sm text-muted-foreground">
                          Send platform invite to this email
                        </p>
                      </div>
                      {selection?.type === "new_invite" && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}

        {isOpen && query.length >= 2 && !loading && !hasOptions && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-4 text-center shadow-lg">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No users found. Enter a valid email to invite someone new.
            </p>
          </div>
        )}
      </div>

      {/* Name field for new invites */}
      {showNameField && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{nameLabel}</label>
          <Input
            type="text"
            value={selection?.type === "new_invite" ? selection.name : manualName}
            onChange={handleNameChange}
            placeholder={`Enter ${nameLabel.toLowerCase()}`}
            disabled={disabled}
          />
        </div>
      )}

      {/* Status indicator */}
      {selection && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-sm",
            selection.type === "existing_user"
              ? "border-green-500/30 bg-green-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          )}
        >
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              selection.type === "existing_user" ? "bg-green-500" : "bg-amber-500"
            )}
          />
          {selection.type === "existing_user" ? (
            <span>
              Will link to{" "}
              <strong>
                {selection.user.displayName ||
                  `${selection.user.firstName || ""} ${selection.user.lastName || ""}`.trim() ||
                  selection.user.email}
              </strong>
              &apos;s account
            </span>
          ) : (
            <span>
              Will send platform invite to <strong>{selection.email}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
