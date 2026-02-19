"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Film,
  Loader2,
  AlertCircle,
  ChevronLeft,
  Settings,
  LogOut,
  ChevronDown,
  User,
  CreditCard,
  RefreshCw,
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
import { BudgetSection } from "@/components/projects/sections/budget-section";
import { CallSheetsSection } from "@/components/projects/sections/callsheets-section";
import { ArtSection } from "@/components/projects/sections/art-section";
import { CameraSection } from "@/components/projects/sections/camera-section";
import { GeSection } from "@/components/projects/sections/ge-section";
import { PostSection } from "@/components/projects/sections/post-section";
import { SettingsSection } from "@/components/projects/sections/settings-section";
import { AssistantSection } from "@/components/projects/sections/assistant-section";
import { SetupWizard } from "@/components/projects/setup-wizard";
import { useProjectStore } from "@/lib/stores/project-store";
import { useLayoutStore } from "@/lib/stores/layout-store";
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
import { cn } from "@/lib/utils";

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

const SECTION_META: Record<ProjectSection, { title: string; description: string }> = {
  dashboard: {
    title: "Project Dashboard",
    description: "Track setup progress, upcoming work, and production health at a glance.",
  },
  assistant: {
    title: "Project Agent",
    description: "Review project-aware agent output and ask follow-up planning questions.",
  },
  script: {
    title: "Script Intelligence",
    description: "Manage script versions, run analysis, and review extracted results.",
  },
  schedule: {
    title: "Schedule & Stripboard",
    description: "Build shooting days, assign scenes, and optimize run-of-show planning.",
  },
  callsheets: {
    title: "Call Sheets",
    description: "Create, publish, export, and distribute call sheets to cast and crew.",
  },
  art: {
    title: "Art",
    description:
      "Manage continuity, pull lists, and build/strike workflows linked to schedule and call sheets.",
  },
  camera: {
    title: "Camera",
    description:
      "Build shot lists, package requirements, rental bookings, and daily camera reports.",
  },
  ge: {
    title: "G&E",
    description:
      "Manage lighting plans, rigging dependencies, and power/safety readiness by shoot day.",
  },
  post: {
    title: "Post Production",
    description: "Run dailies ingest/QC, track cuts and notes, and manage VFX plus delivery.",
  },
  cast: {
    title: "Cast",
    description: "Maintain cast records, invites, and scene assignments.",
  },
  crew: {
    title: "Crew",
    description: "Organize team members by department, role, and production access.",
  },
  locations: {
    title: "Locations",
    description: "Manage locations, permit status, and location intelligence notes.",
  },
  scenes: {
    title: "Scenes",
    description: "Review and manage scenes across stripboard and production states.",
  },
  gear: {
    title: "Elements & Props",
    description: "Track production elements, props, and linked scene requirements.",
  },
  budget: {
    title: "Budget",
    description: "Control department budgets, spend tracking, and approval workflow.",
  },
  settings: {
    title: "Project Settings",
    description: "Manage project-level configuration and team permissions.",
  },
};

type DataKey = "scenes" | "scripts" | "cast" | "crew" | "locations" | "elements";

const SECTION_DATA_KEYS: Record<ProjectSection, DataKey[]> = {
  dashboard: ["scenes", "scripts", "cast", "crew"],
  assistant: [],
  script: ["scripts"],
  schedule: ["scenes", "locations", "cast"],
  callsheets: ["scenes", "cast", "crew"],
  art: ["scenes", "crew"],
  camera: ["scenes", "crew"],
  ge: ["scenes"],
  post: ["scenes"],
  cast: ["cast"],
  crew: ["crew"],
  locations: ["locations"],
  scenes: ["scenes", "cast"],
  gear: ["elements"],
  budget: [],
  settings: [],
};

const DATA_KEY_LABEL: Record<DataKey, string> = {
  scenes: "scenes",
  scripts: "scripts",
  cast: "cast",
  crew: "crew",
  locations: "locations",
  elements: "elements",
};

const SECTION_ORDER: ProjectSection[] = [
  "dashboard",
  "assistant",
  "script",
  "scenes",
  "schedule",
  "callsheets",
  "art",
  "camera",
  "ge",
  "post",
  "cast",
  "crew",
  "locations",
  "gear",
  "budget",
  "settings",
];

const WORKFLOW_PLAN: { id: string; label: string; section: ProjectSection }[] = [
  { id: "script", label: "Script Ready", section: "script" },
  { id: "breakdown", label: "Break Down Scenes", section: "scenes" },
  { id: "schedule", label: "Plan Shoot Days", section: "schedule" },
  { id: "callsheets", label: "Publish Call Sheets", section: "callsheets" },
  { id: "art", label: "Art Plan", section: "art" },
  { id: "camera", label: "Camera Plan", section: "camera" },
  { id: "ge", label: "G&E Plan", section: "ge" },
  { id: "post", label: "Post Readiness", section: "post" },
];

