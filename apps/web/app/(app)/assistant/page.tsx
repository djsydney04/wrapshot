"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ProjectAssistantChat } from "@/components/assistant/project-assistant-chat";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuth } from "@/components/providers/auth-provider";

export default function AssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading } = useAuth();
  const projects = useProjectStore((state) => state.projects);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");

  React.useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId("");
      }
      return;
    }

    const projectIdFromQuery = searchParams.get("projectId");
    const queryProjectExists =
      projectIdFromQuery !== null &&
      projects.some((project) => project.id === projectIdFromQuery);
    const selectedProjectExists = projects.some((project) => project.id === selectedProjectId);

    const nextProjectId = queryProjectExists
      ? projectIdFromQuery!
      : selectedProjectExists
        ? selectedProjectId
        : projects[0].id;

    if (nextProjectId !== selectedProjectId) {
      setSelectedProjectId(nextProjectId);
    }
  }, [projects, searchParams, selectedProjectId]);

  const handleProjectChange = (nextProjectId: string) => {
    setSelectedProjectId(nextProjectId);

    const params = new URLSearchParams(searchParams.toString());
    params.set("projectId", nextProjectId);
    router.replace(`/assistant?${params.toString()}`, { scroll: false });
  };

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border/85 px-3 py-2 sm:px-4 sm:py-0">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground sm:gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">Dashboard</span>
          </Link>
          <span className="hidden text-muted-foreground/60 sm:inline">/</span>
          <span className="text-sm font-semibold">Assistant</span>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1320px] space-y-4 p-4 sm:p-5 md:p-6">
          <div className="skeuo-panel rounded-xl px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Standalone Assistant
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a project context and run planning conversations without opening project
                  sections.
                </p>
              </div>
              {selectedProject && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/projects/${selectedProject.id}?section=dashboard`)
                  }
                  className="gap-1.5"
                >
                  Open Project Dashboard
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="mt-3 max-w-md">
              <Select
                value={selectedProjectId}
                onChange={(event) => handleProjectChange(event.target.value)}
                options={projectOptions}
                placeholder="Select a project"
                disabled={projects.length === 0}
              />
            </div>
          </div>

          {authLoading && projects.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center rounded-xl border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
              <p className="text-base font-semibold">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a project first, then assistant chat will be project-aware.
              </p>
              <Button variant="skeuo" className="mt-4" asChild>
                <Link href="/projects/new">Create Project</Link>
              </Button>
            </div>
          ) : selectedProject ? (
            <ProjectAssistantChat
              projectId={selectedProject.id}
              projectName={selectedProject.name}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
