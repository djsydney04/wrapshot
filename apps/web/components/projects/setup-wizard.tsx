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
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/ui/file-upload";
import { AddShootingDayForm } from "@/components/forms/add-shooting-day-form";
import { AddCastForm } from "@/components/forms/add-cast-form";
import { AddCrewForm } from "@/components/forms/add-crew-form";
import { ScriptBreakdownStep } from "@/components/projects/script-breakdown-step";
import { useProjectStore } from "@/lib/stores/project-store";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/actions/projects.types";

interface SetupWizardProps {
  projectId: string;
  project: Project;
  onComplete: () => void;
  onSkip: () => void;
}

type WizardStep = "welcome" | "script" | "breakdown" | "schedule" | "cast" | "crew" | "complete";

const STEPS: { id: WizardStep; label: string; icon: React.ElementType }[] = [
  { id: "welcome", label: "Welcome", icon: Clapperboard },
  { id: "script", label: "Script", icon: FileText },
  { id: "breakdown", label: "Breakdown", icon: Sparkles },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "cast", label: "Cast", icon: Users },
  { id: "crew", label: "Crew", icon: UserCircle },
  { id: "complete", label: "Done", icon: Check },
];

export function SetupWizard({
  projectId,
  project,
  onComplete,
  onSkip,
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

  const { addScript, getShootingDaysForProject, getCastForProject, getCrewForProject } =
    useProjectStore();

  const shootingDays = getShootingDaysForProject(projectId);
  const cast = getCastForProject(projectId);
  const crew = getCrewForProject(projectId);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

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

  const handleUploadScript = async () => {
    if (scriptUrl && scriptName) {
      // Add to local store for UI
      addScript({
        projectId,
        version: 1,
        color: "WHITE",
        fileUrl: scriptUrl,
        fileName: scriptName,
        uploadedAt: new Date().toISOString(),
      });

      // Also create in database to get scriptId for breakdown
      try {
        const { createScript } = await import("@/lib/actions/scripts");
        const result = await createScript({
          projectId,
          version: "1",
          color: "WHITE",
          fileUrl: scriptUrl,
          isActive: true,
        });
        if (result.data) {
          setUploadedScriptId(result.data.id);
        }
      } catch (err) {
        console.error("Error creating script:", err);
      }

      handleNext();
    } else {
      // Skip script step and breakdown step
      setCurrentStep("schedule");
    }
  };

  const handleBreakdownComplete = (count: number) => {
    setScenesImported(count);
    handleNext();
  };

  const handleBreakdownSkip = () => {
    handleNext();
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
        return (
          <div className="py-4">
            <h2 className="text-xl font-semibold mb-2">Upload Your Script</h2>
            <p className="text-muted-foreground mb-6">
              Upload a PDF of your script to keep track of revisions. You can skip this
              if you don&apos;t have a script ready yet.
            </p>
            <FileUpload
              value={scriptUrl}
              onChange={(url, name) => {
                setScriptUrl(url);
                setScriptName(name || "");
              }}
              bucket="scripts"
              folder={projectId}
              accept="application/pdf"
              placeholder="Drop your script PDF here"
              fileName={scriptName}
            />
          </div>
        );

      case "breakdown":
        return (
          <ScriptBreakdownStep
            projectId={projectId}
            scriptId={uploadedScriptId || undefined}
            scriptUrl={scriptUrl || undefined}
            scriptName={scriptName || undefined}
            onComplete={handleBreakdownComplete}
            onSkip={handleBreakdownSkip}
          />
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

          {/* Content */}
          <div className="flex-1 overflow-auto px-6 py-4">{renderStepContent()}</div>

          {/* Footer */}
          {currentStep !== "complete" && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={currentStep === "welcome" ? onSkip : handlePrev}
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
              <Button
                onClick={currentStep === "script" ? handleUploadScript : handleNext}
              >
                {currentStep === "welcome" ? "Get Started" : "Continue"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
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
