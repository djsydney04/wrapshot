"use client";

import * as React from "react";
import { Loader2, FileText, Sparkles, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreakdownPreviewModal } from "./breakdown-preview-modal";
import type { ExtractedScene, BreakdownResult } from "@/lib/actions/script-breakdown";

interface ScriptBreakdownStepProps {
  projectId: string;
  scriptId?: string;
  scriptUrl?: string;
  scriptName?: string;
  onComplete: (scenesImported: number) => void;
  onSkip: () => void;
}

type BreakdownState = "idle" | "analyzing" | "preview" | "importing" | "complete" | "error";

export function ScriptBreakdownStep({
  projectId,
  scriptId,
  scriptUrl,
  scriptName,
  onComplete,
  onSkip,
}: ScriptBreakdownStepProps) {
  const [state, setState] = React.useState<BreakdownState>("idle");
  const [breakdownResult, setBreakdownResult] = React.useState<BreakdownResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [scenesToImport, setScenesToImport] = React.useState<ExtractedScene[]>([]);

  const handleAnalyze = async () => {
    if (!scriptId || !scriptUrl) {
      setError("No script available to analyze");
      return;
    }

    setState("analyzing");
    setError(null);

    try {
      const response = await fetch("/api/scripts/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId, fileUrl: scriptUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Breakdown failed");
      }

      const result = await response.json();
      setBreakdownResult(result.data);
      setScenesToImport(result.data.scenes);
      setState("preview");
    } catch (err) {
      console.error("Breakdown error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze script");
      setState("error");
    }
  };

  const handleImport = async () => {
    if (!breakdownResult || scenesToImport.length === 0) return;

    setState("importing");

    try {
      const { importBreakdownScenes } = await import("@/lib/actions/script-breakdown");
      const result = await importBreakdownScenes(projectId, scriptId!, scenesToImport);

      if (!result.success) {
        throw new Error(result.error || "Import failed");
      }

      setState("complete");
      onComplete(result.scenesCreated ?? 0);
    } catch (err) {
      console.error("Import error:", err);
      setError(err instanceof Error ? err.message : "Failed to import scenes");
      setState("error");
    }
  };

  const handleRemoveScene = (index: number) => {
    setScenesToImport((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditScene = (index: number, updates: Partial<ExtractedScene>) => {
    setScenesToImport((prev) =>
      prev.map((scene, i) => (i === index ? { ...scene, ...updates } : scene))
    );
  };

  // No script uploaded
  if (!scriptId || !scriptUrl) {
    return (
      <div className="py-4">
        <h2 className="text-xl font-semibold mb-2">Wrapshot Intelligence Script Breakdown</h2>
        <p className="text-muted-foreground mb-6">
          No script has been uploaded yet. You can upload a script in the previous
          step to use Wrapshot Intelligence-powered scene extraction.
        </p>
        <Button variant="outline" onClick={onSkip} className="w-full">
          Skip This Step
        </Button>
      </div>
    );
  }

  // Idle state - ready to analyze
  if (state === "idle") {
    return (
      <div className="py-4">
        <h2 className="text-xl font-semibold mb-2">Wrapshot Intelligence Script Breakdown</h2>
        <p className="text-muted-foreground mb-6">
          We can automatically extract scenes, characters, and production elements
          from your script using Wrapshot Intelligence. This will save hours of manual breakdown
          work.
        </p>

        <div className="rounded-lg border border-border p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{scriptName || "Uploaded Script"}</p>
              <p className="text-xs text-muted-foreground">
                Ready for Wrapshot Intelligence analysis
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button onClick={handleAnalyze} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Analyze Script with Wrapshot Intelligence
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
            Skip and add scenes manually
          </Button>
        </div>
      </div>
    );
  }

  // Analyzing state
  if (state === "analyzing") {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Analyzing Script...</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Wrapshot Intelligence is reading through your script to identify scenes,
          characters, and production elements. This may take a minute.
        </p>
      </div>
    );
  }

  // Preview state
  if (state === "preview" && breakdownResult) {
    return (
      <BreakdownPreviewModal
        result={breakdownResult}
        scenes={scenesToImport}
        onRemoveScene={handleRemoveScene}
        onEditScene={handleEditScene}
        onImport={handleImport}
        onCancel={onSkip}
        isImporting={false}
      />
    );
  }

  // Importing state
  if (state === "importing") {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Importing Scenes...</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Creating scenes and linking characters to your project.
        </p>
      </div>
    );
  }

  // Complete state
  if (state === "complete") {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Breakdown Complete!</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {scenesToImport.length} scenes have been imported from your script.
          You can review and edit them in the Stripeboard.
        </p>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="py-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Analysis Failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button onClick={handleAnalyze} variant="outline" className="w-full">
            Try Again
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
            Skip and add scenes manually
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
