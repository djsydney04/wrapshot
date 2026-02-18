"use client";

import * as React from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText,
  Calendar,
  Users,
  UserCircle,
  Clapperboard,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { AddCastForm } from "@/components/forms/add-cast-form";
import { AddCrewForm } from "@/components/forms/add-crew-form";
import { AgentProgressCard } from "@/components/agents/agent-progress-card";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAgentJob, useStartAgentJob } from "@/lib/hooks/use-agent-job";
import { useAgentProgressToast } from "@/lib/hooks/use-agent-progress-toast";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/actions/projects.types";
import type { AgentJobResult } from "@/lib/agents/types";

interface SetupWizardProps {
  projectId: string;
  project: Project;
  onComplete: () => void;
  onSkip: () => void;
  onAnalysisComplete?: () => void | Promise<void>;
}

type WizardStep = "welcome" | "script" | "schedule" | "cast" | "crew" | "complete";

// Script step now includes upload + auto-analysis in one step
const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: "welcome", label: "Welcome", icon: Clapperboard },
  { id: "script", label: "Script", icon: FileText },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "cast", label: "Cast", icon: Users },
  { id: "crew", label: "Crew", icon: UserCircle },
  { id: "complete", label: "Done", icon: Check },
];

type ScriptState = "idle" | "uploading" | "analyzing" | "complete" | "error";

