"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Film,
  Search,
  LayoutDashboard,
  Plus,
  Settings,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { useProjectStore } from "@/lib/stores/project-store";

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, closeCommandPalette } = useLayoutStore();
  const projects = useProjectStore((state) => state.projects);
  const [search, setSearch] = React.useState("");

  // Close on escape
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCommandPalette();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [closeCommandPalette]);

  // Reset search when closed
  React.useEffect(() => {
    if (!commandPaletteOpen) {
      setSearch("");
    }
  }, [commandPaletteOpen]);

  const runCommand = React.useCallback(
    (command: () => void) => {
      closeCommandPalette();
      command();
    },
    [closeCommandPalette]
  );

  if (!commandPaletteOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0"
        onClick={closeCommandPalette}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <Command
          className={cn(
            "w-full max-w-lg rounded-lg border border-border bg-popover text-popover-foreground shadow-soft-lg animate-in fade-in-0 zoom-in-95",
            "overflow-hidden"
          )}
          shouldFilter={true}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search projects, scenes, cast..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <Command.Item
                value="new-project"
                onSelect={() => runCommand(() => router.push("/projects/new"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Plus className="h-4 w-4" />
                New Project
              </Command.Item>
              <Command.Item
                value="dashboard"
                onSelect={() => runCommand(() => router.push("/"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                Go to Dashboard
              </Command.Item>
            </Command.Group>

            {/* Projects */}
            {projects.length > 0 && (
              <Command.Group heading="Projects" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {projects.map((project) => (
                  <Command.Item
                    key={project.id}
                    value={`project-${project.name}`}
                    onSelect={() =>
                      runCommand(() => router.push(`/projects/${project.id}`))
                    }
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                  >
                    <Film className="h-4 w-4 text-muted-foreground" />
                    {project.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <Command.Item
                value="projects-list"
                onSelect={() => runCommand(() => router.push("/projects"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Film className="h-4 w-4" />
                All Projects
              </Command.Item>
              <Command.Item
                value="finance"
                onSelect={() => runCommand(() => router.push("/finance"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <DollarSign className="h-4 w-4" />
                Finance
              </Command.Item>
              <Command.Item
                value="settings"
                onSelect={() => runCommand(() => router.push("/settings"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Command.Item>
              <Command.Item
                value="billing"
                onSelect={() => runCommand(() => router.push("/settings/billing"))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <CreditCard className="h-4 w-4" />
                Billing
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">↑↓</kbd>
              <span>navigate</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">↵</kbd>
              <span>select</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">esc</kbd>
              <span>close</span>
            </div>
          </div>
        </Command>
      </div>
    </>
  );
}
