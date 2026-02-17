"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AgentStatusBadge } from "./agent-status-badge";
import { useAgentJob } from "@/lib/hooks/use-agent-job";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import type { AgentJob, AgentJobResult } from "@/lib/agents/types";

interface AgentProgressCardProps {
  jobId?: string;
  scriptId?: string;
  className?: string;
  onComplete?: (result: AgentJobResult) => void;
  onError?: (error: string) => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function AgentProgressCard({
  jobId,
  scriptId,
  className,
  onComplete,
  onError,
  showRetry = true,
  onRetry,
}: AgentProgressCardProps) {
  const { job, loading, error, isRunning, isComplete, isFailed, cancel } =
    useAgentJob({ jobId, scriptId });

  const [cancelling, setCancelling] = useState(false);

  // Handle completion callback
  if (isComplete && job?.result && onComplete) {
    onComplete(job.result as AgentJobResult);
  }

  // Handle error callback
  if (isFailed && job?.errorMessage && onError) {
    onError(job.errorMessage);
  }

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancel();
    } catch (err) {
      console.error("Failed to cancel job:", err);
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !job) {
    return (
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading job status...
          </span>
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className={cn("rounded-lg border border-red-200 bg-red-50 p-4", className)}>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-all",
        isComplete && "border-green-200 bg-green-50/50",
        isFailed && "border-red-200 bg-red-50/50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AgentStatusBadge status={job.status} size="sm" />
          {job.processingTimeMs && (
            <span className="text-xs text-muted-foreground">
              {formatDuration(job.processingTimeMs)}
            </span>
          )}
        </div>
        {isRunning && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling}
            className="h-7 px-2 text-xs"
          >
            {cancelling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            <span className="ml-1">Cancel</span>
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Step {job.currentStep} of {job.totalSteps}</span>
            <span>{job.progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Step Description */}
      <div className="flex items-center gap-2 text-sm">
        {isRunning && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        )}
        {isComplete && (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
        {isFailed && (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        <span
          className={cn(
            isComplete && "text-green-700",
            isFailed && "text-red-700"
          )}
        >
          {job.stepDescription || job.status}
        </span>
      </div>

      {/* Error Message */}
      {isFailed && job.errorMessage && (
        <div className="mt-3 p-3 bg-red-100 rounded-md">
          <p className="text-sm text-red-700">{job.errorMessage}</p>
          {showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      )}

      {/* Results Summary */}
      {isComplete && job.result && (
        <div className="mt-3 p-3 bg-green-100 rounded-md">
          <ResultsSummary result={job.result as AgentJobResult} />
        </div>
      )}
    </div>
  );
}

function ResultsSummary({ result }: { result: AgentJobResult }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-green-700">
        <span>{result.scenesCreated} scenes created</span>
        <span>{result.elementsCreated} elements identified</span>
        <span>{result.castLinked} cast linked</span>
      </div>
      {result.warnings && result.warnings.length > 0 && (
        <div className="text-xs text-amber-700 mt-2">
          {result.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
