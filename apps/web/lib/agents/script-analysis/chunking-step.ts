/**
 * Chunking Step
 *
 * Splits the parsed script text into manageable chunks for processing.
 */

import { ScriptChunker } from './chunker';
import { JobManager } from '../orchestrator/job-manager';
import type { AgentContext, AgentStepResult } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

export async function executeChunkingStep(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  if (!context.scriptText) {
    return {
      success: false,
      error: 'No script text available for chunking',
    };
  }

  await tracker.updateProgress(0, 2, 'Analyzing script structure');

  const chunker = ScriptChunker.create();
  const { chunks, metadata } = chunker.chunk(
    context.scriptText,
    context.jobId,
    context.scriptId
  );

  await tracker.updateProgress(1, 2, `Created ${chunks.length} chunks`);

  // Save chunks to database for tracking
  if (chunks.length > 1) {
    try {
      await JobManager.saveChunks(chunks);
      console.log(`[ChunkingStep] Saved ${chunks.length} chunks to database`);
    } catch (error) {
      console.error('[ChunkingStep] Failed to save chunks:', error);
      // Continue without saving - chunks are still in memory
    }
  }

  // Store chunks in context (with full ScriptChunk interface)
  context.chunks = chunks.map(chunk => ({
    ...chunk,
    createdAt: new Date().toISOString(),
  }));

  await tracker.updateProgress(2, 2, 'Chunking complete');

  console.log(`[ChunkingStep] Split into ${chunks.length} chunks, ${metadata.estimatedPages} pages, ${metadata.sceneBoundaries.length} scene boundaries`);

  return {
    success: true,
    data: {
      totalChunks: chunks.length,
      totalCharacters: metadata.totalCharacters,
      estimatedPages: metadata.estimatedPages,
      sceneBoundaries: metadata.sceneBoundaries.length,
    },
  };
}
