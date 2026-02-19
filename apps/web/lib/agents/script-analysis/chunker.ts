/**
 * Script Chunker
 *
 * Splits large scripts at scene boundaries for processing in manageable chunks.
 * Maintains context continuity by tracking page numbers and scene counts.
 */

import { CHUNK_CONFIG } from '../constants';
import type { ScriptChunk } from '../types';

export interface ChunkOptions {
  maxCharsPerChunk?: number;
  minCharsPerChunk?: number;
  overlapChars?: number;
}

export interface ChunkMetadata {
  totalChunks: number;
  totalCharacters: number;
  estimatedPages: number;
  sceneBoundaries: number[];
}

// Standard screenplay page is ~250 words or ~1500 characters
const CHARS_PER_PAGE = 1500;

// Scene header patterns for screenplay format
const SCENE_HEADER_PATTERNS = [
  /^(INT|EXT|INT\/EXT|I\/E)\.?\s+/i,
  /^(\d+[A-Z]?)\s+(INT|EXT|INT\/EXT|I\/E)\.?\s+/i,
  /^SCENE\s+\d+/im,
];

export class ScriptChunker {
  private options: Required<ChunkOptions>;

  constructor(options: ChunkOptions = {}) {
    this.options = {
      maxCharsPerChunk: options.maxCharsPerChunk ?? CHUNK_CONFIG.MAX_CHARS_PER_CHUNK,
      minCharsPerChunk: options.minCharsPerChunk ?? CHUNK_CONFIG.MIN_CHARS_PER_CHUNK,
      overlapChars: options.overlapChars ?? CHUNK_CONFIG.OVERLAP_CHARS,
    };
  }

  /**
   * Split script text into chunks at scene boundaries
   */
  chunk(
    scriptText: string,
    jobId: string,
    scriptId: string
  ): { chunks: Omit<ScriptChunk, 'createdAt'>[]; metadata: ChunkMetadata } {
    const normalizedText = this.normalizeText(scriptText);
    const sceneBoundaries = this.findSceneBoundaries(normalizedText);
    const totalPages = Math.ceil(normalizedText.length / CHARS_PER_PAGE);

    // If script is small enough, return as single chunk
    if (normalizedText.length <= this.options.maxCharsPerChunk) {
      return {
        chunks: [{
          id: `${jobId}-chunk-0`,
          scriptId,
          jobId,
          chunkIndex: 0,
          chunkText: normalizedText,
          pageStart: 1,
          pageEnd: totalPages,
          sceneCount: sceneBoundaries.length,
          processed: false,
          processedAt: null,
          result: null,
          error: null,
        }],
        metadata: {
          totalChunks: 1,
          totalCharacters: normalizedText.length,
          estimatedPages: totalPages,
          sceneBoundaries,
        },
      };
    }

    // Split at scene boundaries
    const chunks = this.splitAtBoundaries(
      normalizedText,
      sceneBoundaries,
      jobId,
      scriptId
    );

    return {
      chunks,
      metadata: {
        totalChunks: chunks.length,
        totalCharacters: normalizedText.length,
        estimatedPages: totalPages,
        sceneBoundaries,
      },
    };
  }

  /**
   * Normalize text for consistent processing
   */
  private normalizeText(text: string): string {
    return text
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace while preserving screenplay formatting
      .replace(/\n{4,}/g, '\n\n\n')
      // Trim
      .trim();
  }

  /**
   * Find all scene boundary positions in the text
   */
  private findSceneBoundaries(text: string): number[] {
    const boundaries: number[] = [];
    const lines = text.split('\n');
    let charPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this line is a scene header
      if (this.isSceneHeader(trimmedLine)) {
        boundaries.push(charPosition);
      }

      charPosition += line.length + 1; // +1 for newline
    }

    // If no scene boundaries found, create artificial ones based on size
    if (boundaries.length === 0) {
      const interval = Math.floor(this.options.maxCharsPerChunk / 2);
      for (let i = 0; i < text.length; i += interval) {
        boundaries.push(i);
      }
    }

