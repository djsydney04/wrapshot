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

function getRunningToastContent(job: AgentJob): string {
  const progress = getClampedProgress(job.progressPercent);
  const stepText =
    job.stepDescription || STEP_DEFINITIONS[job.status]?.description || "Processing";

  return `${stepText} • Step ${Math.max(job.currentStep, 1)} of ${Math.max(job.totalSteps, 1)} (${progress}%)`;
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
      toast.loading("Analyzing your script", {
        id: toastId,
        description: getRunningToastContent(job),
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }

    if (isComplete) {
      toast.success("Script analysis complete", {
        id: toastId,
        description: getCompletionDescription(job),
      });
      return;
    }

    if (isFailed) {
      if (job.status === "cancelled") {
        toast("Script analysis cancelled", {
          id: toastId,
          description: "The script analysis job was cancelled.",
        });
        return;
      }

      toast.error("Script analysis failed", {
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
