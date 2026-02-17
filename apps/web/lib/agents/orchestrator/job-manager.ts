/**
 * Job Manager
 *
 * Handles creation, retrieval, and lifecycle management of agent jobs.
 */

import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
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
    const supabase = await createClient();
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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

    const { error } = await supabase
      .from('ScriptChunk')
      .insert(chunks);

    if (error) {
      console.error('[JobManager] Failed to save chunks:', error);
      throw new Error(`Failed to save script chunks: ${error.message}`);
    }
  }

  /**
   * Get chunks for a job
   */
  static async getChunks(jobId: string): Promise<ScriptChunk[]> {
    const supabase = await createClient();

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
    const supabase = await createClient();

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
    const supabase = await createClient();

    const { error } = await supabase
      .from('AgentJob')
      .update({ context })
      .eq('id', jobId);

    if (error) {
      console.error('[JobManager] Failed to save context:', error);
      throw new Error(`Failed to save job context: ${error.message}`);
    }
  }

  /**
   * Cleanup old completed/failed jobs (older than 30 days)
   */
  static async cleanupOldJobs(): Promise<number> {
    const supabase = await createClient();
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
