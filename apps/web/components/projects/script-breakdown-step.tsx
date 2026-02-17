"use client";

import * as React from "react";
import { Loader2, FileText, Sparkles, Check, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BreakdownPreviewModal } from "./breakdown-preview-modal";
import { AgentProgressCard } from "@/components/agents/agent-progress-card";
import { useAgentJob, useStartAgentJob } from "@/lib/hooks/use-agent-job";
import type { ExtractedScene, BreakdownResult } from "@/lib/actions/script-breakdown";
import type { AgentJobResult } from "@/lib/agents/types";

interface ScriptBreakdownStepProps {
  projectId: string;
  scriptId?: string;
  scriptUrl?: string;
  scriptName?: string;
  onComplete: (scenesImported: number) => void;
  onSkip: () => void;
}

type BreakdownState = "idle" | "analyzing" | "agent_running" | "preview" | "importing" | "complete" | "error";

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
  const [useAdvancedAgent, setUseAdvancedAgent] = React.useState(true);
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null);

  const { startJob, loading: startingJob } = useStartAgentJob();
  const { job, isComplete: agentComplete, isFailed: agentFailed } = useAgentJob({
    jobId: activeJobId || undefined,
  });

  // Handle agent completion
  React.useEffect(() => {
    if (agentComplete && job?.result) {
      const result = job.result as AgentJobResult;
      setState("complete");
      onComplete(result.scenesCreated);
    }
  }, [agentComplete, job?.result, onComplete]);

  // Handle agent failure
  React.useEffect(() => {
    if (agentFailed && job?.errorMessage) {
      setError(job.errorMessage);
      setState("error");
    }
  }, [agentFailed, job?.errorMessage]);

  const handleAnalyzeWithAgent = async () => {
    if (!scriptId) {
      setError("No script available to analyze");
      return;
    }

    setState("agent_running");
    setError(null);

    const jobId = await startJob(projectId, scriptId, "script_analysis");
    if (jobId) {
      setActiveJobId(jobId);
    } else {
      setError("Failed to start analysis agent");
      setState("error");
    }
  };

  const handleAnalyzeLegacy = async () => {
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

  const handleAnalyze = () => {
    if (useAdvancedAgent) {
      handleAnalyzeWithAgent();
    } else {
      handleAnalyzeLegacy();
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

  const handleRetry = () => {
    setActiveJobId(null);
    setState("idle");
    setError(null);
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

        {/* Analysis mode toggle */}
        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAdvancedAgent}
              onChange={(e) => setUseAdvancedAgent(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Use Advanced Agent</span>
            </div>
          </label>
          <p className="text-xs text-muted-foreground ml-6 mt-1">
            {useAdvancedAgent
              ? "Extracts scenes, elements, cast, synopses, and time estimates. Handles large scripts better."
              : "Basic scene extraction only. Faster but less comprehensive."}
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleAnalyze}
            className="w-full"
            disabled={startingJob}
          >
            {startingJob ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyze Script with Wrapshot Intelligence
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
            Skip and add scenes manually
          </Button>
        </div>
      </div>
    );
  }

  // Agent running state
  if (state === "agent_running" && activeJobId) {
    return (
      <div className="py-4">
        <h2 className="text-xl font-semibold mb-4">Analyzing Script...</h2>
        <AgentProgressCard
          jobId={activeJobId}
          onRetry={handleRetry}
          className="mb-4"
        />
        <p className="text-sm text-muted-foreground text-center mt-4">
          The agent is extracting scenes, characters, elements, and generating synopses.
          This process handles large scripts in chunks for better accuracy.
        </p>
      </div>
    );
  }

  // Legacy analyzing state
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
    const scenesCount = job?.result
      ? (job.result as AgentJobResult).scenesCreated
      : scenesToImport.length;

    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Breakdown Complete!</h2>
        <p className="text-muted-foreground max-w-md mx-auto mb-6">
          {scenesCount} scenes have been imported from your script.
          You can review and edit them in the Stripeboard.
        </p>
        {job?.result && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{(job.result as AgentJobResult).elementsCreated} production elements identified</p>
            <p>{(job.result as AgentJobResult).castLinked} cast members linked</p>
          </div>
        )}
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
          <Button onClick={handleRetry} variant="outline" className="w-full">
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
