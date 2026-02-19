"use client";

import * as React from "react";
import { TimedSurvey } from "@/components/feedback/timed-survey";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

interface AppShellProps {
  children: React.ReactNode;
  user?: {
    email?: string;
    name?: string;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="relative h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/18 via-white/5 to-transparent dark:from-white/6 dark:via-transparent"
      />
      <main className="relative h-full overflow-auto">
        {children}
      </main>
      {/* Timed feedback survey - shows after 5 minutes */}
      <TimedSurvey />
      {/* Persistent assistant side panel */}
      <AssistantPanel />
    </div>
  );
}
