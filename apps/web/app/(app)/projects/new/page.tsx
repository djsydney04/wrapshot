"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectStore } from "@/lib/stores/project-store";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  Calendar,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

const statusOptions = [
  { value: "DEVELOPMENT", label: "Development", description: "Pre-production planning" },
  { value: "PRE_PRODUCTION", label: "Pre-Production", description: "Preparing for shoot" },
  { value: "PRODUCTION", label: "Production", description: "Currently shooting" },
  { value: "POST_PRODUCTION", label: "Post-Production", description: "Editing & finishing" },
  { value: "COMPLETED", label: "Completed", description: "Project finished" },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const { addProject } = useProjectStore();
  const [step, setStep] = React.useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<string>("DEVELOPMENT");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [director, setDirector] = React.useState("");
  const [producer, setProducer] = React.useState("");

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return true; // Optional step
      case 3:
        return true; // Choice step
      default:
        return false;
    }
  }, [step, name]);

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleCreate = async (withSetup: boolean) => {
    setIsSubmitting(true);

    const newProject = addProject({
      name: name.trim(),
      description: description.trim() || "",
      status: status as "DEVELOPMENT" | "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "COMPLETED",
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      scenesCount: 0,
      shootingDaysCount: 0,
      castCount: 0,
      locationsCount: 0,
    });

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (withSetup) {
      // TODO: Open setup wizard on project page
      router.push(`/projects/${newProject.id}?setup=true`);
    } else {
      router.push(`/projects/${newProject.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed && step < 3) {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "Escape") {
      router.push("/projects");
    }
  };

  return (
    <div className="flex h-full flex-col bg-background" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/projects"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-8 rounded-full transition-colors",
                s <= step ? "bg-foreground" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="w-[120px]" /> {/* Spacer for balance */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-12">
          {/* Step 1: Project Basics */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Clapperboard className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Create a new project</h1>
                <p className="text-muted-foreground mt-2">
                  Start by giving your project a name
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Project Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., The Great Adventure"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 text-lg"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <textarea
                    id="description"
                    placeholder="A brief description of your project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Project Details */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Project details</h1>
                <p className="text-muted-foreground mt-2">
                  Add more details to help organize your project
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Production Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatus(option.value)}
                        className={cn(
                          "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                          status === option.value
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <span className="font-medium text-sm">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium">
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-sm font-medium">
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="director" className="text-sm font-medium">
                      Director
                    </Label>
                    <Input
                      id="director"
                      placeholder="Director name"
                      value={director}
                      onChange={(e) => setDirector(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="producer" className="text-sm font-medium">
                      Producer
                    </Label>
                    <Input
                      id="producer"
                      placeholder="Producer name"
                      value={producer}
                      onChange={(e) => setProducer(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Get Started */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-semibold">You&apos;re all set!</h1>
                <p className="text-muted-foreground mt-2">
                  Choose how you want to start working on <strong>{name}</strong>
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleCreate(true)}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-foreground bg-card transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-foreground">
                        Start with guided setup
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        We&apos;ll walk you through adding locations, scenes, cast, and crew
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleCreate(false)}
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-foreground bg-card transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium group-hover:text-foreground">
                        Jump right in
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Go straight to your project dashboard and set things up your way
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Creating your project...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      {step < 3 && (
        <div className="border-t border-border px-6 py-4">
          <div className="mx-auto max-w-xl flex items-center justify-between">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {step === 2 && (
                <Button variant="ghost" onClick={handleNext}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} disabled={!canProceed}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
