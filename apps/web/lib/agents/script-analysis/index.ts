/**
 * Script Analysis Agent
 *
 * Orchestrates the full script analysis pipeline:
 * 1. Parse PDF
 * 2. Chunk script
 * 3. Extract scenes
 * 4. Extract elements
 * 5. Link cast
 * 6. Generate synopses
 * 7. Estimate time
 * 8. Create database records
 */

import { AgentOrchestrator } from '../orchestrator';
import { JobManager } from '../orchestrator/job-manager';
import { executeParserStep } from './parser-step';
import { executeChunkingStep } from './chunking-step';
import { executeSceneExtractor } from './scene-extractor';
import { executeElementExtractor } from './element-extractor';
import { executeCastLinker } from './cast-linker';
import { executeSynopsisGenerator } from './synopsis-generator';
import { executeTimeEstimator } from './time-estimator';
import { executeSceneCreator } from './scene-creator';
import { executeCrewSuggester } from './crew-suggester';
import type { AgentContext, AgentJobResult, AgentJobStatus } from '../types';

// Step definitions for the script analysis pipeline
const SCRIPT_ANALYSIS_STEPS: Array<{
  status: AgentJobStatus;
  execute: (context: AgentContext, tracker: import('../orchestrator/progress-tracker').ProgressTracker) => Promise<import('../types').AgentStepResult>;
}> = [
  { status: 'parsing', execute: executeParserStep },
  { status: 'chunking', execute: executeChunkingStep },
  { status: 'extracting_scenes', execute: executeSceneExtractor },
  { status: 'extracting_elements', execute: executeElementExtractor },
  { status: 'linking_cast', execute: executeCastLinker },
  { status: 'generating_synopses', execute: executeSynopsisGenerator },
  { status: 'estimating_time', execute: executeTimeEstimator },
  // Final step: create all records in database
  { status: 'creating_records', execute: executeSceneCreator },
  // Suggest crew roles based on script content (non-blocking)
  { status: 'suggesting_crew', execute: executeCrewSuggester },
];

export class ScriptAnalysisAgent {
  private jobId: string;
  private projectId: string;
  private scriptId: string;
  private userId: string;

  constructor(jobId: string, projectId: string, scriptId: string, userId: string) {
    this.jobId = jobId;
    this.projectId = projectId;
    this.scriptId = scriptId;
    this.userId = userId;
  }

  /**
   * Run the full script analysis pipeline
   */
  async run(): Promise<AgentJobResult> {
    // Initialize context
    const context = AgentOrchestrator.initContext(
      this.jobId,
      this.projectId,
      this.scriptId,
      this.userId
    );

    // Create and run orchestrator with all steps including database creation
    const orchestrator = AgentOrchestrator.create(
      this.jobId,
      context,
      SCRIPT_ANALYSIS_STEPS
    );

    // Run all steps including final database record creation
    return await orchestrator.run();
  }

  /**
   * Create and start a new script analysis job
   */
  static async start(
    projectId: string,
    scriptId: string,
    userId: string
  ): Promise<{ jobId: string; agent: ScriptAnalysisAgent }> {
    // Check for existing active job
    const hasActive = await JobManager.hasActiveJob(scriptId);
    if (hasActive) {
      throw new Error('An analysis job is already in progress for this script');
    }

    // Create job record
    const job = await JobManager.createJob({
      projectId,
      scriptId,
      userId,
      jobType: 'script_analysis',
      totalSteps: SCRIPT_ANALYSIS_STEPS.length,
    });

    // Create agent
    const agent = new ScriptAnalysisAgent(job.id, projectId, scriptId, userId);

    return { jobId: job.id, agent };
  }

  /**
   * Run the agent in background (fire and forget with progress tracking)
   */
  async runInBackground(): Promise<void> {
    // Run asynchronously - errors are captured in the job status
    this.run().catch(error => {
      console.error(`[ScriptAnalysisAgent] Background job ${this.jobId} failed:`, error);
    });
  }
}

// Re-export step functions for testing
export { executeParserStep } from './parser-step';
export { executeChunkingStep } from './chunking-step';
export { executeSceneExtractor } from './scene-extractor';
export { executeElementExtractor } from './element-extractor';
export { executeCastLinker } from './cast-linker';
export { executeSynopsisGenerator } from './synopsis-generator';
export { executeTimeEstimator } from './time-estimator';
export { executeSceneCreator } from './scene-creator';
export { executeCrewSuggester } from './crew-suggester';
export { ScriptChunker } from './chunker';
