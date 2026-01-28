"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { useLayoutStore } from "@/lib/stores/layout-store";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    email?: string;
    name?: string;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const [mounted, setMounted] = React.useState(false);
  const sidebarOpen = useLayoutStore((state) => state.sidebarOpen);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Render a loading state during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="w-[240px] border-r border-border bg-muted/30" />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} />
      <main
        className={cn(
          "flex-1 overflow-auto transition-all duration-200"
        )}
      >
        {children}
      </main>
    </div>
  );
}
