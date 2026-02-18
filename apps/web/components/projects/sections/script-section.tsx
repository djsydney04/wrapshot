"use client";

import * as React from "react";
import { FileText, Download, Eye, Trash2, Upload, Loader2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useProjectStore } from "@/lib/stores/project-store";
import { SCRIPT_COLORS, type Script } from "@/lib/types";
import { ScriptChangeBanner } from "@/components/ai/script-change-banner";
import { ScriptDiffModal } from "@/components/ai/script-diff-modal";
import { AnalysisResultsPanel } from "@/components/agents/analysis-results-panel";
import { createScript } from "@/lib/actions/scripts";
import { useStartAgentJob, useAgentJob } from "@/lib/hooks/use-agent-job";
import { useAgentProgressToast } from "@/lib/hooks/use-agent-progress-toast";
import { toast } from "sonner";
import { STEP_DEFINITIONS } from "@/lib/agents/constants";
import type { AgentJobStatus } from "@/lib/agents/types";

interface ScriptSectionProps {
  projectId: string;
  scripts: Script[] | any[];
  onScriptUploaded?: () => void;
  onAnalysisComplete?: () => void;
  onNavigate?: (section: string) => void;
}

export function ScriptSection({ projectId, scripts, onScriptUploaded, onAnalysisComplete, onNavigate }: ScriptSectionProps) {
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploadData, setUploadData] = React.useState({
    fileUrl: null as string | null,
    fileName: "",
    color: "WHITE" as Script["color"],
  });
  const [loading, setLoading] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Agent job state
  const [activeScriptId, setActiveScriptId] = React.useState<string | null>(null);
  const { startJob, loading: startingJob, error: startJobError } = useStartAgentJob();
  const { job, isRunning, isComplete, isFailed } = useAgentJob({ scriptId: activeScriptId || undefined });
  useAgentProgressToast({ job, isRunning, isComplete, isFailed });

  // Refresh parent data when a job reaches a terminal state.
  const prevJobStatusRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!job?.id) return;

    const currentStatus = job.status;
    const previousStatus = prevJobStatusRef.current;
    prevJobStatusRef.current = currentStatus;

    if (!isComplete && !isFailed) return;
    if (previousStatus === currentStatus) return;

    if (currentStatus === "completed" || currentStatus === "failed" || currentStatus === "cancelled") {
      onAnalysisComplete?.();
    }
  }, [job?.id, job?.status, isComplete, isFailed, onAnalysisComplete]);

  // Script change detection state
  const [scriptChanges, setScriptChanges] = React.useState<{
    changes: any[];
    summary: any;
    previousVersion: number;
    newVersion: number;
  } | null>(null);
  const [showDiffModal, setShowDiffModal] = React.useState(false);
  const [analyzingChanges, setAnalyzingChanges] = React.useState(false);

  const { addScript, deleteScript } = useProjectStore();

  const sortedScripts = React.useMemo(() => {
    return [...scripts].sort((a, b) => {
      const vA = typeof a.version === "string" ? parseInt(a.version, 10) : a.version;
      const vB = typeof b.version === "string" ? parseInt(b.version, 10) : b.version;
      return vB - vA;
    });
  }, [scripts]);

  React.useEffect(() => {
    if (activeScriptId || sortedScripts.length === 0) return;
    const latestScript = sortedScripts[0];
    if (latestScript?.id) {
      setActiveScriptId(latestScript.id);
    }
  }, [activeScriptId, sortedScripts]);

  const nextVersion = scripts.length > 0
    ? Math.max(...scripts.map((s) => {
        const v = typeof s.version === "string" ? parseInt(s.version, 10) : s.version;
        return isNaN(v) ? 0 : v;
      })) + 1
    : 1;

  const handleUpload = async () => {
    if (!uploadData.fileUrl || !uploadData.fileName) return;

    setLoading(true);

    try {
      // Save to database
      const result = await createScript({
        projectId,
        version: String(nextVersion),
        color: uploadData.color,
        fileUrl: uploadData.fileUrl,
        fileName: uploadData.fileName,
        isActive: true,
      });

      if (result.error || !result.data) {
        toast.error("Failed to save script", { description: result.error || "Unknown error" });
        setLoading(false);
        return;
      }

      const dbScript = result.data;

      // Also add to Zustand store for backward compat
      addScript({
        projectId,
        version: nextVersion,
        color: uploadData.color,
        fileUrl: uploadData.fileUrl,
        fileName: uploadData.fileName,
        uploadedAt: new Date().toISOString(),
      });

      // Notify parent to refresh script list
      onScriptUploaded?.();

      // Start the AI agent pipeline
      setActiveScriptId(dbScript.id);
      const jobId = await startJob(projectId, dbScript.id, "script_analysis");
      if (jobId) {
        toast.info("Script analysis started", {
          description: "AI is analyzing your script for scenes, cast, and elements",
        });
      } else {
        toast.error("Failed to start script analysis", {
          description: startJobError || "Check that the AI service is configured correctly",
        });
      }

      // If there's a previous version, trigger change detection
      if (sortedScripts.length > 0) {
        const previousScript = sortedScripts[0];
        setAnalyzingChanges(true);

        try {
          const response = await fetch("/api/ai/script-diff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              previousScript: `Previous script version ${previousScript.version}`,
              newScript: `New script version ${nextVersion}`,
              previousVersion: typeof previousScript.version === "string"
                ? parseInt(previousScript.version, 10)
                : previousScript.version,
              newVersion: nextVersion,
            }),
          });

          if (response.ok) {
            const { data } = await response.json();
            if (data.changes && data.changes.length > 0) {
              setScriptChanges({
                changes: data.changes,
                summary: data.summary,
                previousVersion: typeof previousScript.version === "string"
                  ? parseInt(previousScript.version, 10)
                  : previousScript.version,
                newVersion: nextVersion,
              });
            }
          }
        } catch (error) {
          console.error("Failed to analyze script changes:", error);
        } finally {
          setAnalyzingChanges(false);
        }
      }
    } catch (error) {
      console.error("Failed to upload script:", error);
      toast.error("Failed to upload script");
    }

    setLoading(false);
    setShowUpload(false);
    setUploadData({ fileUrl: null, fileName: "", color: "WHITE" });
    forceUpdate();
  };

  const handleRetryAnalysis = async () => {
    if (!activeScriptId) return;
    const jobId = await startJob(projectId, activeScriptId, "script_analysis");
    if (jobId) {
      toast.info("Retrying script analysis...");
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this script version?")) {
      deleteScript(id);
      forceUpdate();
    }
  };

  const colorOptions = Object.entries(SCRIPT_COLORS).map(([value, { label }]) => ({
    value,
    label,
  }));

  return (
    <div className="space-y-4">
      {/* Agent Progress UI — running/failed only */}
      {(isRunning || isFailed) && job && (
        <AgentProgressPanel
          job={job}
          isRunning={isRunning}
          isFailed={isFailed}
          onRetry={handleRetryAnalysis}
        />
      )}

      {/* Analysis Results Dashboard — shown after completion */}
      {isComplete && job?.result && (
        <AnalysisResultsPanel
          projectId={projectId}
          jobResult={job.result}
          onNavigate={(onNavigate as any) ?? (() => {})}
          onDataRefresh={onAnalysisComplete ?? (() => {})}
        />
      )}

      {/* Script Change Detection Banner */}
      {scriptChanges && (
        <ScriptChangeBanner
          changes={scriptChanges.changes}
          previousVersion={scriptChanges.previousVersion}
          newVersion={scriptChanges.newVersion}
          onReview={() => setShowDiffModal(true)}
          onDismiss={() => setScriptChanges(null)}
        />
      )}

      {/* Analyzing changes indicator */}
      {analyzingChanges && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing script changes...
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {scripts.length} version{scripts.length !== 1 ? "s" : ""} uploaded
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)} disabled={isRunning}>
          <Upload className="h-4 w-4 mr-1" />
          Upload New Version
        </Button>
      </div>

      {/* Script List */}
      {sortedScripts.length > 0 ? (
        <div className="space-y-3">
          {sortedScripts.map((script) => {
            const colorKey = (script.color || "WHITE") as keyof typeof SCRIPT_COLORS;
            const colorInfo = SCRIPT_COLORS[colorKey] || SCRIPT_COLORS.WHITE;
            const isLatest = sortedScripts.indexOf(script) === 0;
            const displayVersion = typeof script.version === "string" ? script.version : String(script.version);
            const displayName = script.fileName || `Script v${displayVersion}`;

            return (
              <div
                key={script.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
              >
                {/* Color indicator */}
                <div
                  className="w-2 h-full min-h-[60px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorInfo.color }}
                />

                {/* File icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{displayName}</p>
                    {isLatest && (
                      <Badge variant="default" className="text-[10px]">CURRENT</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>Version {displayVersion}</span>
                    <span>·</span>
                    <span
                      className="flex items-center gap-1"
                      style={{ color: colorInfo.color }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colorInfo.color }}
                      />
                      {colorInfo.label.split(" ")[0]}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(script.uploadedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {script.fileUrl && (
                    <>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={script.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={script.fileUrl} download>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(script.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">No script uploaded</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your script to auto-generate scenes, cast, and elements
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload Script
          </Button>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent onClose={() => setShowUpload(false)}>
          <DialogHeader>
            <DialogTitle>Upload Script</DialogTitle>
            <DialogDescription>
              Upload a new PDF version of your script for AI analysis
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Script File
              </label>
              <FileUpload
                value={uploadData.fileUrl}
                onChange={(url, fileName) =>
                  setUploadData({ ...uploadData, fileUrl: url, fileName: fileName || "" })
                }
                bucket="scripts"
                folder={projectId}
                accept="application/pdf,.pdf"
                placeholder="Drop your script PDF here"
                fileName={uploadData.fileName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Revision Color
              </label>
              <Select
                value={uploadData.color}
                onChange={(e) =>
                  setUploadData({ ...uploadData, color: e.target.value as Script["color"] })
                }
                options={colorOptions}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Industry standard color coding for script revisions
              </p>
            </div>

            {nextVersion > 1 && (
              <p className="text-sm text-muted-foreground">
                This will be uploaded as <strong>Version {nextVersion}</strong>
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadData.fileUrl || loading || startingJob}
            >
              {loading ? "Uploading..." : "Upload & Analyze Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Diff Modal */}
      {scriptChanges && (
        <ScriptDiffModal
          open={showDiffModal}
          onClose={() => setShowDiffModal(false)}
          changes={scriptChanges.changes}
          summary={scriptChanges.summary}
          previousVersion={scriptChanges.previousVersion}
          newVersion={scriptChanges.newVersion}
          onApplyChanges={(selectedActions) => {
            console.log("Applying actions:", selectedActions);
            setScriptChanges(null);
          }}
        />
      )}
    </div>
  );
}

// Progress panel subcomponent
function AgentProgressPanel({
  job,
  isRunning,
  isFailed,
  onRetry,
}: {
  job: any;
  isRunning: boolean;
  isFailed: boolean;
  onRetry: () => void;
}) {
  const stepInfo = STEP_DEFINITIONS[job.status as AgentJobStatus];
  const progress = job.progressPercent || 0;

  if (isFailed) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-red-900 dark:text-red-100">Analysis Failed</h3>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              {job.errorMessage || "An unexpected error occurred during script analysis."}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onRetry}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Retry Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Running state
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-blue-900 dark:text-blue-100">Analyzing Script</h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
            {job.stepDescription || stepInfo?.description || "Processing..."}
          </p>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
              <span>Step {job.currentStep} of {job.totalSteps}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-400 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
