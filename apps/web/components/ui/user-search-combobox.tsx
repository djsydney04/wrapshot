"use client";

import * as React from "react";
import { Search, User, Mail, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Avatar } from "./avatar";
import { searchUsersForInvite, type UserSearchResult } from "@/lib/actions/users";

interface UserSearchComboboxProps {
  projectId: string;
  onSelect: (selection: UserSelection) => void;
  placeholder?: string;
  disabled?: boolean;
}

export type UserSelection =
  | { type: "existing_user"; user: UserSearchResult }
  | { type: "new_email"; email: string };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function UserSearchCombobox({
  projectId,
  onSelect,
  placeholder = "Search by name or email...",
  disabled = false,
}: UserSearchComboboxProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<UserSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<UserSelection | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (!query || query.length < 2) {
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
  }, [query, projectId]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelected(null);
    setIsOpen(true);
  };

  const handleSelectUser = (user: UserSearchResult) => {
    const selection: UserSelection = { type: "existing_user", user };
    setSelected(selection);
    setQuery(user.displayName || `${user.firstName} ${user.lastName}`.trim() || user.email);
    setIsOpen(false);
    onSelect(selection);
  };

  const handleSelectEmail = () => {
    if (!isValidEmail(query)) return;
    const selection: UserSelection = { type: "new_email", email: query };
    setSelected(selection);
    setIsOpen(false);
    onSelect(selection);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    inputRef.current?.focus();
  };

  const showEmailOption =
    query.length >= 3 &&
    isValidEmail(query) &&
    !results.some((r) => r.email.toLowerCase() === query.toLowerCase());

  const hasOptions = results.length > 0 || showEmailOption;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {selected && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <span className="sr-only">Clear</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

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
                    selected?.type === "existing_user" &&
                      selected.user.id === user.id &&
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
                  {selected?.type === "existing_user" &&
                    selected.user.id === user.id && (
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
                      selected?.type === "new_email" && "bg-muted"
                    )}
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Invite {query}</p>
                      <p className="text-sm text-muted-foreground">
                        Send invitation to new user
                      </p>
                    </div>
                    {selected?.type === "new_email" && (
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
          <User className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No users found. Enter a valid email to invite someone new.
          </p>
        </div>
      )}
    </div>
  );
}
