"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { TimedSurvey } from "@/components/feedback/timed-survey";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    email?: string;
    name?: string;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar user={user} />
      <main className="flex-1 h-full overflow-auto">
        {children}
      </main>
      {/* Timed feedback survey - shows after 5 minutes */}
      <TimedSurvey />
    </div>
  );
}
