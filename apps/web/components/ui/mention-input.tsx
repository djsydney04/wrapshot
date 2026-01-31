"use client";

import * as React from "react";
import { Search, User, MapPin, Box, Users, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Mention {
  type: "cast" | "element" | "location" | "crew";
  id: string;
  name: string;
  displayText?: string;
}

export interface MentionSearchResult {
  type: "cast" | "element" | "location" | "crew";
  id: string;
  name: string;
  subtitle?: string;
}

interface MentionInputProps {
  value: string;
  mentions: Mention[];
  onChange: (value: string, mentions: Mention[]) => void;
  onSearch: (query: string) => Promise<MentionSearchResult[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

const MENTION_TRIGGER = "@";

export function MentionInput({
  value,
  mentions,
  onChange,
  onSearch,
  placeholder = "Type @ to mention...",
  disabled = false,
  className,
  rows = 3,
}: MentionInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<MentionSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursorPosition, setCursorPosition] = React.useState(0);
  const [mentionStartPos, setMentionStartPos] = React.useState(-1);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Search for mentions when query changes
  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await onSearch(searchQuery);
        setSearchResults(results);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, onSearch]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setMentionStartPos(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPosition(pos);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf(MENTION_TRIGGER);

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space before the @ (or it's at the start)
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : " ";

      // Only trigger if @ is preceded by whitespace or start of text
      // and the text after @ doesn't contain spaces (still typing the mention)
      if (
        (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) &&
        !textAfterAt.includes(" ") &&
        !textAfterAt.includes("\n")
      ) {
        setIsOpen(true);
        setSearchQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
      } else {
        setIsOpen(false);
        setSearchQuery("");
        setMentionStartPos(-1);
      }
    } else {
      setIsOpen(false);
      setSearchQuery("");
      setMentionStartPos(-1);
    }

    onChange(newValue, mentions);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          insertMention(searchResults[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery("");
        setMentionStartPos(-1);
        break;
      case "Tab":
        if (searchResults[selectedIndex]) {
          e.preventDefault();
          insertMention(searchResults[selectedIndex]);
        }
        break;
    }
  };

  const insertMention = (result: MentionSearchResult) => {
    if (mentionStartPos === -1) return;

    const newMention: Mention = {
      type: result.type,
      id: result.id,
      name: result.name,
      displayText: `@${result.name}`,
    };

    // Replace the @query with the mention display text
    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(cursorPosition);
    const newValue = `${beforeMention}@${result.name} ${afterMention}`;

    // Add mention to list (avoid duplicates)
    const updatedMentions = mentions.some((m) => m.id === newMention.id && m.type === newMention.type)
      ? mentions
      : [...mentions, newMention];

    onChange(newValue, updatedMentions);
    setIsOpen(false);
    setSearchQuery("");
    setMentionStartPos(-1);

    // Focus back on textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = mentionStartPos + result.name.length + 2; // +2 for @ and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const removeMention = (mentionToRemove: Mention) => {
    const updatedMentions = mentions.filter(
      (m) => !(m.id === mentionToRemove.id && m.type === mentionToRemove.type)
    );
    onChange(value, updatedMentions);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cast":
        return <User className="h-3 w-3" />;
      case "element":
        return <Box className="h-3 w-3" />;
      case "location":
        return <MapPin className="h-3 w-3" />;
      case "crew":
        return <Users className="h-3 w-3" />;
      default:
        return <Box className="h-3 w-3" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "cast":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "element":
        return "bg-purple-500/10 text-purple-600 border-purple-200";
      case "location":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "crew":
        return "bg-orange-500/10 text-orange-600 border-orange-200";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-200";
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Mentions display */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {mentions.map((mention) => (
            <span
              key={`${mention.type}-${mention.id}`}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border",
                getTypeColor(mention.type)
              )}
            >
              {getTypeIcon(mention.type)}
              <span>{mention.name}</span>
              <button
                type="button"
                onClick={() => removeMention(mention)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "resize-none",
            className
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-lg"
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length > 0 ? (
            <ul className="py-1">
              {searchResults.map((result, index) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => insertMention(result)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50",
                      index === selectedIndex && "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full",
                        getTypeColor(result.type)
                      )}
                    >
                      {getTypeIcon(result.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.name}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {result.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : searchQuery ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>No results for &quot;{searchQuery}&quot;</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
