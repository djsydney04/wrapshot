"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Calendar,
  Search,
  Settings,
  Plus,
  LogOut,
  User,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { mockProjects } from "@/lib/mock-data";

interface SidebarProps {
  user?: {
    email?: string;
    name?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, openCommandPalette } = useLayoutStore();

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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, openCommandPalette]);

  const navItems = [
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
    },
    {
      label: "Schedule",
      href: "/schedule",
      icon: Calendar,
      tourId: "schedule",
    },
  ];

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-stone-800 bg-stone-900 text-white transition-all duration-200",
        sidebarOpen ? "w-[240px]" : "w-[48px]"
      )}
    >
      {/* Header */}
      <div className="flex h-[45px] items-center justify-between px-3 border-b border-stone-800">
        {sidebarOpen ? (
          <>
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <span className="font-semibold text-sm">wrapshoot</span>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="text-stone-400 hover:text-white hover:bg-stone-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Tooltip content="Expand sidebar" side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="mx-auto text-stone-400 hover:text-white hover:bg-stone-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="px-2 py-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-stone-400 hover:text-white hover:bg-stone-800 font-normal h-8"
            onClick={openCommandPalette}
            data-tour="command-palette"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="pointer-events-none h-5 select-none rounded border border-stone-700 bg-stone-800 px-1.5 font-mono text-[10px] font-medium text-stone-400">
              ⌘K
            </kbd>
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            if (!sidebarOpen) {
              return (
                <Tooltip key={item.href} content={item.label} side="right">
                  <Link href={item.href} data-tour={item.tourId}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "w-full text-stone-400 hover:text-white hover:bg-stone-800",
                        isActive && "bg-stone-800 text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </Link>
                </Tooltip>
              );
            }

            return (
              <Link key={item.href} href={item.href} data-tour={item.tourId}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2 font-normal h-8 text-stone-400 hover:text-white hover:bg-stone-800",
                    isActive && "bg-stone-800 text-white"
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
            <Separator className="my-3 bg-stone-800" />
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Projects
                </span>
                <Button variant="ghost" size="icon-sm" className="h-5 w-5 text-stone-500 hover:text-white hover:bg-stone-800">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {mockProjects.slice(0, 5).map((project) => {
                const isActive = pathname.includes(project.id);
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2 font-normal h-8 text-sm text-stone-400 hover:text-white hover:bg-stone-800",
                        isActive && "bg-stone-800 text-white"
                      )}
                    >
                      <Film className="h-3.5 w-3.5 text-stone-500" />
                      <span className="truncate">{project.name}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-stone-800 p-2 space-y-1">
        {sidebarOpen ? (
          <>
            {/* Settings Link */}
            <Link href="/settings">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 font-normal h-8 text-stone-400 hover:text-white hover:bg-stone-800",
                  pathname.startsWith("/settings") && "bg-stone-800 text-white"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>

            {/* User Account */}
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar
                alt={user?.name || user?.email || "User"}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-stone-300">
                  {user?.name || user?.email?.split("@")[0] || "User"}
                </p>
              </div>
              <form action="/auth/signout" method="post">
                <Tooltip content="Sign out" side="top">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="text-stone-500 hover:text-white hover:bg-stone-800"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </Tooltip>
              </form>
            </div>
          </>
        ) : (
          <>
            <Tooltip content="Settings" side="right">
              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-full text-stone-400 hover:text-white hover:bg-stone-800",
                    pathname.startsWith("/settings") && "bg-stone-800 text-white"
                  )}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </Tooltip>
            <Tooltip content="User menu" side="right">
              <Button variant="ghost" size="icon" className="w-full text-stone-400 hover:text-white hover:bg-stone-800">
                <User className="h-4 w-4" />
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </aside>
  );
}
