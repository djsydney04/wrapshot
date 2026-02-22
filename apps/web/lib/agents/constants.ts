/**
 * Constants for the AI Agent system
 */

import type { AgentJobStatus } from './types';
import { getCerebrasModel } from '@/lib/ai/config';

function readPositiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Chunking configuration
export const CHUNK_CONFIG = {
  MAX_CHARS_PER_CHUNK: readPositiveIntFromEnv('SCRIPT_ANALYSIS_MAX_CHARS_PER_CHUNK', 12000),
  MIN_CHARS_PER_CHUNK: readPositiveIntFromEnv('SCRIPT_ANALYSIS_MIN_CHARS_PER_CHUNK', 2500),
  OVERLAP_CHARS: readPositiveIntFromEnv('SCRIPT_ANALYSIS_OVERLAP_CHARS', 500),
};

// LLM configuration
export const LLM_CONFIG = {
  MODEL: getCerebrasModel(),
  MAX_TOKENS_SCENE_EXTRACTION: readPositiveIntFromEnv(
    'SCRIPT_ANALYSIS_SCENE_MAX_TOKENS',
    3500
  ),
  MAX_TOKENS_ELEMENT_EXTRACTION: readPositiveIntFromEnv(
    'SCRIPT_ANALYSIS_ELEMENT_MAX_TOKENS',
    3000
  ),
  MAX_TOKENS_SYNOPSIS: readPositiveIntFromEnv('SCRIPT_ANALYSIS_SYNOPSIS_MAX_TOKENS', 1800),
  MAX_TOKENS_TIME_ESTIMATE: readPositiveIntFromEnv('SCRIPT_ANALYSIS_TIME_MAX_TOKENS', 2000),
  TEMPERATURE_EXTRACTION: 0.1,
  TEMPERATURE_SYNOPSIS: 0.3,
};

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
  JITTER_FACTOR: 0.1,
};

// Step definitions with progress weights
export const STEP_DEFINITIONS: Record<
  AgentJobStatus,
  { description: string; weight: number }
> = {
  pending: { description: 'Waiting to start', weight: 0 },
  parsing: { description: 'Parsing script PDF', weight: 5 },
  chunking: { description: 'Splitting script into chunks', weight: 5 },
  extracting_scenes: { description: 'Extracting scenes from script', weight: 30 },
  extracting_elements: { description: 'Identifying production elements', weight: 25 },
  linking_cast: { description: 'Linking characters to cast members', weight: 10 },
  generating_synopses: { description: 'Generating scene synopses', weight: 15 },
  estimating_time: { description: 'Estimating shooting times', weight: 10 },
  creating_records: { description: 'Saving scenes and elements', weight: 10 },
  suggesting_crew: { description: 'Suggesting crew roles', weight: 5 },
  completed: { description: 'Analysis complete', weight: 0 },
  failed: { description: 'Analysis failed', weight: 0 },
  cancelled: { description: 'Analysis cancelled', weight: 0 },
};

// Ordered steps for the script analysis pipeline
export const SCRIPT_ANALYSIS_STEPS: AgentJobStatus[] = [
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

// Time estimation heuristics
export const TIME_ESTIMATION = {
  BASE_HOURS_PER_PAGE: 0.5, // 2 pages per hour baseline
  DIALOGUE_MULTIPLIER: 1.0,
  ACTION_MULTIPLIER: 1.5,
  VFX_MULTIPLIER: 2.0,
  STUNT_MULTIPLIER: 2.5,
  EXTERIOR_MULTIPLIER: 1.3,
  NIGHT_MULTIPLIER: 1.2,
  CROWD_MULTIPLIER: 1.5,
};

// Element category mappings for extraction
export const ELEMENT_KEYWORDS: Record<string, string[]> = {
  PROP: ['holds', 'carries', 'picks up', 'puts down', 'grabs', 'weapon', 'gun', 'phone', 'bag', 'bottle'],
  WARDROBE: ['wearing', 'dressed', 'costume', 'uniform', 'suit', 'dress', 'jacket', 'hat'],
  VEHICLE: ['car', 'truck', 'motorcycle', 'bicycle', 'bus', 'taxi', 'vehicle', 'drives'],
  ANIMAL: ['dog', 'cat', 'horse', 'bird', 'animal', 'pet'],
  VFX: ['green screen', 'cgi', 'digital', 'composite', 'effect'],
  SFX: ['explosion', 'fire', 'rain', 'snow', 'wind', 'smoke', 'fog'],
  STUNT: ['fight', 'crash', 'fall', 'jump', 'chase', 'action'],
  MAKEUP: ['blood', 'scar', 'bruise', 'wound', 'prosthetic', 'tattoo'],
  BACKGROUND: ['extras', 'crowd', 'background', 'pedestrians', 'bystanders'],
};

// Status display configuration
export const STATUS_CONFIG: Record<
  AgentJobStatus,
  { label: string; color: string; icon: string }
> = {
  pending: { label: 'Pending', color: 'gray', icon: 'clock' },
  parsing: { label: 'Parsing', color: 'blue', icon: 'file-text' },
  chunking: { label: 'Chunking', color: 'blue', icon: 'scissors' },
  extracting_scenes: { label: 'Extracting Scenes', color: 'blue', icon: 'film' },
  extracting_elements: { label: 'Finding Elements', color: 'blue', icon: 'package' },
  linking_cast: { label: 'Linking Cast', color: 'blue', icon: 'users' },
  generating_synopses: { label: 'Writing Synopses', color: 'blue', icon: 'edit' },
  estimating_time: { label: 'Estimating Time', color: 'blue', icon: 'clock' },
  creating_records: { label: 'Saving Records', color: 'blue', icon: 'database' },
  suggesting_crew: { label: 'Suggesting Crew', color: 'blue', icon: 'users' },
  completed: { label: 'Completed', color: 'green', icon: 'check-circle' },
  failed: { label: 'Failed', color: 'red', icon: 'x-circle' },
  cancelled: { label: 'Cancelled', color: 'gray', icon: 'x' },
};
