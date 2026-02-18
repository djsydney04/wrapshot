"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Film,
  Loader2,
  ChevronLeft,
  Settings,
  LogOut,
  ChevronDown,
  User,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { ProjectSidebar, type ProjectSection } from "@/components/projects/project-sidebar";
import { OverviewSection } from "@/components/projects/sections/overview-section";
import { StripeboardSection } from "@/components/projects/sections/stripeboard-section";
import { CastSection } from "@/components/projects/sections/cast-section";
import { CrewSection } from "@/components/projects/sections/crew-section";
import { ScheduleSection } from "@/components/projects/sections/schedule-section";
import { ElementsSection } from "@/components/projects/sections/elements-section";
import { LocationsSection } from "@/components/projects/sections/locations-section";
import { ScriptSection } from "@/components/projects/sections/script-section";
import { TeamSection } from "@/components/projects/sections/team-section";
import { BudgetSection } from "@/components/projects/sections/budget-section";
import { CallSheetsSection } from "@/components/projects/sections/callsheets-section";
import { SettingsSection } from "@/components/projects/sections/settings-section";
import { SetupWizard } from "@/components/projects/setup-wizard";
import { useProjectStore } from "@/lib/stores/project-store";
import { getProject } from "@/lib/actions/projects";
import type { Project } from "@/lib/actions/projects.types";
import { getScenes, type Scene as DBScene } from "@/lib/actions/scenes";
import { getCrewMembersWithInviteStatus, type CrewMemberWithInviteStatus } from "@/lib/actions/crew";
import { getCastMembersWithInviteStatus, type CastMemberWithInviteStatus } from "@/lib/actions/cast";
import { getScripts, type Script as DBScript } from "@/lib/actions/scripts";
import { getLocationsWithSceneCounts, type Location as DBLocation } from "@/lib/actions/locations";
import { getElementsWithSceneCounts, type Element as DBElement } from "@/lib/actions/elements";
import { useShootingDays } from "@/lib/hooks/use-shooting-days";
import { useAgentJob } from "@/lib/hooks/use-agent-job";
import { useAgentProgressToast } from "@/lib/hooks/use-agent-progress-toast";
import { trackProjectViewed } from "@/lib/analytics/posthog";

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

type DataKey = "scenes" | "scripts" | "cast" | "crew" | "locations" | "elements";

