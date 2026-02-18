/**
 * Job Manager
 *
 * Handles creation, retrieval, and lifecycle management of agent jobs.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { nanoid } from 'nanoid';
import { sanitizeForJsonb } from '@/lib/scripts/parser';
import type { AgentJob, AgentJobType, AgentContext, ScriptChunk } from '../types';

export interface CreateJobInput {
  projectId: string;
  scriptId: string;
  userId: string;
  jobType: AgentJobType;
  totalSteps?: number;
}

export class JobManager {
  /**
   * Create a new agent job
   */
  static async createJob(input: CreateJobInput): Promise<AgentJob> {
    const supabase = createAdminClient();
    const jobId = `job_${nanoid(12)}`;

    const job: Omit<AgentJob, 'createdAt' | 'startedAt' | 'completedAt' | 'processingTimeMs'> = {
      id: jobId,
      projectId: input.projectId,
      scriptId: input.scriptId,
      userId: input.userId,
      jobType: input.jobType,
      status: 'pending',
      currentStep: 0,
      totalSteps: input.totalSteps ?? 7, // Default for script_analysis
      progressPercent: 0,
      stepDescription: 'Waiting to start',
      result: null,
      errorMessage: null,
      errorDetails: null,
      context: null,
    };

    const { data, error } = await supabase
      .from('AgentJob')
      .insert(job)
      .select()
      .single();

    if (error) {
      console.error('[JobManager] Failed to create job:', error);
      throw new Error(`Failed to create agent job: ${error.message}`);
    }

    return data as AgentJob;
  }

  /**
   * Get a job by ID
   */
  static async getJob(jobId: string): Promise<AgentJob | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('AgentJob')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[JobManager] Failed to get job:', error);
      throw new Error(`Failed to get agent job: ${error.message}`);
    }

    return data as AgentJob;
  }

  /**
   * Get jobs for a project
   */
  static async getJobsForProject(projectId: string): Promise<AgentJob[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('AgentJob')
      .select('*')
      .eq('projectId', projectId)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('[JobManager] Failed to get jobs:', error);
      throw new Error(`Failed to get agent jobs: ${error.message}`);
    }

    return (data || []) as AgentJob[];
  }

  /**
   * Get the latest job for a script
   */
  static async getLatestJobForScript(scriptId: string): Promise<AgentJob | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('AgentJob')
      .select('*')
      .eq('scriptId', scriptId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[JobManager] Failed to get latest job:', error);
      return null;
    }

    return data as AgentJob;
  }

  /**
   * Check if there's an active job for a script
   */
  static async hasActiveJob(scriptId: string): Promise<boolean> {
    const supabase = createAdminClient();

    const activeStatuses = [
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

    const { data, error } = await supabase
      .from('AgentJob')
      .select('id')
      .eq('scriptId', scriptId)
      .in('status', activeStatuses)
      .limit(1);

    if (error) {
      console.error('[JobManager] Failed to check active job:', error);
      return false;
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('AgentJob')
      .update({
        status: 'cancelled',
        stepDescription: 'Analysis cancelled',
        completedAt: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('[JobManager] Failed to cancel job:', error);
      throw new Error(`Failed to cancel job: ${error.message}`);
    }
  }

  /**
   * Delete a job and its chunks
   */
  static async deleteJob(jobId: string): Promise<void> {
    const supabase = createAdminClient();

    // Chunks will cascade delete due to foreign key
    const { error } = await supabase
      .from('AgentJob')
      .delete()
      .eq('id', jobId);

    if (error) {
      console.error('[JobManager] Failed to delete job:', error);
      throw new Error(`Failed to delete job: ${error.message}`);
    }
  }

  /**
   * Save script chunks for a job
   */
  static async saveChunks(chunks: Omit<ScriptChunk, 'createdAt'>[]): Promise<void> {
    const supabase = createAdminClient();

    // Sanitize chunk text to remove null bytes that break PostgreSQL JSONB
    const sanitizedChunks = chunks.map(chunk => ({
      ...chunk,
      chunkText: chunk.chunkText.replace(/\u0000/g, ''),
      result: chunk.result ? sanitizeForJsonb(chunk.result) : chunk.result,
    }));

    const { error } = await supabase
      .from('ScriptChunk')
      .insert(sanitizedChunks);

    if (error) {
      console.error('[JobManager] Failed to save chunks:', error);
      throw new Error(`Failed to save script chunks: ${error.message}`);
    }
  }

  /**
   * Get chunks for a job
   */
  static async getChunks(jobId: string): Promise<ScriptChunk[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('ScriptChunk')
      .select('*')
      .eq('jobId', jobId)
      .order('chunkIndex', { ascending: true });

    if (error) {
      console.error('[JobManager] Failed to get chunks:', error);
      throw new Error(`Failed to get script chunks: ${error.message}`);
    }

    return (data || []) as ScriptChunk[];
  }

  /**
   * Update a chunk's processing status
   */
  static async updateChunk(
    chunkId: string,
    update: Partial<Pick<ScriptChunk, 'processed' | 'processedAt' | 'result' | 'error'>>
  ): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('ScriptChunk')
      .update(update)
      .eq('id', chunkId);

    if (error) {
      console.error('[JobManager] Failed to update chunk:', error);
      throw new Error(`Failed to update chunk: ${error.message}`);
    }
  }

  /**
   * Save job context for recovery
   */
  static async saveContext(jobId: string, context: AgentContext): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('AgentJob')
      .update({ context: sanitizeForJsonb(context) })
      .eq('id', jobId);

    if (error) {
      console.error('[JobManager] Failed to save context:', error);
      throw new Error(`Failed to save job context: ${error.message}`);
    }
  }

  /**
   * Cancel stale jobs that have been stuck in an active status for too long.
   * Any non-terminal job that wasn't created in the last 10 minutes is stale.
   * Also handles jobs with clock-skewed timestamps by checking startedAt.
   */
  static async cancelStaleJobs(scriptId: string): Promise<number> {
    const supabase = createAdminClient();

    const activeStatuses = [
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

    // Find all active jobs for this script
    const { data: activeJobs, error: fetchError } = await supabase
      .from('AgentJob')
      .select('id, createdAt, startedAt')
      .eq('scriptId', scriptId)
      .in('status', activeStatuses);

    if (fetchError || !activeJobs || activeJobs.length === 0) {
      return 0;
    }

    // Filter to truly stale jobs: older than 10 minutes by createdAt OR startedAt,
    // or with no startedAt set (never actually started)
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const staleIds = activeJobs
      .filter(job => {
        const createdAge = now - new Date(job.createdAt).getTime();
        const startedAge = job.startedAt ? now - new Date(job.startedAt).getTime() : Infinity;
        // Stale if either timestamp is >10min old, or if createdAt is in the future (clock skew)
        return createdAge > tenMinutes || startedAge > tenMinutes || createdAge < 0;
      })
      .map(job => job.id);

    if (staleIds.length === 0) {
      return 0;
    }

    const { error } = await supabase
      .from('AgentJob')
      .update({
        status: 'failed',
        errorMessage: 'Job timed out (stale) and was automatically cancelled',
        completedAt: new Date().toISOString(),
      })
      .in('id', staleIds);

    if (error) {
      console.error('[JobManager] Failed to cancel stale jobs:', error);
      return 0;
    }

    console.log(`[JobManager] Cancelled ${staleIds.length} stale job(s) for script ${scriptId}`);
    return staleIds.length;
  }

  /**
   * Cleanup old completed/failed jobs (older than 30 days)
   */
  static async cleanupOldJobs(): Promise<number> {
    const supabase = createAdminClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('AgentJob')
      .delete()
      .in('status', ['completed', 'failed', 'cancelled'])
      .lt('completedAt', thirtyDaysAgo)
      .select('id');

    if (error) {
      console.error('[JobManager] Failed to cleanup jobs:', error);
      return 0;
    }

    return data?.length ?? 0;
  }
}
