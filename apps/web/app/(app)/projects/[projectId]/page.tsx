"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Film, MoreHorizontal } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectSidebar, type ProjectSection } from "@/components/projects/project-sidebar";
import { OverviewSection } from "@/components/projects/sections/overview-section";
import { ScenesSection } from "@/components/projects/sections/scenes-section";
import { CastSection } from "@/components/projects/sections/cast-section";
import { CrewSection } from "@/components/projects/sections/crew-section";
import { ScheduleSection } from "@/components/projects/sections/schedule-section";
import { GearSection } from "@/components/projects/sections/gear-section";
import { ScriptSection } from "@/components/projects/sections/script-section";
import { TeamSection } from "@/components/projects/sections/team-section";
import { SetupWizard } from "@/components/projects/setup-wizard";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Project } from "@/lib/mock-data";

const statusVariant: Record<Project["status"], "development" | "pre-production" | "production" | "post-production" | "completed" | "on-hold"> = {
  DEVELOPMENT: "development",
  PRE_PRODUCTION: "pre-production",
  PRODUCTION: "production",
  POST_PRODUCTION: "post-production",
  COMPLETED: "completed",
  ON_HOLD: "on-hold",
};

const statusLabel: Record<Project["status"], string> = {
  DEVELOPMENT: "Development",
  PRE_PRODUCTION: "Pre-Production",
  PRODUCTION: "Production",
  POST_PRODUCTION: "Post-Production",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [activeSection, setActiveSection] = React.useState<ProjectSection>("overview");
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardDismissed, setWizardDismissed] = React.useState(false);

  const {
    getProjectById,
    getScenesForProject,
    getCastForProject,
    getLocationsForProject,
    getShootingDaysForProject,
    getCrewForProject,
    getGearForProject,
    getScriptsForProject,
  } = useProjectStore();

  const project = getProjectById(projectId);
  const scenes = getScenesForProject(projectId);
  const cast = getCastForProject(projectId);
  const locations = getLocationsForProject(projectId);
  const shootingDays = getShootingDaysForProject(projectId);
  const crew = getCrewForProject(projectId);
  const gear = getGearForProject(projectId);
  const scripts = getScriptsForProject(projectId);

  // Check if project is new (show wizard)
  React.useEffect(() => {
    const isNewProject = scenes.length === 0 && cast.length === 0 && shootingDays.length === 0 && !wizardDismissed;
    // Check localStorage for wizard dismissal
    const dismissed = localStorage.getItem(`wizard-dismissed-${projectId}`);
    if (dismissed) {
      setWizardDismissed(true);
    } else if (isNewProject) {
      setShowWizard(true);
    }
  }, [projectId, scenes.length, cast.length, shootingDays.length, wizardDismissed]);

  const handleWizardComplete = () => {
    setShowWizard(false);
    setWizardDismissed(true);
    localStorage.setItem(`wizard-dismissed-${projectId}`, "true");
  };

  const handleWizardSkip = () => {
    setShowWizard(false);
    setWizardDismissed(true);
    localStorage.setItem(`wizard-dismissed-${projectId}`, "true");
  };

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <OverviewSection
            project={project}
            scenes={scenes}
            cast={cast}
            crew={crew}
            shootingDays={shootingDays}
            gear={gear}
            scripts={scripts}
            onNavigate={(section) => setActiveSection(section as ProjectSection)}
          />
        );
      case "script":
        return <ScriptSection projectId={projectId} scripts={scripts} />;
      case "schedule":
        return (
          <ScheduleSection
            projectId={projectId}
            shootingDays={shootingDays}
            scenes={scenes}
            locations={locations}
          />
        );
      case "cast":
        return <CastSection projectId={projectId} cast={cast} />;
      case "crew":
        return <CrewSection projectId={projectId} crew={crew} />;
      case "scenes":
        return (
          <ScenesSection
            projectId={projectId}
            scenes={scenes}
            cast={cast}
            shootingDays={shootingDays}
          />
        );
      case "gear":
        return (
          <GearSection
            projectId={projectId}
            gear={gear}
            scenes={scenes}
          />
        );
      case "team":
        return <TeamSection projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border flex-shrink-0 hidden md:flex flex-col">
          {/* Project Mini Header */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Film className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{project.name}</p>
                <Badge variant={statusVariant[project.status]} className="text-[10px] mt-0.5">
                  {statusLabel[project.status]}
                </Badge>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <ProjectSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            counts={{
              scenes: scenes.length,
              cast: cast.length,
              crew: crew.length,
              shootingDays: shootingDays.length,
              gear: gear.length,
              hasScript: scripts.length > 0,
            }}
            className="flex-1"
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile Section Tabs (hidden on desktop) */}
          <div className="md:hidden border-b border-border px-4 py-2 overflow-x-auto">
            <div className="flex gap-2">
              {(["overview", "scenes", "cast", "crew", "team", "schedule", "gear", "script"] as ProjectSection[]).map(
                (section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                      activeSection === section
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {section === "team" ? "Team Access" : section.charAt(0).toUpperCase() + section.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Section Content */}
          <div className="p-6">{renderSection()}</div>
        </main>
      </div>

      {/* Setup Wizard */}
      {showWizard && (
        <SetupWizard
          projectId={projectId}
          project={project}
          onComplete={handleWizardComplete}
          onSkip={handleWizardSkip}
        />
      )}
    </div>
  );
}
