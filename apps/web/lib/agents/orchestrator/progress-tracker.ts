/**
 * Progress Tracker
 *
 * Updates AgentJob progress in the database for real-time UI updates via Supabase Realtime.
 */

import { createClient } from '@/lib/supabase/server';
import { sanitizeForJsonb } from '@/lib/scripts/parser';
import { STEP_DEFINITIONS, SCRIPT_ANALYSIS_STEPS } from '../constants';
import type { AgentJob, AgentJobStatus, AgentJobResult, AgentContext } from '../types';

export interface ProgressUpdate {
  status?: AgentJobStatus;
  currentStep?: number;
  totalSteps?: number;
  progressPercent?: number;
  stepDescription?: string;
  result?: AgentJobResult;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  context?: AgentContext;
}

export class ProgressTracker {
  private jobId: string;
  private cachedJob: AgentJob | null = null;

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Get the current job state
   */
  async getJob(): Promise<AgentJob | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('AgentJob')
      .select('*')
      .eq('id', this.jobId)
      .single();

    if (error) {
      console.error('[ProgressTracker] Failed to fetch job:', error);
      return null;
    }

    this.cachedJob = data as AgentJob;
    return this.cachedJob;
  }

  /**
   * Update job progress
   */
  async update(update: ProgressUpdate): Promise<void> {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = {};

    if (update.status !== undefined) {
      updateData.status = update.status;
    }
    if (update.currentStep !== undefined) {
      updateData.currentStep = update.currentStep;
    }
    if (update.totalSteps !== undefined) {
      updateData.totalSteps = update.totalSteps;
    }
    if (update.progressPercent !== undefined) {
      updateData.progressPercent = update.progressPercent;
    }
    if (update.stepDescription !== undefined) {
      updateData.stepDescription = update.stepDescription;
    }
    if (update.result !== undefined) {
      updateData.result = update.result;
    }
    if (update.errorMessage !== undefined) {
      updateData.errorMessage = update.errorMessage;
    }
    if (update.errorDetails !== undefined) {
      updateData.errorDetails = update.errorDetails;
    }
    if (update.context !== undefined) {
      updateData.context = sanitizeForJsonb(update.context);
    }

    // Sanitize any JSONB fields to remove null bytes that break PostgreSQL
    if (updateData.result) updateData.result = sanitizeForJsonb(updateData.result);
    if (updateData.errorDetails) updateData.errorDetails = sanitizeForJsonb(updateData.errorDetails);

    const { error } = await supabase
      .from('AgentJob')
      .update(updateData)
      .eq('id', this.jobId);

    if (error) {
      console.error('[ProgressTracker] Failed to update job:', error);
      throw new Error(`Failed to update job progress: ${error.message}`);
    }
  }

  /**
   * Mark job as started
   */
  async start(): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('AgentJob')
      .update({
        startedAt: new Date().toISOString(),
      })
      .eq('id', this.jobId);
  }

  /**
   * Transition to a new step
   */
  async transitionTo(status: AgentJobStatus): Promise<void> {
    const stepDefinition = STEP_DEFINITIONS[status];
    const stepIndex = SCRIPT_ANALYSIS_STEPS.indexOf(status);
    const totalSteps = SCRIPT_ANALYSIS_STEPS.length;

    // Calculate progress based on step weights
    const progressPercent = this.calculateProgress(status);

    await this.update({
      status,
      currentStep: stepIndex + 1,
      totalSteps,
      progressPercent,
      stepDescription: stepDefinition.description,
    });
  }

  /**
   * Update progress within current step
   */
  async updateProgress(
    completedItems: number,
    totalItems: number,
    itemDescription?: string
  ): Promise<void> {
    const job = await this.getJob();
    if (!job) return;

    const currentStepProgress = totalItems > 0 ? completedItems / totalItems : 0;
    const stepDefinition = STEP_DEFINITIONS[job.status];

    // Calculate overall progress including intra-step progress
    const baseProgress = this.calculateProgress(job.status, false);
    const stepWeight = stepDefinition.weight;
    const totalWeight = this.getTotalWeight();

    const progressPercent = Math.min(
      99,
      Math.round(baseProgress + (stepWeight * currentStepProgress / totalWeight) * 100)
    );

    const description = itemDescription
      ? `${stepDefinition.description} (${itemDescription})`
      : `${stepDefinition.description} (${completedItems}/${totalItems})`;

    await this.update({
      progressPercent,
      stepDescription: description,
    });
  }

  /**
   * Mark job as completed with results
   */
  async complete(result: AgentJobResult): Promise<void> {
    const supabase = await createClient();
    const job = await this.getJob();

    const processingTimeMs = job?.startedAt
      ? Date.now() - new Date(job.startedAt).getTime()
      : null;

    await supabase
      .from('AgentJob')
      .update({
        status: 'completed',
        progressPercent: 100,
        stepDescription: 'Analysis complete',
        result,
        completedAt: new Date().toISOString(),
        processingTimeMs,
      })
      .eq('id', this.jobId);
  }

  /**
   * Mark job as failed
   */
  async fail(errorMessage: string, errorDetails?: Record<string, unknown>): Promise<void> {
    const supabase = await createClient();
    const job = await this.getJob();

    const processingTimeMs = job?.startedAt
      ? Date.now() - new Date(job.startedAt).getTime()
      : null;

    await supabase
      .from('AgentJob')
      .update({
        status: 'failed',
        errorMessage,
        errorDetails: errorDetails || null,
        completedAt: new Date().toISOString(),
        processingTimeMs,
      })
      .eq('id', this.jobId);
  }

  /**
   * Mark job as cancelled
   */
  async cancel(): Promise<void> {
    await this.update({
      status: 'cancelled',
      stepDescription: 'Analysis cancelled',
    });
  }

  /**
   * Check if job has been cancelled
   */
  async isCancelled(): Promise<boolean> {
    const job = await this.getJob();
    return job?.status === 'cancelled';
  }

  /**
   * Save context for recovery
   */
  async saveContext(context: AgentContext): Promise<void> {
    await this.update({ context });
  }

  /**
   * Calculate cumulative progress percentage
   */
  private calculateProgress(currentStatus: AgentJobStatus, includeCurrentStep = false): number {
    const stepIndex = SCRIPT_ANALYSIS_STEPS.indexOf(currentStatus);
    if (stepIndex === -1) return 0;

    const totalWeight = this.getTotalWeight();
    let completedWeight = 0;

    for (let i = 0; i < stepIndex; i++) {
      const step = SCRIPT_ANALYSIS_STEPS[i];
      completedWeight += STEP_DEFINITIONS[step].weight;
    }

    if (includeCurrentStep) {
      completedWeight += STEP_DEFINITIONS[currentStatus].weight;
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }

  /**
   * Get total weight of all steps
   */
  private getTotalWeight(): number {
    return SCRIPT_ANALYSIS_STEPS.reduce(
      (sum, step) => sum + STEP_DEFINITIONS[step].weight,
      0
    );
  }

  /**
   * Create a progress tracker for a job
   */
  static create(jobId: string): ProgressTracker {
    return new ProgressTracker(jobId);
  }
}
