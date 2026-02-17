/**
 * Type definitions for the AI Agent system
 */

// Database enum types (must match PostgreSQL enums)
export type AgentJobType = 'script_analysis' | 'schedule_planning' | 'element_extraction' | 'cast_matching';

export type AgentJobStatus =
  | 'pending'
  | 'parsing'
  | 'chunking'
  | 'extracting_scenes'
  | 'extracting_elements'
  | 'linking_cast'
  | 'generating_synopses'
  | 'estimating_time'
  | 'creating_records'
  | 'completed'
  | 'failed'
  | 'cancelled';

// Agent Job database record
export interface AgentJob {
  id: string;
  projectId: string;
  scriptId: string | null;
  userId: string;
  jobType: AgentJobType;
  status: AgentJobStatus;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  stepDescription: string | null;
  result: AgentJobResult | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  processingTimeMs: number | null;
  context: AgentContext | null;
}

// Script chunk for large script processing
export interface ScriptChunk {
  id: string;
  scriptId: string;
  jobId: string;
  chunkIndex: number;
  chunkText: string;
  pageStart: number | null;
  pageEnd: number | null;
  sceneCount: number;
  processed: boolean;
  processedAt: string | null;
  result: ChunkResult | null;
  error: string | null;
  createdAt: string;
}

// Step definition for orchestrator
export interface AgentStep {
  name: AgentJobStatus;
  description: string;
  weight: number; // Relative progress weight (higher = more time)
  execute: (context: AgentContext) => Promise<AgentStepResult>;
}

// Step execution result
export interface AgentStepResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorDetails?: Record<string, unknown>;
  shouldContinue?: boolean; // If false, stop pipeline even on success
}

// Cross-chunk context maintained during processing
export interface AgentContext {
  jobId: string;
  projectId: string;
  scriptId: string;
  userId: string;

  // Script data
  scriptText?: string;
  scriptUrl?: string;
  chunks?: ScriptChunk[];

  // Running state across chunks
  knownCharacters: CharacterReference[];
  knownLocations: LocationReference[];
  lastSceneNumber: number;
  totalPages: number;

  // Extracted data
  extractedScenes: ExtractedScene[];
  extractedElements: ExtractedElement[];
  linkedCast: LinkedCastMember[];

  // Results
  createdSceneIds: string[];
  createdElementIds: string[];
  createdCastIds: string[];
}

// Reference types for cross-chunk consistency
export interface CharacterReference {
  name: string;
  aliases: string[];
  firstAppearance: number; // Scene number
  sceneCount: number;
}

export interface LocationReference {
  name: string;
  intExt: 'INT' | 'EXT' | 'BOTH';
  aliases: string[];
  sceneCount: number;
}

// Chunk processing result
export interface ChunkResult {
  scenes: ExtractedScene[];
  characters: string[];
  locations: string[];
  pageStart: number;
  pageEnd: number;
}

// Extracted scene data from LLM
export interface ExtractedScene {
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'BOTH';
  setName: string;
  timeOfDay: string;
  pageLengthEighths: number;
  synopsis: string;
  characters: string[];
  scriptPageStart: number;
  scriptPageEnd: number;
  elements?: ExtractedElement[];
  estimatedHours?: number;
}

// Extracted element data
export interface ExtractedElement {
  category: ElementCategory;
  name: string;
  description?: string;
  sceneNumbers: string[];
  quantity?: number;
}

// Element categories (must match database enum)
export type ElementCategory =
  | 'NAME'
  | 'PROP'
  | 'WARDROBE'
  | 'VEHICLE'
  | 'ANIMAL'
  | 'SPECIAL_EQUIPMENT'
  | 'VFX'
  | 'SFX'
  | 'STUNT'
  | 'MAKEUP'
  | 'HAIR'
  | 'GREENERY'
  | 'ART_DEPARTMENT'
  | 'SOUND'
  | 'MUSIC'
  | 'BACKGROUND'
  | 'OTHER'
  | 'CAMERA'
  | 'GRIP'
  | 'ELECTRIC'
  | 'SET_DRESSING'
  | 'ADDITIONAL_LABOR'
  | 'ANIMAL_WRANGLER'
  | 'MECHANICAL_EFFECTS'
  | 'VIDEO_PLAYBACK'
  | 'LOCATION_NOTES'
  | 'SAFETY_NOTES'
  | 'SECURITY'
  | 'QUESTIONS'
  | 'COMMENTS'
  | 'MISCELLANEOUS';

// Linked cast member result
export interface LinkedCastMember {
  characterName: string;
  castMemberId: string;
  isNew: boolean;
  sceneIds: string[];
}

// Final job result
export interface AgentJobResult {
  scenesCreated: number;
  elementsCreated: number;
  castCreated: number;
  castLinked: number;
  synopsesGenerated: number;
  timeEstimatesGenerated: number;
  chunksProcessed: number;
  totalChunks: number;
  warnings: string[];
  sceneIds: string[];
  elementIds: string[];
  castIds: string[];
}

// API request/response types
export interface StartAgentJobRequest {
  projectId: string;
  scriptId: string;
  jobType: AgentJobType;
}

export interface StartAgentJobResponse {
  jobId: string;
  status: AgentJobStatus;
}

export interface AgentJobStatusResponse {
  job: AgentJob;
}

export interface CancelAgentJobResponse {
  success: boolean;
  message: string;
}

// Progress update for real-time UI
export interface AgentProgressUpdate {
  jobId: string;
  status: AgentJobStatus;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  stepDescription: string;
}

// Error types for structured error handling
export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export type AgentErrorCode =
  | 'PARSE_ERROR'
  | 'CHUNK_ERROR'
  | 'LLM_ERROR'
  | 'LLM_RATE_LIMIT'
  | 'LLM_TIMEOUT'
  | 'JSON_PARSE_ERROR'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN_ERROR';
