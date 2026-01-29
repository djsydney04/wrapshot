"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Sparkles, DollarSign, Loader2, Film, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuth } from "@/components/providers/auth-provider";
import { projectRoleHasPermission } from "@/lib/permissions";
import { createBudget } from "@/lib/actions/budgets";
import type { BudgetTemplate } from "@/lib/mock-data";

type Step = 1 | 2 | 3;

export default function NewBudgetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects } = useProjectStore();
  const { projectRoles } = useAuth();

  // Get projectId from URL if provided
  const urlProjectId = searchParams.get("projectId");

  // Filter projects where user can create budgets
  const projectsWithBudgetAccess = React.useMemo(() => {
    return projects.filter((project) => {
      const role = projectRoles[project.id];
      return projectRoleHasPermission(role, "budget:write");
    });
  }, [projects, projectRoles]);

  // State
  const [step, setStep] = React.useState<Step>(urlProjectId ? 2 : 1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(urlProjectId);
  const [selectedTemplate, setSelectedTemplate] = React.useState<BudgetTemplate | null>(null);
  const [budgetName, setBudgetName] = React.useState("");
  const [budgetDescription, setBudgetDescription] = React.useState("");

  // Get selected project details
  const selectedProject = projectsWithBudgetAccess.find(p => p.id === selectedProjectId);

  // Set budget name to project name when project is selected via URL
  React.useEffect(() => {
    if (selectedProject && !budgetName) {
      setBudgetName(selectedProject.name);
    }
  }, [selectedProject, budgetName]);

  // Mock templates - will be replaced with real data from API
  const templates: BudgetTemplate[] = [
    {
      id: "template-1",
      name: "Indie Feature",
      description: "Independent feature film with typical crew sizes and rates",
      budgetRange: "$1M - $5M",
      isSystemTemplate: true,
      templateData: {
        categories: [
          { code: "1000", name: "Above-the-Line" },
          { code: "2000", name: "Production" },
          { code: "3000", name: "Post-Production" },
          { code: "4000", name: "Other" },
        ],
        lineItems: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "template-2",
      name: "Commercial",
      description: "Commercial production with shorter schedules and higher day rates",
      budgetRange: "$50K - $500K",
      isSystemTemplate: true,
      templateData: {
        categories: [
          { code: "1000", name: "Creative" },
          { code: "2000", name: "Production" },
        ],
        lineItems: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "template-3",
      name: "Music Video",
      description: "Music video production with 1-3 day shoots",
      budgetRange: "$20K - $100K",
      isSystemTemplate: true,
      templateData: {
        categories: [
          { code: "1000", name: "Creative" },
          { code: "2000", name: "Production" },
        ],
        lineItems: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const totalSteps = urlProjectId ? 2 : 3;
  const adjustedStep = urlProjectId ? step - 1 : step;

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return selectedProjectId !== null;
      case 2:
        return selectedTemplate !== null || budgetName.trim().length > 0;
      case 3:
        return budgetName.trim().length > 0;
      default:
        return false;
    }
  }, [step, selectedProjectId, selectedTemplate, budgetName]);

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      // If we started with a projectId, going back from step 2 should go to finance
      if (urlProjectId && step === 2) {
        router.push("/finance");
      } else {
        setStep((step - 1) as Step);
      }
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    // Set budget name to project name by default
    const project = projectsWithBudgetAccess.find(p => p.id === projectId);
    if (project) {
      setBudgetName(project.name);
    }
  };

  const handleTemplateSelect = (template: BudgetTemplate) => {
    setSelectedTemplate(template);
    // Don't overwrite the budget name - keep the project name as default
  };

  const handleStartFromScratch = () => {
    setSelectedTemplate(null);
    // Don't clear the budget name - keep the project name as default
  };

  const handleCreate = async () => {
    if (!selectedProjectId || !budgetName.trim()) return;

    setIsSubmitting(true);

    try {
      const budget = await createBudget({
        projectId: selectedProjectId,
        versionName: budgetName.trim(),
        templateId: selectedTemplate?.id,
        notes: budgetDescription || undefined,
      });

      // Redirect to the new budget
      router.push(`/finance/${budget.id}`);
    } catch (error) {
      console.error("Failed to create budget:", error);
      setIsSubmitting(false);
      // TODO: Show error toast
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed && step < 3) {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "Escape") {
      router.push("/finance");
    }
  };

  // If no projects with budget access, show message
  if (projectsWithBudgetAccess.length === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <Link
            href="/finance"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Finance
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Film className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Projects Available</h2>
            <p className="text-muted-foreground mb-6">
              You need to create a project first, or you don&apos;t have permission to create budgets for your existing projects.
            </p>
            <Button onClick={() => router.push("/projects/new")}>
              Create Project
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/finance"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Finance
        </Link>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-8 rounded-full transition-colors",
                s <= adjustedStep ? "bg-foreground" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="w-[120px]" /> {/* Spacer for balance */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-xl px-6 py-12">
          {/* Step 1: Select Project (only if no projectId in URL) */}
          {step === 1 && !urlProjectId && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Film className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Select a project</h1>
                <p className="text-muted-foreground mt-2">
                  Choose the project you want to create a budget for
                </p>
              </div>

              <div className="space-y-3">
                {projectsWithBudgetAccess.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectSelect(project.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 transition-all text-left group",
                      selectedProjectId === project.id
                        ? "border-foreground bg-muted"
                        : "border-border hover:border-foreground/30 bg-card"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Film className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium group-hover:text-foreground">
                            {project.name}
                          </h3>
                          {selectedProjectId === project.id && (
                            <Check className="h-4 w-4 text-foreground" />
                          )}
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Choose Template */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Create a budget</h1>
                <p className="text-muted-foreground mt-2">
                  Choose a template to get started quickly, or build from scratch
                </p>
                {selectedProject && (
                  <p className="text-sm text-muted-foreground mt-1">
                    For <span className="font-medium text-foreground">{selectedProject.name}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {/* Start from Scratch Option */}
                <button
                  type="button"
                  onClick={handleStartFromScratch}
                  className={cn(
                    "w-full p-4 rounded-xl border-2 transition-all text-left group",
                    selectedTemplate === null
                      ? "border-foreground bg-muted"
                      : "border-border hover:border-foreground/30 bg-card"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      selectedTemplate === null
                        ? "bg-gradient-to-br from-purple-500 to-pink-500"
                        : "bg-gradient-to-br from-purple-500/80 to-pink-500/80"
                    )}>
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium group-hover:text-foreground">
                        Start from Scratch
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Build a custom budget tailored to your specific production
                      </p>
                    </div>
                  </div>
                </button>

                {/* Template Options */}
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={cn(
                      "w-full p-4 rounded-xl border-2 transition-all text-left group",
                      selectedTemplate?.id === template.id
                        ? "border-foreground bg-muted"
                        : "border-border hover:border-foreground/30 bg-card"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium group-hover:text-foreground">
                            {template.name}
                          </h3>
                          <span className="text-xs text-muted-foreground font-medium">
                            {template.budgetRange}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {template.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Budget Details */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Budget details</h1>
                <p className="text-muted-foreground mt-2">
                  Customize your budget settings
                </p>
              </div>

              <div className="space-y-4">
                {/* Project Info */}
                {selectedProject && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                        <Film className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{selectedProject.name}</h3>
                        {selectedProject.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {selectedProject.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Template Info */}
                {selectedTemplate && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                        <FileText className="h-5 w-5 text-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{selectedTemplate.name} Template</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedTemplate.description}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Budget Name */}
                <div className="space-y-2">
                  <Label htmlFor="budget-name" className="text-sm font-medium">
                    Budget Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="budget-name"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="e.g., Main Budget, Initial Budget"
                    className="h-12 text-lg"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="budget-description" className="text-sm font-medium">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <textarea
                    id="budget-description"
                    value={budgetDescription}
                    onChange={(e) => setBudgetDescription(e.target.value)}
                    placeholder="Add notes about this budget version..."
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Creating your budget...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <div>
            {(step > 1 || (urlProjectId && step === 2)) && (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 1 && !urlProjectId && (
              <Button onClick={handleNext} disabled={!canProceed}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleNext} disabled={!canProceed}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={!canProceed || isSubmitting}>
                Create Budget
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
