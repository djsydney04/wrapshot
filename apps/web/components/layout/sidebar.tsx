"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Film,
  Search,
  Settings,
  Plus,
  LogOut,
  User,
  LayoutDashboard,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAssistantPanelStore } from "@/lib/stores/assistant-panel-store";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { ShareButton } from "@/components/share/share-button";

interface SidebarProps {
  user?: {
    email?: string;
    name?: string;
  };
}

interface NavChildItem {
  label: string;
  href: string;
  badge?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  tourId: string;
  children?: NavChildItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    tourId: "dashboard",
  },
  {
    label: "Projects",
    href: "/projects",
    icon: Film,
    tourId: "projects",
    children: [
      { label: "All Projects", href: "/projects" },
      { label: "New Project", href: "/projects/new", badge: "New" },
    ],
  },
  {
    label: "Finance",
    href: "/finance",
    icon: DollarSign,
    tourId: "finance",
    children: [
      { label: "Budgets", href: "/finance" },
      { label: "New Budget", href: "/finance/new" },
    ],
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, openCommandPalette } = useLayoutStore();
  const projects = useProjectStore((state) => state.projects);
  const toggleAssistantPanel = useAssistantPanelStore((s) => s.togglePanel);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>(() => ({
    "/projects": true,
    "/finance": false,
  }));

  // Keyboard shortcut for sidebar toggle
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          toggleSidebar();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggleAssistantPanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, openCommandPalette, toggleAssistantPanel]);

  React.useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const item of NAV_ITEMS) {
        if (!item.children) continue;
        const groupActive =
          pathname === item.href ||
          pathname.startsWith(`${item.href}/`) ||
          item.children.some(
            (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
          );

        if (groupActive) {
          next[item.href] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col overflow-hidden border-r border-sidebar-border bg-[hsl(var(--sidebar-bg)/0.95)] text-sidebar-foreground shadow-[16px_0_36px_-28px_hsl(var(--sidebar-bg)/0.9)] backdrop-blur-xl transition-all duration-200",
        sidebarOpen ? "w-[240px]" : "w-[48px]"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,hsl(var(--sidebar-hover)/0.42),transparent_40%),radial-gradient(circle_at_92%_-20%,hsl(var(--accent-blue)/0.2),transparent_44%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.18] [background-image:radial-gradient(hsl(var(--sidebar-fg-active)/0.26)_0.6px,transparent_0.6px)] [background-size:4px_4px]"
      />

      {/* Header */}
      <div className="relative z-10 flex h-12 items-center justify-between border-b border-sidebar-border px-3">
        {sidebarOpen ? (
          <>
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <span className="font-semibold text-sm">wrapshoot</span>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <SimpleTooltip content="Expand sidebar" side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="mx-auto text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
        )}
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="relative z-10 px-2 py-2">
          <Button
            variant="ghost"
            className="h-8 w-full justify-start gap-2 font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
            onClick={openCommandPalette}
            data-tour="command-palette"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="pointer-events-none h-5 select-none rounded border border-sidebar-kbd-border bg-sidebar-kbd px-1.5 font-mono text-[10px] font-medium text-sidebar-kbd-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        {sidebarOpen && (
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground-muted/80">
            Workspace
          </p>
        )}

        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            if (!sidebarOpen) {
              return (
                <SimpleTooltip key={item.href} content={item.label} side="right">
                  <Link href={item.href} data-tour={item.tourId}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "w-full text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                        isActive && "bg-sidebar-active text-sidebar-foreground-active"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </Link>
                </SimpleTooltip>
              );
            }

            const groupExpanded = item.children ? expandedGroups[item.href] ?? false : false;
            const groupActive =
              isActive ||
              Boolean(
                item.children?.some(
                  (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
                )
              );

            if (item.children && item.children.length > 0) {
              return (
                <div key={item.href} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => router.push(item.href)}
                      className={cn(
                        "h-8 flex-1 justify-start gap-2 font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                        groupActive && "bg-sidebar-active/75 text-sidebar-foreground-active"
                      )}
                      data-tour={item.tourId}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [item.href]: !groupExpanded,
                        }))
                      }
                      className="h-8 w-8 text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          !groupExpanded && "-rotate-90"
                        )}
                      />
                    </Button>
                  </div>

                  {groupExpanded && (
                    <div className="ml-4 space-y-1 border-l border-sidebar-border/70 pl-2">
                      {item.children.map((child) => {
                        const childActive =
                          pathname === child.href || pathname.startsWith(`${child.href}/`);

                        return (
                          <Button
                            key={child.href}
                            variant="ghost"
                            onClick={() => router.push(child.href)}
                            className={cn(
                              "h-7 w-full justify-start gap-2 px-2 text-xs font-medium text-sidebar-foreground-muted/90 hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                              childActive && "bg-sidebar-active/70 text-sidebar-foreground-active"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground-muted/70" />
                            <span>{child.label}</span>
                            {child.badge && (
                              <span className="ml-auto rounded-sm border border-sidebar-kbd-border bg-sidebar-kbd px-1 py-0.5 text-[10px] leading-none text-sidebar-kbd-foreground">
                                {child.badge}
                              </span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} data-tour={item.tourId}>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-8 w-full justify-start gap-2 font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                    isActive && "bg-sidebar-active text-sidebar-foreground-active"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Projects Section */}
        {sidebarOpen && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground-muted">
                  Recent Projects
                </span>
                <Link href="/projects/new">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-5 w-5 text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {projects.length === 0 ? (
                <p className="px-2 py-2 text-xs text-sidebar-foreground-muted">No projects yet</p>
              ) : (
                projects.slice(0, 5).map((project) => {
                  const isActive = pathname.includes(project.id);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "h-8 w-full justify-start gap-2 text-sm font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                          isActive && "bg-sidebar-active text-sidebar-foreground-active"
                        )}
                      >
                        <Film className="h-3.5 w-3.5 text-sidebar-foreground-muted" />
                        <span className="truncate">{project.name}</span>
                      </Button>
                    </Link>
                  );
                })
              )}
            </div>
          </>
        )}
      </nav>

      {/* Assistant */}
      <div className="relative z-10 border-t border-sidebar-border px-2 py-2">
        {sidebarOpen ? (
          <Button
            variant="ghost"
            data-tour="assistant"
            onClick={toggleAssistantPanel}
            className="h-8 w-full justify-start gap-2 font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
          >
            <Sparkles className="h-4 w-4" />
            Assistant
            <kbd className="ml-auto pointer-events-none h-5 select-none rounded border border-sidebar-kbd-border bg-sidebar-kbd px-1.5 font-mono text-[10px] font-medium text-sidebar-kbd-foreground">
              ⌘J
            </kbd>
          </Button>
        ) : (
          <SimpleTooltip content="Assistant (⌘J)" side="right">
            <Button
              variant="ghost"
              size="icon"
              data-tour="assistant"
              onClick={toggleAssistantPanel}
              className="w-full text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </SimpleTooltip>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 space-y-1 border-t border-sidebar-border p-2">
        {sidebarOpen ? (
          <>
            {/* Share & Feedback Buttons */}
            <ShareButton />
            <FeedbackButton />

            {/* Settings Link */}
            <Link href="/settings">
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-full justify-start gap-2 font-normal text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                  pathname.startsWith("/settings") && "bg-sidebar-active text-sidebar-foreground-active"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>

            {/* User Account */}
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar alt={user?.name || user?.email || "User"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user?.name || user?.email?.split("@")[0] || "User"}
                </p>
              </div>
              <form action="/auth/signout" method="post">
                <SimpleTooltip content="Sign out" side="top">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </SimpleTooltip>
              </form>
            </div>
          </>
        ) : (
          <>
            <ShareButton variant="sidebar" />
            <FeedbackButton collapsed />
            <SimpleTooltip content="Settings" side="right">
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-full text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
                    pathname.startsWith("/settings") && "bg-sidebar-active text-sidebar-foreground-active"
                  )}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </SimpleTooltip>
            <SimpleTooltip content="User menu" side="right">
              <Button
                variant="ghost"
                size="icon"
                className="w-full text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
              >
                <User className="h-4 w-4" />
              </Button>
            </SimpleTooltip>
          </>
        )}
      </div>
    </aside>
  );
}
