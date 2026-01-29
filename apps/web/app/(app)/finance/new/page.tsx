"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Sparkles, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { BudgetTemplate } from "@/lib/mock-data";

type Step = 1 | 2;

export default function NewBudgetPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedTemplate, setSelectedTemplate] = React.useState<BudgetTemplate | null>(null);
  const [budgetName, setBudgetName] = React.useState("");
  const [budgetDescription, setBudgetDescription] = React.useState("");

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

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return selectedTemplate !== null || budgetName.trim().length > 0;
      case 2:
        return budgetName.trim().length > 0;
      default:
        return false;
    }
  }, [step, selectedTemplate, budgetName]);

  const handleNext = () => {
    if (step < 2) {
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  };

  const handleTemplateSelect = (template: BudgetTemplate) => {
    setSelectedTemplate(template);
    setBudgetName(template.name);
  };

  const handleStartFromScratch = () => {
    setSelectedTemplate(null);
    setBudgetName("");
  };

  const handleCreate = async () => {
    setIsSubmitting(true);

    // TODO: Call API to create budget
    console.log("Creating budget:", {
      name: budgetName,
      description: budgetDescription,
      templateId: selectedTemplate?.id,
    });

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // For now, redirect back to finance page
    router.push("/finance");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed && step < 2) {
      e.preventDefault();
      handleNext();
    }
    if (e.key === "Escape") {
      router.push("/finance");
    }
  };

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
          {[1, 2].map((s) => (
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
          {/* Step 1: Choose Template */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-semibold">Create a budget</h1>
                <p className="text-muted-foreground mt-2">
                  Choose a template to get started quickly, or build from scratch
                </p>
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

          {/* Step 2: Budget Details */}
          {step === 2 && (
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
            {step > 1 && (
              <Button variant="ghost" onClick={handleBack} disabled={isSubmitting}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 1 && (
              <Button onClick={handleNext} disabled={!canProceed}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === 2 && (
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
