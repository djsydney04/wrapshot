"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Film, MoreHorizontal, Loader2 } from "lucide-react";
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
import { BudgetSection } from "@/components/projects/sections/budget-section";
import { SettingsSection } from "@/components/projects/sections/settings-section";
import { SetupWizard } from "@/components/projects/setup-wizard";
import { useProjectStore } from "@/lib/stores/project-store";
import { getProject, type Project } from "@/lib/actions/projects";
import { getScenes, type Scene as DBScene } from "@/lib/actions/scenes";
import { getBudgetsForProject, type Budget } from "@/lib/actions/budgets";
import { getCrewMembers, type CrewMember } from "@/lib/actions/crew";

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
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Database-backed data
  const [dbScenes, setDbScenes] = React.useState<DBScene[]>([]);
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [crew, setCrew] = React.useState<CrewMember[]>([]);

  // Still using store for other data (not yet migrated to DB)
  const {
    getScenesForProject,
    getCastForProject,
    getLocationsForProject,
    getShootingDaysForProject,
    getGearForProject,
    getScriptsForProject,
  } = useProjectStore();

  // Fetch project, scenes, budgets, and crew from database
  React.useEffect(() => {
    async function loadProject() {
      try {
        const [projectData, scenesResult, budgetsData, crewResult] = await Promise.all([
          getProject(projectId),
          getScenes(projectId),
          getBudgetsForProject(projectId),
          getCrewMembers(projectId),
        ]);
        setProject(projectData);
        if (scenesResult.data) setDbScenes(scenesResult.data);
        setBudgets(budgetsData);
        if (crewResult.data) setCrew(crewResult.data);
      } catch (err) {
        console.error("Error loading project:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  // Store data (for sections not yet migrated to use DB types)
  const storeScenes = getScenesForProject(projectId);
  const cast = getCastForProject(projectId);
  const locations = getLocationsForProject(projectId);
  const shootingDays = getShootingDaysForProject(projectId);
  const gear = getGearForProject(projectId);
  const scripts = getScriptsForProject(projectId);

  // Use DB scenes for the scenes section, store scenes for others (until migrated)
  const scenes = dbScenes.length > 0 ? dbScenes : storeScenes;

  // Check if project is new (show wizard)
  React.useEffect(() => {
    const totalScenes = dbScenes.length + storeScenes.length;
    const isNewProject = totalScenes === 0 && cast.length === 0 && shootingDays.length === 0 && !wizardDismissed;
    // Check localStorage for wizard dismissal
    const dismissed = localStorage.getItem(`wizard-dismissed-${projectId}`);
    if (dismissed) {
      setWizardDismissed(true);
    } else if (isNewProject) {
      setShowWizard(true);
    }
  }, [projectId, dbScenes.length, storeScenes.length, cast.length, shootingDays.length, wizardDismissed]);

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            scenes={storeScenes}
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
            scenes={storeScenes}
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
            scenes={dbScenes}
            cast={cast}
            shootingDays={shootingDays}
          />
        );
      case "gear":
        return (
          <GearSection
            projectId={projectId}
            gear={gear}
            scenes={storeScenes}
          />
        );
      case "team":
        return <TeamSection projectId={projectId} />;
      case "budget":
        return <BudgetSection projectId={projectId} />;
      case "settings":
        return <SettingsSection projectId={projectId} project={project} />;
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
              scenes: dbScenes.length || storeScenes.length,
              cast: cast.length,
              crew: crew.length,
              shootingDays: shootingDays.length,
              gear: gear.length,
              hasScript: scripts.length > 0,
              budgets: budgets.length,
            }}
            className="flex-1"
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile Section Tabs (hidden on desktop) */}
          <div className="md:hidden border-b border-border px-4 py-2 overflow-x-auto">
            <div className="flex gap-2">
              {(["overview", "scenes", "cast", "crew", "team", "schedule", "gear", "budget", "script", "settings"] as ProjectSection[]).map(
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
