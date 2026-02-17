"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AgentJob, AgentJobStatus, AgentProgressUpdate } from "@/lib/agents/types";

interface UseAgentJobOptions {
  jobId?: string;
  scriptId?: string;
  pollInterval?: number; // Fallback polling interval in ms
}

interface UseAgentJobReturn {
  job: AgentJob | null;
  loading: boolean;
  error: string | null;
  isRunning: boolean;
  isComplete: boolean;
  isFailed: boolean;
  refetch: () => Promise<void>;
  cancel: () => Promise<void>;
}

const RUNNING_STATUSES: AgentJobStatus[] = [
  'pending',
  'parsing',
  'chunking',
  'extracting_scenes',
  'extracting_elements',
  'linking_cast',
  'generating_synopses',
  'estimating_time',
  'creating_records',
  'suggesting_crew',
];

const TERMINAL_STATUSES: AgentJobStatus[] = ['completed', 'failed', 'cancelled'];

export function useAgentJob({
  jobId,
  scriptId,
  pollInterval = 5000,
}: UseAgentJobOptions = {}): UseAgentJobReturn {
  const [job, setJob] = useState<AgentJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch job from API
  const fetchJob = useCallback(async () => {
    if (!jobId && !scriptId) {
      setJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (jobId) params.set('jobId', jobId);
      else if (scriptId) params.set('scriptId', scriptId);

      const response = await fetch(`/api/agents/status?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 404) {
          setJob(null);
          return;
        }
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch job status');
      }

      const data = await response.json();
      setJob(data.job);
    } catch (err) {
      console.error('Error fetching agent job:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch job');
    } finally {
      setLoading(false);
    }
  }, [jobId, scriptId]);

  // Cancel job
  const cancel = useCallback(async () => {
    if (!job?.id) return;

    try {
      const response = await fetch('/api/agents/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel job');
      }

      // Refetch to get updated status
      await fetchJob();
    } catch (err) {
      console.error('Error cancelling job:', err);
      throw err;
    }
  }, [job?.id, fetchJob]);

  // Initial fetch
  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Subscribe to realtime updates
  useEffect(() => {
    const currentJobId = job?.id || jobId;
    if (!currentJobId) return;

    // Only subscribe if job is still running
    if (job && TERMINAL_STATUSES.includes(job.status)) {
      return;
    }

    const channel = supabase
      .channel(`agent-job-${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'AgentJob',
          filter: `id=eq.${currentJobId}`,
        },
        (payload) => {
          // Update job state with new data
          const newJob = payload.new as AgentJob;
          setJob(newJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, jobId, job?.status, supabase]);

  // Fallback polling for environments where realtime might not work
  useEffect(() => {
    const currentJobId = job?.id || jobId;
    if (!currentJobId) return;

    // Only poll if job is still running
    if (job && TERMINAL_STATUSES.includes(job.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchJob();
    }, pollInterval);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, jobId, job?.status, fetchJob, pollInterval]);

  // Computed states
  const isRunning = job ? RUNNING_STATUSES.includes(job.status) : false;
  const isComplete = job?.status === 'completed';
  const isFailed = job?.status === 'failed' || job?.status === 'cancelled';

  return {
    job,
    loading,
    error,
    isRunning,
    isComplete,
    isFailed,
    refetch: fetchJob,
    cancel,
  };
}

// Hook to start a new agent job
export function useStartAgentJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startJob = useCallback(async (
    projectId: string,
    scriptId: string,
    jobType: 'script_analysis' | 'schedule_planning' = 'script_analysis'
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agents/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, scriptId, jobType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start agent job');
      }

      const data = await response.json();
      return data.jobId;
    } catch (err) {
      console.error('Error starting agent job:', err);
      const message = err instanceof Error ? err.message : 'Failed to start job';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    startJob,
    loading,
    error,
  };
}