const SECTION_DATA_KEYS: Record<ProjectSection, DataKey[]> = {
  overview: ["scenes", "scripts", "cast", "crew"],
  script: ["scripts"],
  schedule: ["scenes", "locations"],
  callsheets: ["scenes", "cast", "crew"],
  cast: ["cast"],
  crew: ["crew"],
  locations: ["locations"],
  scenes: ["scenes", "cast", "scripts"],
  gear: ["elements"],
  team: [],
  budget: [],
  settings: [],
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.projectId as string;

  const [activeSection, setActiveSection] = React.useState<ProjectSection>("scenes");
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardDismissed, setWizardDismissed] = React.useState(false);
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Database-backed data
  const [dbScenes, setDbScenes] = React.useState<DBScene[]>([]);
  const [dbScripts, setDbScripts] = React.useState<DBScript[]>([]);
  const [crew, setCrew] = React.useState<CrewMemberWithInviteStatus[]>([]);
  const [cast, setCast] = React.useState<CastMemberWithInviteStatus[]>([]);
  const [dbLocations, setDbLocations] = React.useState<DBLocation[]>([]);
  const [dbElements, setDbElements] = React.useState<DBElement[]>([]);
  const [loadedData, setLoadedData] = React.useState<Record<DataKey, boolean>>({
    scenes: false,
    scripts: false,
    cast: false,
    crew: false,
    locations: false,
    elements: false,
  });
  const loadedDataRef = React.useRef<Record<DataKey, boolean>>({
    scenes: false,
    scripts: false,
    cast: false,
    crew: false,
    locations: false,
    elements: false,
  });
  const trackedProjectRef = React.useRef<string | null>(null);

  // Still using store for other data (not yet migrated to DB)
  const {
    getScenesForProject,
    getCastForProject,
    getLocationsForProject,
    getShootingDaysForProject,
    getGearForProject,
    getScriptsForProject,
  } = useProjectStore();

  const loadProjectData = React.useCallback(async () => {
    const projectData = await getProject(projectId);
    setProject(projectData);

    if (projectData && trackedProjectRef.current !== projectData.id) {
      trackProjectViewed(projectData.id, projectData.name);
      trackedProjectRef.current = projectData.id;
    }
  }, [projectId]);

  const loadScenesData = React.useCallback(async () => {
    const scenesResult = await getScenes(projectId);
    if (scenesResult.error) {
      throw new Error(scenesResult.error);
    }
    setDbScenes(scenesResult.data || []);
  }, [projectId]);

  const loadScriptsData = React.useCallback(async () => {
    const scriptsResult = await getScripts(projectId);
    if (scriptsResult.error) {
      throw new Error(scriptsResult.error);
    }
    setDbScripts(scriptsResult.data || []);
  }, [projectId]);

  const loadCastData = React.useCallback(async () => {
    const castResult = await getCastMembersWithInviteStatus(projectId);
    if (castResult.error) {
      throw new Error(castResult.error);
    }
    setCast(castResult.data || []);
  }, [projectId]);

  const loadCrewData = React.useCallback(async () => {
    const crewResult = await getCrewMembersWithInviteStatus(projectId);
    if (crewResult.error) {
      throw new Error(crewResult.error);
    }
    setCrew(crewResult.data || []);
  }, [projectId]);

  const loadLocationsData = React.useCallback(async () => {
    const locationsResult = await getLocationsWithSceneCounts(projectId);
    if (locationsResult.error) {
      throw new Error(locationsResult.error);
    }
    setDbLocations(locationsResult.data || []);
  }, [projectId]);

  const loadElementsData = React.useCallback(async () => {
    const elementsResult = await getElementsWithSceneCounts(projectId);
    if (elementsResult.error) {
      throw new Error(elementsResult.error);
    }
    setDbElements(elementsResult.data || []);
  }, [projectId]);

  const loadDataKey = React.useCallback(
    async (key: DataKey, force = false) => {
      if (!force && loadedDataRef.current[key]) return;

      try {
        switch (key) {
          case "scenes":
            await loadScenesData();
            break;
          case "scripts":
            await loadScriptsData();
            break;
          case "cast":
            await loadCastData();
            break;
          case "crew":
            await loadCrewData();
            break;
          case "locations":
            await loadLocationsData();
            break;
          case "elements":
            await loadElementsData();
            break;
          default:
            break;
        }

        loadedDataRef.current[key] = true;
        setLoadedData((previous) =>
          previous[key] ? previous : { ...previous, [key]: true }
        );
      } catch (error) {
        console.error(`Error loading ${key}:`, error);
      }
    },
    [
      loadCastData,
      loadCrewData,
      loadElementsData,
      loadLocationsData,
      loadScenesData,
      loadScriptsData,
    ]
  );

  const loadSectionData = React.useCallback(
    async (section: ProjectSection, force = false) => {
      const dataKeys = SECTION_DATA_KEYS[section];
      await Promise.all(dataKeys.map((key) => loadDataKey(key, force)));
    },
    [loadDataKey]
  );

  React.useEffect(() => {
    let active = true;

    async function loadInitialData() {
      loadedDataRef.current = {
        scenes: false,
        scripts: false,
        cast: false,
        crew: false,
        locations: false,
        elements: false,
      };
      setLoadedData({
        scenes: false,
        scripts: false,
        cast: false,
        crew: false,
        locations: false,
        elements: false,
      });
      trackedProjectRef.current = null;
      setDbScenes([]);
      setDbScripts([]);
      setCast([]);
      setCrew([]);
      setDbLocations([]);
      setDbElements([]);
      setLoading(true);

      try {
        await Promise.all([loadProjectData(), loadSectionData("scenes", true)]);
      } catch (error) {
        console.error("Error loading project:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [loadProjectData, loadSectionData, projectId]);

  React.useEffect(() => {
    if (loading) return;
    void loadSectionData(activeSection);
  }, [activeSection, loadSectionData, loading]);

  // Callback to refresh loaded data after analysis completes
  const refreshData = React.useCallback(async () => {
    const loadedKeys = (Object.keys(loadedDataRef.current) as DataKey[]).filter(
      (key) => loadedDataRef.current[key]
    );

    try {
      await Promise.all([
        loadProjectData(),
        ...loadedKeys.map((key) => loadDataKey(key, true)),
      ]);
    } catch (err) {
      console.error("Error refreshing data:", err);
    }
  }, [loadDataKey, loadProjectData]);

  // Store data (for sections not yet migrated to use DB types)
  const storeScenes = getScenesForProject(projectId);
  const storeCast = getCastForProject(projectId);
  const storeLocations = getLocationsForProject(projectId);
  const storeShootingDays = getShootingDaysForProject(projectId);
  const { shootingDays: dbShootingDays } = useShootingDays({ projectId });
  const gear = getGearForProject(projectId);
  const storeScripts = getScriptsForProject(projectId);
  const scripts = loadedData.scripts ? dbScripts : storeScripts;
  const scheduleLocations = loadedData.locations
    ? (dbLocations as any[])
    : storeLocations;
  const elements = loadedData.elements ? dbElements : [];

  const monitoredScriptId = React.useMemo(() => {
    if (scripts.length === 0) return undefined;

    const activeScript = scripts.find(
      (script) =>
        typeof script === "object" &&
        script !== null &&
        "isActive" in script &&
        Boolean((script as { isActive?: boolean }).isActive)
    );
    if (activeScript?.id) return activeScript.id;

    return [...scripts]
      .sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )[0]?.id;
  }, [scripts]);

  const {
    job: projectAgentJob,
    isRunning: projectAgentRunning,
    isComplete: projectAgentComplete,
    isFailed: projectAgentFailed,
  } = useAgentJob({ scriptId: monitoredScriptId });

  useAgentProgressToast({
    job: projectAgentJob,
    isRunning: projectAgentRunning,
    isComplete: projectAgentComplete,
    isFailed: projectAgentFailed,
  });

  const previousAgentStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!projectAgentJob?.id) return;

    const currentStatus = projectAgentJob.status;
    const previousStatus = previousAgentStatusRef.current;
    previousAgentStatusRef.current = currentStatus;

    if (previousStatus === currentStatus) return;
    if (
      currentStatus === "completed" ||
      currentStatus === "failed" ||
      currentStatus === "cancelled"
    ) {
      void refreshData();
    }
  }, [projectAgentJob?.id, projectAgentJob?.status, refreshData]);

  // Use DB scenes for migrated sections, fallback to store data until loaded
  const scenes = loadedData.scenes ? dbScenes : storeScenes;
  const shootingDays = dbShootingDays.length > 0 ? dbShootingDays : storeShootingDays;
  const scheduleScenes = React.useMemo(() => {
    if (!loadedData.scenes) return storeScenes;
    if (dbScenes.length === 0) return [];

    return dbScenes.map((scene) => ({
      id: scene.id,
      projectId: scene.projectId,
      sceneNumber: scene.sceneNumber,
      synopsis: scene.synopsis || "",
      intExt: scene.intExt,
      dayNight: (["DAY", "NIGHT", "DAWN", "DUSK"].includes(scene.dayNight)
        ? scene.dayNight
        : "DAY") as "DAY" | "NIGHT" | "DAWN" | "DUSK",
      location: scene.location?.name || scene.setName || "",
      locationId: scene.locationId || undefined,
      pageCount: Number(scene.pageCount || 1),
      status: scene.status,
      castIds: (scene.cast || []).map((link) => link.castMemberId),
      scriptDay: scene.scriptDay || undefined,
      estimatedMinutes: scene.estimatedMinutes || undefined,
      notes: scene.notes || undefined,
      sortOrder: scene.sortOrder || 0,
    }));
  }, [dbScenes, loadedData.scenes, storeScenes]);

  // Check if project is new (show wizard only for first project ever)
  React.useEffect(() => {
    const totalScenes = loadedData.scenes
      ? dbScenes.length
      : dbScenes.length + storeScenes.length;
    const totalCast = loadedData.cast
      ? cast.length
      : cast.length + storeCast.length;
    const isNewProject = totalScenes === 0 && totalCast === 0 && shootingDays.length === 0 && !wizardDismissed;

    // Check localStorage for wizard dismissal (per-project and global)
    const dismissed = localStorage.getItem(`wizard-dismissed-${projectId}`);
    const hasSeenWizardBefore = localStorage.getItem("wizard-seen-first-project");

    if (dismissed || hasSeenWizardBefore) {
      setWizardDismissed(true);
    } else if (isNewProject) {
      setShowWizard(true);
    }
  }, [
    cast.length,
    dbScenes.length,
    loadedData.cast,
    loadedData.scenes,
    projectId,
    shootingDays.length,
    storeCast.length,
    storeScenes.length,
    wizardDismissed,
  ]);

  const handleWizardComplete = () => {
    setShowWizard(false);
    setWizardDismissed(true);
    localStorage.setItem(`wizard-dismissed-${projectId}`, "true");
    localStorage.setItem("wizard-seen-first-project", "true");
  };

  const handleWizardSkip = () => {
    setShowWizard(false);
    setWizardDismissed(true);
    localStorage.setItem(`wizard-dismissed-${projectId}`, "true");
    localStorage.setItem("wizard-seen-first-project", "true");
  };

  const handleSectionChange = React.useCallback(
    (section: ProjectSection) => {
      setActiveSection(section);
      void loadSectionData(section);
    },
    [loadSectionData]
  );

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

  const sidebarScenesCount = loadedData.scenes
    ? dbScenes.length
    : project.scenesCount;
  const sidebarCastCount = loadedData.cast ? cast.length : project.castCount;
  const sidebarLocationsCount = loadedData.locations
    ? dbLocations.length
    : project.locationsCount;
  const sidebarShootingDaysCount =
    dbShootingDays.length > 0
      ? dbShootingDays.length
      : project.shootingDaysCount;
  const sidebarElementsCount = loadedData.elements ? elements.length : 0;

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <OverviewSection
            project={project}
            scenes={scheduleScenes}
            cast={cast}
            crew={crew}
            shootingDays={shootingDays}
            gear={gear}
            scripts={scripts as any}
            onNavigate={(section) => handleSectionChange(section as ProjectSection)}
          />
        );
      case "script":
        return (
          <ScriptSection
            projectId={projectId}
            scripts={scripts}
            onScriptUploaded={refreshData}
            onAnalysisComplete={refreshData}
            onNavigate={(section) => handleSectionChange(section as ProjectSection)}
          />
        );
      case "schedule":
        return (
          <ScheduleSection
            projectId={projectId}
            shootingDays={shootingDays}
            scenes={scheduleScenes}
            locations={scheduleLocations as any}
            useMockData={false}
          />
        );
      case "callsheets":
        return (
          <CallSheetsSection
            projectId={projectId}
            shootingDays={shootingDays}
            scenes={dbScenes}
            cast={cast}
            crew={crew}
          />
        );
      case "cast":
        return <CastSection projectId={projectId} cast={cast} />;
      case "crew":
        return <CrewSection projectId={projectId} crew={crew} />;
      case "locations":
        return (
          <LocationsSection
            projectId={projectId}
            locations={dbLocations}
            onRefresh={refreshData}
          />
        );
      case "scenes":
        return (
          <StripeboardSection
            projectId={projectId}
            scenes={dbScenes}
            cast={cast}
            shootingDays={shootingDays}
          />
        );
      case "gear":
        return (
          <ElementsSection
            projectId={projectId}
            elements={elements}
            onRefresh={refreshData}
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
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Projects</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{project.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <FeedbackButton variant="header" source="top_bar" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar alt={user?.email || "User"} size="sm" />
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.email?.split("@")[0] || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/billing")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/team")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <DropdownMenuItem type="submit">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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
            onSectionChange={handleSectionChange}
            counts={{
              scenes: sidebarScenesCount,
              cast: sidebarCastCount,
              crew: crew.length,
              locations: sidebarLocationsCount,
              shootingDays: sidebarShootingDaysCount,
              callSheets: sidebarShootingDaysCount,
              gear: sidebarElementsCount,
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
              {(["overview", "scenes", "cast", "crew", "locations", "team", "schedule", "callsheets", "gear", "budget", "script", "settings"] as ProjectSection[]).map(
                (section) => (
                  <button
                    key={section}
                    onClick={() => handleSectionChange(section)}
                    className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                      activeSection === section
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {section === "team" ? "Team Access" : section === "callsheets" ? "Call Sheets" : section.charAt(0).toUpperCase() + section.slice(1)}
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
          onAnalysisComplete={refreshData}
        />
      )}
    </div>
  );
}
