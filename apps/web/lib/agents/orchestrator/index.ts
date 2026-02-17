/**
 * Agent Orchestrator
 *
 * Coordinates the execution of agent steps with progress tracking,
 * error recovery, and partial failure handling.
 */

import { ProgressTracker } from './progress-tracker';
import { JobManager } from './job-manager';
import { SCRIPT_ANALYSIS_STEPS } from '../constants';
import type {
  AgentContext,
  AgentJobStatus,
  AgentStepResult,
  AgentJobResult,
  ExtractedScene,
  ExtractedElement,
  LinkedCastMember,
} from '../types';

// Step executor function type
type StepExecutor = (context: AgentContext, tracker: ProgressTracker) => Promise<AgentStepResult>;

// Step definition for orchestrator
interface OrchestratorStep {
  status: AgentJobStatus;
  execute: StepExecutor;
}

export class AgentOrchestrator {
  private jobId: string;
  private tracker: ProgressTracker;
  private steps: OrchestratorStep[];
  private context: AgentContext;

  constructor(
    jobId: string,
    context: AgentContext,
    steps: OrchestratorStep[]
  ) {
    this.jobId = jobId;
    this.context = context;
    this.steps = steps;
    this.tracker = ProgressTracker.create(jobId);
  }

  /**
   * Run all steps in sequence
   */
  async run(): Promise<AgentJobResult> {
    await this.tracker.start();

    let lastSuccessfulStep = -1;

    try {
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];

        // Check if job was cancelled
        if (await this.tracker.isCancelled()) {
          console.log(`[Orchestrator] Job ${this.jobId} was cancelled`);
          throw new Error('Job cancelled');
        }

        // Transition to new step
        await this.tracker.transitionTo(step.status);

        console.log(`[Orchestrator] Starting step: ${step.status}`);

        // Execute step
        const result = await step.execute(this.context, this.tracker);

        if (!result.success) {
          // Step failed
          const errorMessage = result.error || `Step ${step.status} failed`;
          console.error(`[Orchestrator] Step ${step.status} failed:`, errorMessage);

          // Check if we should continue despite failure
          if (result.shouldContinue) {
            console.log(`[Orchestrator] Continuing despite failure in ${step.status}`);
            lastSuccessfulStep = i;
            continue;
          }

          await this.tracker.fail(errorMessage, result.errorDetails);
          throw new Error(errorMessage);
        }

        // Step succeeded
        lastSuccessfulStep = i;

        // Save context after each successful step
        await this.tracker.saveContext(this.context);

        console.log(`[Orchestrator] Completed step: ${step.status}`);
      }

      // All steps completed successfully
      const jobResult = this.buildResult();
      await this.tracker.complete(jobResult);

      console.log(`[Orchestrator] Job ${this.jobId} completed successfully`);
      return jobResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If not already failed, mark as failed
      const job = await this.tracker.getJob();
      if (job && job.status !== 'failed' && job.status !== 'cancelled') {
        await this.tracker.fail(errorMessage, {
          lastSuccessfulStep,
          lastSuccessfulStepName: lastSuccessfulStep >= 0
            ? this.steps[lastSuccessfulStep].status
            : null,
        });
      }

      throw error;
    }
  }

  /**
   * Resume from a specific step
   */
  async resumeFrom(stepIndex: number): Promise<AgentJobResult> {
    if (stepIndex < 0 || stepIndex >= this.steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }

    // Remove steps we've already completed
    this.steps = this.steps.slice(stepIndex);

    return this.run();
  }

  /**
   * Build the final result from context
   */
  private buildResult(): AgentJobResult {
    const warnings: string[] = [];

    // Check for potential issues
    if (this.context.extractedScenes.length === 0) {
      warnings.push('No scenes were extracted from the script');
    }

    if (this.context.extractedElements.length === 0) {
      warnings.push('No production elements were identified');
    }

    const scenesWithoutSynopsis = this.context.extractedScenes.filter(
      s => !s.synopsis || s.synopsis.trim() === ''
    ).length;
    if (scenesWithoutSynopsis > 0) {
      warnings.push(`${scenesWithoutSynopsis} scenes are missing synopses`);
    }

    const scenesWithoutTime = this.context.extractedScenes.filter(
      s => !s.estimatedHours || s.estimatedHours <= 0
    ).length;
    if (scenesWithoutTime > 0) {
      warnings.push(`${scenesWithoutTime} scenes are missing time estimates`);
    }

    return {
      scenesCreated: this.context.createdSceneIds.length,
      elementsCreated: this.context.createdElementIds.length,
      castCreated: this.context.linkedCast.filter(c => c.isNew).length,
      castLinked: this.context.linkedCast.length,
      synopsesGenerated: this.context.extractedScenes.filter(s => s.synopsis).length,
      timeEstimatesGenerated: this.context.extractedScenes.filter(s => s.estimatedHours).length,
      chunksProcessed: this.context.chunks?.filter(c => c.processed).length ?? 1,
      totalChunks: this.context.chunks?.length ?? 1,
      warnings,
      sceneIds: this.context.createdSceneIds,
      elementIds: this.context.createdElementIds,
      castIds: this.context.createdCastIds,
    };
  }

  /**
   * Create a new orchestrator for a job
   */
  static create(
    jobId: string,
    context: AgentContext,
    steps: OrchestratorStep[]
  ): AgentOrchestrator {
    return new AgentOrchestrator(jobId, context, steps);
  }

  /**
   * Initialize context for a new job
   */
  static initContext(
    jobId: string,
    projectId: string,
    scriptId: string,
    userId: string
  ): AgentContext {
    return {
      jobId,
      projectId,
      scriptId,
      userId,
      knownCharacters: [],
      knownLocations: [],
      lastSceneNumber: 0,
      totalPages: 0,
      extractedScenes: [],
      extractedElements: [],
      linkedCast: [],
      createdSceneIds: [],
      createdElementIds: [],
      createdCastIds: [],
      suggestedCrewRoles: [],
    };
  }
}

// Re-export for convenience
export { ProgressTracker } from './progress-tracker';
export { JobManager } from './job-manager';
