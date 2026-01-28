"use client";

import * as React from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { ProjectCard, ProjectsEmptyState } from "@/components/projects/project-card";
import { AddProjectForm } from "@/components/forms/add-project-form";
import { useProjectStore } from "@/lib/stores/project-store";
import { Plus } from "lucide-react";

export default function ProjectsPage() {
  const [showAddProject, setShowAddProject] = React.useState(false);
  const { projects } = useProjectStore();
  const hasProjects = projects.length > 0;

  return (
    <div className="flex h-full flex-col">
      <Header
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Projects" },
        ]}
        actions={
          <Button size="sm" className="gap-1" onClick={() => setShowAddProject(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="heading-lg">Projects</h1>
          <p className="mt-1 text-body-sm">
            {hasProjects
              ? `${projects.length} project${projects.length !== 1 ? "s" : ""}`
              : "Create your first project to get started"}
          </p>
        </div>

        {/* Projects Grid */}
        {hasProjects ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <ProjectsEmptyState onCreateProject={() => setShowAddProject(true)} />
        )}
      </div>

      {/* Add Project Form */}
      <AddProjectForm open={showAddProject} onOpenChange={setShowAddProject} />
    </div>
  );
}
