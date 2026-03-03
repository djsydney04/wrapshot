"use client";

import * as React from "react";
import {
  SlidePanel,
  SlidePanelHeader,
  SlidePanelTitle,
  SlidePanelDescription,
} from "@/components/ui/slide-panel";
import { AIIndicator } from "@/components/ai/ai-indicator";
import { useAssistantPanelStore } from "@/lib/stores/assistant-panel-store";
import { useLayoutStore } from "@/lib/stores/layout-store";
import { AssistantChatCore } from "./assistant-chat-core";

export function AssistantPanel() {
  const { panelOpen, closePanel } = useAssistantPanelStore();
  const activeProjectId = useLayoutStore((s) => s.activeProjectId);

  if (!activeProjectId) {
    return (
      <SlidePanel
        open={panelOpen}
        onOpenChange={(open) => !open && closePanel()}
        side="right"
        className="w-[420px] max-w-[95vw] border-l border-border/80 bg-card/95"
      >
        <SlidePanelHeader
          onClose={closePanel}
          className="border-border/80 bg-muted/25 px-4 py-3.5"
        >
          <SlidePanelTitle>Project Agent</SlidePanelTitle>
          <SlidePanelDescription>
            Open a project to use context-aware actions.
          </SlidePanelDescription>
        </SlidePanelHeader>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="max-w-[250px] text-sm text-muted-foreground">
            Navigate to a project to start chatting with the assistant.
          </p>
        </div>
      </SlidePanel>
    );
  }

  return (
    <SlidePanel
      open={panelOpen}
      onOpenChange={(open) => !open && closePanel()}
      side="right"
      className="w-[420px] max-w-[95vw] border-l border-border/80 bg-card/95"
    >
      <SlidePanelHeader
        onClose={closePanel}
        className="border-border/80 bg-muted/25 px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <SlidePanelTitle>Project Agent</SlidePanelTitle>
          <AIIndicator variant="pill" size="sm" label="Live" />
        </div>
        <SlidePanelDescription>
          Ask, plan, and execute project tasks.
        </SlidePanelDescription>
      </SlidePanelHeader>
      <AssistantChatCore projectId={activeProjectId} compact />
    </SlidePanel>
  );
}
