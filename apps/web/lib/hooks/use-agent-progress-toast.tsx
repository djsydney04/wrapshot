"use client";

import * as React from "react";
import { toast } from "sonner";
import { STEP_DEFINITIONS } from "@/lib/agents/constants";
import type { AgentJob } from "@/lib/agents/types";

interface UseAgentProgressToastOptions {
  job: AgentJob | null;
  isRunning: boolean;
  isComplete: boolean;
  isFailed: boolean;
}

function getClampedProgress(progressPercent: number): number {
  return Math.max(0, Math.min(100, progressPercent));
}

function getRunningToastContent(job: AgentJob): React.ReactNode {
  const progress = getClampedProgress(job.progressPercent);
  const stepText =
    job.stepDescription || STEP_DEFINITIONS[job.status]?.description || "Processing";

  return (
    <div className="w-[280px] space-y-1.5">
      <p className="text-xs leading-snug text-muted-foreground">{stepText}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Step {Math.max(job.currentStep, 1)} of {Math.max(job.totalSteps, 1)}
        </span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}

function getCompletionDescription(job: AgentJob): string {
  const result = job.result;
  if (!result) return "Your script analysis is complete.";

  return `${result.scenesCreated} scenes, ${result.elementsCreated} elements, ${result.castCreated} cast created`;
}

export function useAgentProgressToast({
  job,
  isRunning,
  isComplete,
  isFailed,
}: UseAgentProgressToastOptions): void {
  const lastStatusRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!job) return;

    const toastId = `agent-job-${job.id}`;
    const statusKey = `${job.status}:${job.progressPercent}:${job.currentStep}:${job.totalSteps}`;
    if (lastStatusRef.current === statusKey) return;
    lastStatusRef.current = statusKey;

    if (isRunning) {
      toast.loading("AI is working on your script", {
        id: toastId,
        description: getRunningToastContent(job),
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }

    if (isComplete) {
      toast.success("AI analysis complete", {
        id: toastId,
        description: getCompletionDescription(job),
      });
      return;
    }

    if (isFailed) {
      if (job.status === "cancelled") {
        toast("AI analysis cancelled", {
          id: toastId,
          description: "The script analysis job was cancelled.",
        });
        return;
      }

      toast.error("AI analysis failed", {
        id: toastId,
        description: job.errorMessage || "Something went wrong while analyzing your script.",
      });
    }
  }, [
    job,
    isRunning,
    isComplete,
    isFailed,
    job?.status,
    job?.progressPercent,
    job?.currentStep,
    job?.totalSteps,
  ]);
}
