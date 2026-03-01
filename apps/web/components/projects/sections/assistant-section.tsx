"use client";

import { ProjectAssistantChat } from "@/components/assistant/project-assistant-chat";

interface AssistantSectionProps {
  projectId: string;
  projectName?: string;
  className?: string;
}

export function AssistantSection({
  projectId,
  projectName,
  className,
}: AssistantSectionProps) {
  return (
    <ProjectAssistantChat
      projectId={projectId}
      projectName={projectName}
      className={className}
    />
  );
}
