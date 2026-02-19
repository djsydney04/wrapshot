"use client";

import { ProjectAssistantChat } from "@/components/assistant/project-assistant-chat";

interface AssistantSectionProps {
  projectId: string;
  projectName?: string;
}

export function AssistantSection({ projectId, projectName }: AssistantSectionProps) {
  return <ProjectAssistantChat projectId={projectId} projectName={projectName} />;
}
