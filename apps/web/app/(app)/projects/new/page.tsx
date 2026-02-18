"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/lib/actions/projects";
import { useAuth } from "@/components/providers/auth-provider";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  X,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_ROLE_LABELS, type ProjectRole } from "@/lib/permissions";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4;

interface CrewInvite {
  email: string;
  role: ProjectRole;
}

const statusOptions = [
  { value: "DEVELOPMENT", label: "Development", description: "Pre-production planning" },
  { value: "PRE_PRODUCTION", label: "Pre-Production", description: "Preparing for shoot" },
  { value: "PRODUCTION", label: "Production", description: "Currently shooting" },
  { value: "POST_PRODUCTION", label: "Post-Production", description: "Editing & finishing" },
  { value: "COMPLETED", label: "Completed", description: "Project finished" },
] as const;

const productionTypeOptions = [
  { value: "feature", label: "Feature Film" },
  { value: "short", label: "Short Film" },
  { value: "commercial", label: "Commercial" },
  { value: "music_video", label: "Music Video" },
  { value: "documentary", label: "Documentary" },
  { value: "tv_series", label: "TV Series" },
  { value: "tv_pilot", label: "TV Pilot" },
  { value: "web_series", label: "Web Series" },
  { value: "other", label: "Other" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = React.useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = React.useState(false);

  // Form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<string>("DEVELOPMENT");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [director, setDirector] = React.useState("");
  const [producer, setProducer] = React.useState("");
  const [productionType, setProductionType] = React.useState("");
  const [estimatedBudget, setEstimatedBudget] = React.useState("");

  // Crew invite state
  const [crewInvites, setCrewInvites] = React.useState<CrewInvite[]>([]);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>("CREW");

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return true; // Optional step
      case 3:
        return true; // Optional crew invite step
      case 4:
        return true; // Final step
      default:
        return false;
    }
  }, [step, name]);

  const handleNext = () => {
    if (step < 4) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleAddInvite = () => {
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes("@")) return;
    if (crewInvites.some((inv) => inv.email === trimmedEmail)) return;

    setCrewInvites([...crewInvites, { email: trimmedEmail, role: inviteRole }]);
    setInviteEmail("");
  };

  const handleRemoveInvite = (email: string) => {
    setCrewInvites(crewInvites.filter((inv) => inv.email !== email));
  };

  const handleCreate = async (withSetup: boolean) => {
    if (!user) {
      setError("Not authenticated. Please sign in.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newProject = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        status: status as "DEVELOPMENT" | "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "COMPLETED" | "ON_HOLD",
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        crewInvites: crewInvites.length > 0 ? crewInvites : undefined,
      });

      toast.info("Upload your script to auto-generate scenes, cast, and elements");

      if (withSetup) {
        router.push(`/projects/${newProject.id}?setup=true`);
      } else {
        router.push(`/projects/${newProject.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";

      // Check if it's a plan limit error
      if (message.startsWith("PLAN_LIMIT_REACHED:")) {
        setShowUpgradePrompt(true);
        setError(message.replace("PLAN_LIMIT_REACHED:", ""));
      } else {
        setError(message);
      }
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed && step < 4) {
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
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                s <= step ? "bg-foreground" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="w-[120px]" /> {/* Spacer for balance */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-8">
          {/* Step 1: Project Basics */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Create a new project</h1>
                <p className="text-muted-foreground mt-1">
                  Start by giving your project a name
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., The Great Adventure"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    placeholder="A brief description of your project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Project Details */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Project details</h1>
                <p className="text-muted-foreground mt-1">
                  Add more details to help organize your production
                </p>
              </div>

              <div className="space-y-4">
                {/* Production Type */}
                <div className="space-y-2">
                  <Label htmlFor="productionType">Production type</Label>
                  <select
                    id="productionType"
                    value={productionType}
                    onChange={(e) => setProductionType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select type...</option>
                    {productionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.slice(0, 4).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatus(option.value)}
                        className={cn(
                          "flex flex-col items-start p-2 rounded-md border text-left text-sm transition-colors",
                          status === option.value
                            ? "border-foreground bg-muted"
                            : "border-border hover:border-foreground/50"
                        )}
                      >
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Key Personnel */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="director">Director</Label>
                    <Input
                      id="director"
                      placeholder="Name"
                      value={director}
                      onChange={(e) => setDirector(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="producer">Producer</Label>
                    <Input
                      id="producer"
                      placeholder="Name"
                      value={producer}
                      onChange={(e) => setProducer(e.target.value)}
                    />
                  </div>
                </div>

                {/* Estimated Budget */}
                <div className="space-y-2">
                  <Label htmlFor="estimatedBudget">Estimated budget</Label>
                  <Input
                    id="estimatedBudget"
                    placeholder="e.g., $500,000"
                    value={estimatedBudget}
                    onChange={(e) => setEstimatedBudget(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Add Your Crew */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Add your crew</h1>
                <p className="text-muted-foreground mt-1">
                  Invite team members to collaborate on this project
                </p>
              </div>

              <div className="space-y-4">
                {/* Add invite form */}
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddInvite();
                      }
                    }}
                    className="flex-1"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {(["COORDINATOR", "DEPARTMENT_HEAD", "CREW", "CAST", "VIEWER"] as ProjectRole[]).map((role) => (
                      <option key={role} value={role}>
                        {PROJECT_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddInvite}
                    disabled={!inviteEmail.trim() || !inviteEmail.includes("@")}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Pending invites list */}
                {crewInvites.length > 0 && (
                  <div className="rounded-md border border-border divide-y divide-border">
                    {crewInvites.map((invite) => (
                      <div key={invite.email} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium uppercase">
                            {invite.email.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm">{invite.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {PROJECT_ROLE_LABELS[invite.role]}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveInvite(invite.email)}
                          className="h-7 w-7"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {crewInvites.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No crew members added yet. You can always invite people later.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review & Create */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Ready to create</h1>
                <p className="text-muted-foreground mt-1">
                  Review your project details
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Project name</span>
                  <span className="text-sm font-medium">{name}</span>
                </div>
                {description && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Description</span>
                    <span className="text-sm font-medium truncate max-w-[200px]">{description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="text-sm font-medium">{statusOptions.find(s => s.value === status)?.label}</span>
                </div>
                {crewInvites.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Team invites</span>
                    <span className="text-sm font-medium">{crewInvites.length} pending</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => handleCreate(false)}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create project
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleCreate(true)}
                  disabled={isSubmitting}
                  className="w-full text-muted-foreground"
                >
                  Create with guided setup
                </Button>
              </div>

              {showUpgradePrompt && (
                <div className="rounded-lg border border-[hsl(var(--feedback-warning-border))] bg-[hsl(var(--feedback-warning-bg))] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-[hsl(var(--feedback-warning-fg))] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-[hsl(var(--feedback-warning-fg))]">Project limit reached</h3>
                      <p className="text-sm text-[hsl(var(--feedback-warning-fg))] mt-1">
                        {error || "You've reached the project limit for your plan."}
                      </p>
                      <Button
                        className="mt-3"
                        size="sm"
                        onClick={() => router.push("/settings/billing")}
                      >
                        Upgrade Plan
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {error && !showUpgradePrompt && (
                <div className="rounded-lg border border-[hsl(var(--feedback-error-border))] bg-[hsl(var(--feedback-error-bg))] p-4">
                  <p className="text-sm text-[hsl(var(--feedback-error-fg))]">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      {step < 4 && (
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
              {(step === 2 || step === 3) && (
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