function normalizeSection(section: string | null): ProjectSection | null {
  if (!section) return null;
  if (section === "overview") return "dashboard";
  if (SECTION_ORDER.includes(section as ProjectSection)) {
    return section as ProjectSection;
  }
  return null;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const projectId = params.projectId as string;
  const sectionStorageKey = React.useMemo(
    () => `project-last-section-${projectId}`,
    [projectId]
  );
  const sectionFromQuery = React.useMemo(
    () => normalizeSection(searchParams.get("section")),
    [searchParams]
  );

  const setActiveProject = useLayoutStore((s) => s.setActiveProject);

  // Sync projectId to layout store so the assistant panel knows which project is active
  React.useEffect(() => {
    setActiveProject(projectId);
    return () => setActiveProject(null);
  }, [projectId, setActiveProject]);

  const [activeSection, setActiveSection] = React.useState<ProjectSection>("dashboard");
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
  const [loadErrors, setLoadErrors] = React.useState<Record<DataKey, string | null>>({
    scenes: null,
    scripts: null,
    cast: null,
    crew: null,
    locations: null,
    elements: null,
  });
  const loadedDataRef = React.useRef<Record<DataKey, boolean>>({
    scenes: false,
    scripts: false,
    cast: false,
    crew: false,
    locations: false,
    elements: false,
  });
  const inFlightLoadsRef = React.useRef<Partial<Record<DataKey, Promise<void>>>>({});
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
      if (inFlightLoadsRef.current[key]) {
        await inFlightLoadsRef.current[key];
        if (!force || loadedDataRef.current[key]) return;
      }

      const loadPromise = (async () => {
        setLoadErrors((previous) =>
          previous[key] === null ? previous : { ...previous, [key]: null }
        );

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
          setLoadErrors((previous) =>
            previous[key] === null ? previous : { ...previous, [key]: null }
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : `Failed to load ${key}`;
          console.error(`Error loading ${key}:`, error);
          loadedDataRef.current[key] = false;
          setLoadErrors((previous) => ({ ...previous, [key]: errorMessage }));
        } finally {
          delete inFlightLoadsRef.current[key];
        }
      })();

      inFlightLoadsRef.current[key] = loadPromise;
      await loadPromise;
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
      setLoadErrors({
        scenes: null,
        scripts: null,
        cast: null,
        crew: null,
        locations: null,
        elements: null,
      });
      inFlightLoadsRef.current = {};
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

  React.useEffect(() => {
    if (sectionFromQuery) {
      setActiveSection(sectionFromQuery);
      return;
    }

    const stored = localStorage.getItem(sectionStorageKey);
    const normalizedStored = normalizeSection(stored);
    if (normalizedStored) {
      setActiveSection(normalizedStored);
    }
  }, [sectionFromQuery, sectionStorageKey]);

  React.useEffect(() => {
    localStorage.setItem(sectionStorageKey, activeSection);
  }, [activeSection, sectionStorageKey]);

  React.useEffect(() => {
    if (loading || loadedData.scripts) return;
    void loadDataKey("scripts");
  }, [loadDataKey, loadedData.scripts, loading]);

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
  const { shootingDays: dbShootingDays, loading: shootingDaysLoading } = useShootingDays({ projectId });
  const gear = getGearForProject(projectId);
  const storeScripts = getScriptsForProject(projectId);
  const scripts = loadedData.scripts ? dbScripts : storeScripts;
  const scheduleLocations = loadedData.locations
    ? (dbLocations as any[])
    : [];
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

      const currentSection = normalizeSection(searchParams.get("section"));
      if (currentSection === section) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("section", section);
      router.replace(`/projects/${projectId}?${params.toString()}`, { scroll: false });
    },
    [projectId, router, searchParams]
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
  const hasScript = scripts.length > 0;
  const hasBreakdown = sidebarScenesCount > 0 && sidebarElementsCount > 0;
  const hasSchedule = sidebarShootingDaysCount > 0;
  const hasCallSheets = (sidebarShootingDaysCount > 0) && (crew.length > 0 || cast.length > 0);
  const hasArtPlan = sidebarScenesCount > 0 && sidebarShootingDaysCount > 0;
  const hasCameraPlan = sidebarScenesCount > 0 && sidebarShootingDaysCount > 0;
  const hasGePlan = sidebarScenesCount > 0 && sidebarShootingDaysCount > 0;
  const hasPostReadiness = sidebarScenesCount > 0 && sidebarShootingDaysCount > 0;

  const workflowCompletion = [
    hasScript,
    hasBreakdown,
    hasSchedule,
    hasCallSheets,
    hasArtPlan,
    hasCameraPlan,
    hasGePlan,
    hasPostReadiness,
  ];
  const firstPendingWorkflowIndex = workflowCompletion.findIndex((isComplete) => !isComplete);
  const workflowSteps = WORKFLOW_PLAN.map((step, index) => ({
    ...step,
    status: workflowCompletion[index]
      ? ("done" as const)
      : index === firstPendingWorkflowIndex
        ? ("current" as const)
        : ("upcoming" as const),
  }));

  const activeSectionDataKeys = SECTION_DATA_KEYS[activeSection];
  const activeSectionErrorKeys = activeSectionDataKeys.filter(
    (key) => Boolean(loadErrors[key])
  );
  const activeSectionLoading =
    activeSectionDataKeys.length > 0 &&
    activeSectionDataKeys.some((key) => !loadedData[key]) &&
    activeSectionErrorKeys.length === 0;
  const sectionMeta = SECTION_META[activeSection];

  const renderSection = () => {
    if (activeSectionErrorKeys.length > 0) {
      const labels = activeSectionErrorKeys.map((key) => DATA_KEY_LABEL[key]).join(", ");
      return (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-lg border border-border px-4 text-center">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Couldn&apos;t load {labels}.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadSectionData(activeSection, true)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      );
    }

    if (activeSectionLoading) {
      return (
        <div className="flex h-40 items-center justify-center rounded-lg border border-border">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    switch (activeSection) {
      case "dashboard":
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
      case "assistant":
        return <AssistantSection projectId={projectId} projectName={project.name} />;
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
        if (!loadedData.scenes || !loadedData.cast || shootingDaysLoading) {
          return (
            <div className="flex h-40 items-center justify-center rounded-lg border border-border">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          );
        }

        return (
          <ScheduleSection
            projectId={projectId}
            shootingDays={dbShootingDays}
            scenes={scheduleScenes}
            locations={scheduleLocations as any}
            stripeboardScenes={dbScenes}
            stripeboardCast={cast}
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
      case "art":
        return (
          <ArtSection
            projectId={projectId}
            scenes={dbScenes}
            shootingDays={shootingDays}
            crew={crew}
          />
        );
      case "camera":
        return (
          <CameraSection
            projectId={projectId}
            scenes={dbScenes}
            shootingDays={shootingDays}
            crew={crew}
          />
        );
      case "ge":
        return (
          <GeSection
            projectId={projectId}
            scenes={dbScenes}
            shootingDays={shootingDays}
          />
        );
      case "post":
        return (
          <PostSection
            projectId={projectId}
            shootingDays={shootingDays}
            scenes={dbScenes}
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
            projectName={project.name}
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
      case "budget":
        return <BudgetSection projectId={projectId} />;
      case "settings":
        return <SettingsSection projectId={projectId} project={project} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border/85 bg-background/75 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Projects</span>
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-sm font-semibold">{project.name}</span>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-shrink-0 border-r border-border/85 bg-background/65 md:flex md:flex-col">
          {/* Project Mini Header */}
          <div className="border-b border-border/85 p-4">
            <div className="skeuo-panel relative overflow-hidden rounded-xl p-3">
              <div className="skeuo-grain pointer-events-none absolute inset-0" />
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{project.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={statusVariant[project.status]} className="text-[10px]">
                      {statusLabel[project.status]}
                    </Badge>
                  </div>
                </div>
                <div className="skeuo-chip flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground">
                  <Film className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="relative mt-3 grid grid-cols-2 gap-2">
                <div className="skeuo-chip rounded-md px-2 py-1">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Scenes
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{sidebarScenesCount}</p>
                </div>
                <div className="skeuo-chip rounded-md px-2 py-1">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Shoot Days
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{sidebarShootingDaysCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <ProjectSidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            workflow={workflowSteps}
            counts={{
              scenes: sidebarScenesCount,
              cast: sidebarCastCount,
              crew: crew.length,
              locations: sidebarLocationsCount,
              shootingDays: sidebarShootingDaysCount,
              callSheets: sidebarShootingDaysCount,
              gear: sidebarElementsCount,
              hasScript,
            }}
            className="flex-1 px-2 py-2"
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {/* Mobile Section Tabs (hidden on desktop) */}
          <div className="border-b border-border px-4 py-2 md:hidden">
            <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
              {SECTION_ORDER.map(
                (section) => (
                  <button
                    key={section}
                    onClick={() => handleSectionChange(section)}
                    className={cn(
                      "whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      activeSection === section
                        ? "border-border bg-foreground text-background"
                        : "border-border/70 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {section === "callsheets"
                      ? "Call Sheets"
                      : section === "assistant"
                        ? "Agent"
                      : section === "art"
                        ? "Art"
                      : section === "camera"
                        ? "Camera"
                        : section === "ge"
                          ? "G&E"
                        : section === "post"
                          ? "Post"
                        : section.charAt(0).toUpperCase() + section.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[1320px] p-4 md:p-6">
            <div className="skeuo-panel mb-4 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {sectionMeta.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{sectionMeta.description}</p>
            </div>

            {/* Section Content */}
            <div
              className={cn("min-h-[220px]", "skeuo-panel rounded-2xl p-4 md:p-5")}
            >
              {renderSection()}
            </div>
          </div>
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
