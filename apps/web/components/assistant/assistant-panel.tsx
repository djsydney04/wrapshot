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
        className="w-[400px]"
      >
        <SlidePanelHeader onClose={closePanel}>
          <SlidePanelTitle>Wrapshot Assistant</SlidePanelTitle>
          <SlidePanelDescription>
            Open a project to use the assistant.
          </SlidePanelDescription>
        </SlidePanelHeader>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
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
      className="w-[400px]"
    >
      <SlidePanelHeader onClose={closePanel}>
        <div className="flex items-center gap-2">
          <SlidePanelTitle>Assistant</SlidePanelTitle>
          <AIIndicator variant="pill" size="sm" label="Agent" />
        </div>
        <SlidePanelDescription>
          Read, create, and modify project data.
        </SlidePanelDescription>
      </SlidePanelHeader>
      <AssistantChatCore
        projectId={activeProjectId}
        compact
      />
    </SlidePanel>
  );
}
