"use client";

import * as React from "react";
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
    <div className="h-screen overflow-hidden bg-background">
      <main className="h-full overflow-auto">
        {children}
      </main>
      {/* Timed feedback survey - shows after 5 minutes */}
      <TimedSurvey />
    </div>
  );
}