export function SetupWizard({
  projectId,
  project,
  onComplete,
  onSkip,
  onAnalysisComplete,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<WizardStep>("welcome");
  const [showAddDay, setShowAddDay] = React.useState(false);
  const [showAddCast, setShowAddCast] = React.useState(false);
  const [showAddCrew, setShowAddCrew] = React.useState(false);
  const [scriptUrl, setScriptUrl] = React.useState<string | null>(null);
  const [scriptName, setScriptName] = React.useState("");
  const [uploadedScriptId, setUploadedScriptId] = React.useState<string | null>(null);
  const [scenesImported, setScenesImported] = React.useState(0);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Script analysis state
  const [scriptState, setScriptState] = React.useState<ScriptState>("idle");
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);

  // Agent hooks
  const { startJob } = useStartAgentJob();
  const {
    job,
    isRunning: agentRunning,
    isComplete: agentComplete,
    isFailed: agentFailed,
  } = useAgentJob({
    jobId: activeJobId || undefined,
  });
  useAgentProgressToast({
    job,
    isRunning: agentRunning,
    isComplete: agentComplete,
    isFailed: agentFailed,
  });

  const { addScript, getShootingDaysForProject, getCastForProject, getCrewForProject } =
    useProjectStore();

  const shootingDays = getShootingDaysForProject(projectId);
  const cast = getCastForProject(projectId);
  const crew = getCrewForProject(projectId);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Handle agent completion
  React.useEffect(() => {
    if (agentComplete && job?.result) {
      const result = job.result as AgentJobResult;
      setScenesImported(result.scenesCreated);
      setScriptState("complete");
      void onAnalysisComplete?.();
    }
  }, [agentComplete, job?.result, onAnalysisComplete]);

  // Handle agent failure
  React.useEffect(() => {
    if (agentFailed && job?.errorMessage) {
      setAnalysisError(job.errorMessage);
      setScriptState("error");
      void onAnalysisComplete?.();
    }
  }, [agentFailed, job?.errorMessage, onAnalysisComplete]);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  // Handle file upload and immediately trigger analysis
  const handleScriptUpload = async (url: string | null, name?: string) => {
    setScriptUrl(url);
    setScriptName(name || "");

    if (!url || !name) {
      setScriptState("idle");
      return;
    }

    setScriptState("uploading");
    setAnalysisError(null);

    // Add to local store for UI
    addScript({
      projectId,
      version: 1,
      color: "WHITE",
      fileUrl: url,
      fileName: name,
      uploadedAt: new Date().toISOString(),
    });

    // Create in database and auto-start analysis
    try {
      const { createScript } = await import("@/lib/actions/scripts");
      const result = await createScript({
        projectId,
        version: "1",
        color: "WHITE",
        fileUrl: url,
        isActive: true,
      });

      if (result.data) {
        const newScriptId = result.data.id;
        setUploadedScriptId(newScriptId);

        // Auto-start the agent analysis
        setScriptState("analyzing");
        const { jobId, error: jobError } = await startJob(projectId, newScriptId, "script_analysis");

        if (jobId) {
          setActiveJobId(jobId);
        } else {
          setAnalysisError(jobError || "Failed to start script analysis");
          setScriptState("error");
        }
      } else {
        throw new Error(result.error || "Failed to save script");
      }
    } catch (err) {
      console.error("Error creating script:", err);
      setAnalysisError(err instanceof Error ? err.message : "Failed to upload script");
      setScriptState("error");
    }
  };

  const handleRetryAnalysis = async () => {
    if (!uploadedScriptId) return;

    setScriptState("analyzing");
    setAnalysisError(null);

    const { jobId, error: jobError } = await startJob(projectId, uploadedScriptId, "script_analysis");
    if (jobId) {
      setActiveJobId(jobId);
    } else {
      setAnalysisError(jobError || "Failed to start script analysis");
      setScriptState("error");
    }
  };

  const handleSkipScript = () => {
    setCurrentStep("schedule");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Clapperboard className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to {project.name}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Let&apos;s get your project set up. This quick guide will walk you through the
              essentials, but you can skip any step and come back later.
            </p>
          </div>
        );

      case "script":
        // Combined script upload + Smart analysis step
        return (
          <div className="py-4">
            {/* Initial upload state */}
            {scriptState === "idle" && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lightbulb className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Upload Your Script</h2>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Drop your script PDF below. Wrapshot Intelligence will automatically analyze it
                    and extract all scenes, characters, and production elements.
                  </p>
                </div>
                <FileUpload
                  value={scriptUrl}
                  onChange={handleScriptUpload}
                  bucket="scripts"
                  folder={projectId}
                  accept="application/pdf"
                  placeholder="Drop your script PDF here to begin"
                  fileName={scriptName}
                />
              </>
            )}

            {/* Uploading state */}
            {scriptState === "uploading" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Uploading Script...</h2>
                <p className="text-muted-foreground">{scriptName}</p>
              </div>
            )}

            {/* Analyzing state */}
            {scriptState === "analyzing" && activeJobId && (
              <div className="py-2">
                <div className="text-center mb-4">
                  <h2 className="text-xl font-semibold mb-2">Analyzing Your Script</h2>
                  <p className="text-muted-foreground text-sm">
                    Wrapshot Intelligence is extracting scenes, characters, and production elements.
                  </p>
                </div>
                <AgentProgressCard
                  jobId={activeJobId}
                  onRetry={handleRetryAnalysis}
                />
                <div className="mt-4 rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{scriptName}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Complete state */}
            {scriptState === "complete" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Script Analysis Complete!</h2>
                <p className="text-muted-foreground mb-4">
                  {scenesImported} scenes have been imported from your script.
                </p>
                {job?.result && (
                  <div className="inline-flex flex-col items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm">
                    <span>{(job.result as AgentJobResult).elementsCreated} production elements</span>
                    <span>{(job.result as AgentJobResult).castLinked} characters linked</span>
                  </div>
                )}
              </div>
            )}

            {/* Error state */}
            {scriptState === "error" && (
              <div className="py-4">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-4 dark:border-red-900 dark:bg-red-950">
                  <h3 className="font-medium text-red-800 dark:text-red-200 mb-1">Analysis Failed</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">{analysisError}</p>
                </div>
                <div className="space-y-2">
                  <Button onClick={handleRetryAnalysis} variant="outline" className="w-full">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case "schedule":
        return (
          <div className="py-4">
            <h2 className="text-xl font-semibold mb-2">Add Shooting Days</h2>
            <p className="text-muted-foreground mb-6">
              Set up your shooting schedule. Add at least one day to get started.
            </p>
            <div className="space-y-4">
              {shootingDays.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {shootingDays.length} day{shootingDays.length !== 1 ? "s" : ""} added:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shootingDays.slice(0, 5).map((day) => (
                      <span
                        key={day.id}
                        className="px-2 py-1 bg-muted rounded text-sm"
                      >
                        Day {day.dayNumber} -{" "}
                        {new Date(day.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ))}
                    {shootingDays.length > 5 && (
                      <span className="px-2 py-1 text-sm text-muted-foreground">
                        +{shootingDays.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={() => setShowAddDay(true)} variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Add Shooting Day
              </Button>
            </div>
          </div>
        );

      case "cast":
        return (
          <div className="py-4">
            <h2 className="text-xl font-semibold mb-2">Add Your Cast</h2>
            <p className="text-muted-foreground mb-6">
              Add cast members with their character names. You can add more details later.
            </p>
            <div className="space-y-4">
              {cast.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {cast.length} cast member{cast.length !== 1 ? "s" : ""} added:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cast.slice(0, 5).map((member) => (
                      <span
                        key={member.id}
                        className="px-2 py-1 bg-muted rounded text-sm"
                      >
                        #{member.castNumber} {member.characterName}
                      </span>
                    ))}
                    {cast.length > 5 && (
                      <span className="px-2 py-1 text-sm text-muted-foreground">
                        +{cast.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={() => setShowAddCast(true)} variant="outline" className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Add Cast Member
              </Button>
            </div>
          </div>
        );

      case "crew":
        return (
          <div className="py-4">
            <h2 className="text-xl font-semibold mb-2">Add Your Crew</h2>
            <p className="text-muted-foreground mb-6">
              Add key crew members organized by department. Start with department heads.
            </p>
            <div className="space-y-4">
              {crew.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {crew.length} crew member{crew.length !== 1 ? "s" : ""} added:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {crew.slice(0, 5).map((member) => (
                      <span
                        key={member.id}
                        className="px-2 py-1 bg-muted rounded text-sm"
                      >
                        {member.name} ({member.role})
                      </span>
                    ))}
                    {crew.length > 5 && (
                      <span className="px-2 py-1 text-sm text-muted-foreground">
                        +{crew.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={() => setShowAddCrew(true)} variant="outline" className="w-full">
                <UserCircle className="h-4 w-4 mr-2" />
                Add Crew Member
              </Button>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">You&apos;re All Set!</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Your project is ready to go. You can always add more details from the sidebar
              or come back to this guide anytime.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={onComplete}>
                Start Working
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border shadow-lg max-w-lg w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      currentStepIndex > index
                        ? "bg-primary text-primary-foreground"
                        : currentStepIndex === index
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {currentStepIndex > index ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "w-4 h-0.5 transition-colors",
                        currentStepIndex > index ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Background analysis indicator */}
          {currentStep !== "script" && currentStep !== "welcome" && scriptState === "analyzing" && (
            <div className="mx-6 mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span>Smart is still analyzing your script in the background{job?.progressPercent ? ` (${job.progressPercent}%)` : ""}...</span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">{renderStepContent()}</div>

          {/* Footer */}
          {currentStep !== "complete" && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={currentStep === "welcome" ? onSkip : handlePrev}
                disabled={currentStep === "script" && scriptState === "uploading"}
              >
                {currentStep === "welcome" ? (
                  "Skip Setup"
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </>
                )}
              </Button>

              {/* Script step has conditional buttons */}
              {currentStep === "script" ? (
                <div className="flex items-center gap-2">
                  {/* During idle/error, show skip option */}
                  {(scriptState === "idle" || scriptState === "error") && (
                    <Button variant="ghost" onClick={handleSkipScript}>
                      Skip for now
                    </Button>
                  )}
                  {/* After complete, show continue */}
                  {scriptState === "complete" && (
                    <Button onClick={handleNext}>
                      Continue
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                  {/* During analysis, let user continue while Smart works in background */}
                  {(scriptState === "uploading" || scriptState === "analyzing") && (
                    <Button onClick={handleNext} variant={scriptState === "uploading" ? "ghost" : "default"} disabled={scriptState === "uploading"}>
                      {scriptState === "uploading" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          Continue while Smart works
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <Button onClick={handleNext}>
                  {currentStep === "welcome" ? "Get Started" : "Continue"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Forms */}
      <AddShootingDayForm
        projectId={projectId}
        open={showAddDay}
        onOpenChange={setShowAddDay}
        onSuccess={forceUpdate}
      />
      <AddCastForm
        projectId={projectId}
        open={showAddCast}
        onOpenChange={setShowAddCast}
        onSuccess={forceUpdate}
      />
      <AddCrewForm
        projectId={projectId}
        open={showAddCrew}
        onOpenChange={setShowAddCrew}
        onSuccess={forceUpdate}
      />
    </>
  );
}