    return boundaries;
  }

  /**
   * Check if a line is a scene header
   */
  private isSceneHeader(line: string): boolean {
    for (const pattern of SCENE_HEADER_PATTERNS) {
      if (pattern.test(line)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Split text into chunks at scene boundaries
   */
  private splitAtBoundaries(
    text: string,
    boundaries: number[],
    jobId: string,
    scriptId: string
  ): Omit<ScriptChunk, 'createdAt'>[] {
    const chunks: Omit<ScriptChunk, 'createdAt'>[] = [];
    let chunkIndex = 0;
    let currentStart = 0;

    while (currentStart < text.length) {
      // Find the end position for this chunk
      const targetEnd = currentStart + this.options.maxCharsPerChunk;

      // Find the best boundary to split at
      let splitPoint = this.findBestSplitPoint(
        boundaries,
        currentStart,
        targetEnd,
        text.length
      );

      // Ensure we don't create tiny chunks
      if (splitPoint - currentStart < this.options.minCharsPerChunk && splitPoint < text.length) {
        // Extend to next boundary or end
        const nextBoundary = boundaries.find(b => b > splitPoint);
        if (nextBoundary && nextBoundary - currentStart <= this.options.maxCharsPerChunk * 1.5) {
          splitPoint = nextBoundary;
        }
      }

      // Extract chunk text
      const chunkText = text.substring(currentStart, splitPoint);

      // Count scenes in this chunk
      const sceneCount = boundaries.filter(
        b => b >= currentStart && b < splitPoint
      ).length;

      // Calculate page estimates
      const pageStart = Math.ceil(currentStart / CHARS_PER_PAGE) + 1;
      const pageEnd = Math.ceil(splitPoint / CHARS_PER_PAGE);

      chunks.push({
        id: `${jobId}-chunk-${chunkIndex}`,
        scriptId,
        jobId,
        chunkIndex,
        chunkText,
        pageStart,
        pageEnd,
        sceneCount,
        processed: false,
        processedAt: null,
        result: null,
        error: null,
      });

      chunkIndex++;
      currentStart = splitPoint;
    }

    return chunks;
  }

  /**
   * Find the best position to split based on scene boundaries
   */
  private findBestSplitPoint(
    boundaries: number[],
    start: number,
    targetEnd: number,
    textLength: number
  ): number {
    // If we're near the end, just take the rest
    if (targetEnd >= textLength - this.options.minCharsPerChunk) {
      return textLength;
    }

    // Find boundaries within range
    const candidateBoundaries = boundaries.filter(
      b => b > start + this.options.minCharsPerChunk && b <= targetEnd
    );

    if (candidateBoundaries.length > 0) {
      // Use the last boundary before targetEnd (maximize chunk size)
      return candidateBoundaries[candidateBoundaries.length - 1];
    }

    // No good boundary found - look for next boundary after target
    const nextBoundary = boundaries.find(b => b > targetEnd);
    if (nextBoundary && nextBoundary - start <= this.options.maxCharsPerChunk * 1.2) {
      return nextBoundary;
    }

    // Fall back to targetEnd
    return Math.min(targetEnd, textLength);
  }

  /**
   * Get overlap text from previous chunk for context
   */
  getOverlapContext(chunks: Omit<ScriptChunk, 'createdAt'>[], chunkIndex: number): string {
    if (chunkIndex === 0) return '';

    const previousChunk = chunks[chunkIndex - 1];
    if (!previousChunk) return '';

    const text = previousChunk.chunkText;
    const overlapStart = Math.max(0, text.length - this.options.overlapChars);

    // Try to start at a scene boundary or line break
    const overlap = text.substring(overlapStart);
    const newlineIndex = overlap.indexOf('\n');

    if (newlineIndex > 0 && newlineIndex < 100) {
      return overlap.substring(newlineIndex + 1);
    }

    return overlap;
  }

  /**
   * Estimate total processing time based on chunks
   */
  estimateProcessingTime(chunkCount: number): number {
    // Rough estimate: 15 seconds per chunk for all operations
    return chunkCount * 15000;
  }

  /**
   * Create a chunker with custom configuration
   */
  static create(options?: ChunkOptions): ScriptChunker {
    return new ScriptChunker(options);
  }

  /**
   * Quick chunk with default settings
   */
  static split(
    text: string,
    jobId: string,
    scriptId: string
  ): { chunks: Omit<ScriptChunk, 'createdAt'>[]; metadata: ChunkMetadata } {
    return new ScriptChunker().chunk(text, jobId, scriptId);
  }
}
