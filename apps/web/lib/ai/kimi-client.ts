/**
 * Script analysis LLM client.
 * Prefers Cerebras GLM 4.7 and falls back to Fireworks Kimi when needed.
 */
import { getCerebrasClient } from "@/lib/ai/cerebras";
import {
  getCerebrasApiKey,
  getCerebrasModel,
  getFireworksApiKey,
  getFireworksModel,
} from "@/lib/ai/config";
import { getFireworksClient } from "@/lib/ai/fireworks";
import { JsonParser } from "@/lib/agents/utils/json-parser";
import type { OpenAI } from "@posthog/ai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";

interface KimiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface KimiCompletionOptions {
  messages: KimiMessage[];
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  /** PostHog distinct ID for user attribution */
  posthogDistinctId?: string;
  /** PostHog trace ID for grouping related calls */
  posthogTraceId?: string;
  /** Extra PostHog properties */
  posthogProperties?: Record<string, unknown>;
}

type ScriptAnalysisProvider = "cerebras" | "fireworks";

export class KimiClient {
  private client: OpenAI;
  private model: string;
  private provider: ScriptAnalysisProvider;
  private readonly fireworksClient: OpenAI | null;
  private readonly fireworksModel: string;

  constructor(apiKey?: string) {
    void apiKey;

    const cerebrasKey = getCerebrasApiKey();
    const fireworksKey = getFireworksApiKey();
    this.fireworksModel = getFireworksModel();
    this.fireworksClient = fireworksKey ? getFireworksClient(fireworksKey) : null;

    if (cerebrasKey) {
      this.client = getCerebrasClient(cerebrasKey);
      this.model = getCerebrasModel();
      this.provider = "cerebras";
      return;
    }

    this.client = this.fireworksClient ?? getFireworksClient();
    this.model = this.fireworksModel;
    this.provider = "fireworks";
  }

  private is404Error(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const errorWithStatus = error as { status?: number; message?: string };

    if (errorWithStatus.status === 404) {
      return true;
    }

    const message = String(errorWithStatus.message || "").toLowerCase();
    return message.includes("404") || message.includes("not found");
  }

  private canFallbackToFireworks(error: unknown): boolean {
    return this.provider === "cerebras" && Boolean(this.fireworksClient) && this.is404Error(error);
  }

  private switchToFireworks(): void {
    if (!this.fireworksClient) {
      return;
    }

    this.client = this.fireworksClient;
    this.model = this.fireworksModel;
    this.provider = "fireworks";
  }

  getActiveProvider(): ScriptAnalysisProvider {
    return this.provider;
  }

  getActiveModel(): string {
    return this.model;
  }

  async complete(options: KimiCompletionOptions): Promise<string> {
    const {
      messages,
      maxTokens = 4000,
      temperature = 0.1,
      timeout = 120000,
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
    } = options;

    const request = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
      posthogCaptureImmediate: true,
    } as Parameters<typeof this.client.chat.completions.create>[0];

    let response: ChatCompletion;
    try {
      response = (await this.client.chat.completions.create(request, {
        timeout,
      })) as ChatCompletion;
    } catch (error) {
      if (!this.canFallbackToFireworks(error)) {
        throw error;
      }

      console.warn(
        `[KimiClient] Cerebras returned 404 for model "${this.model}". Falling back to Fireworks "${this.fireworksModel}".`,
      );
      this.switchToFireworks();

      response = (await this.client.chat.completions.create(
        {
          ...request,
          model: this.model,
        },
        { timeout },
      )) as ChatCompletion;
    }

    const content = response.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(
        `No content in Kimi response (choices: ${response.choices?.length ?? 0})`,
      );
    }

    return content;
  }

  /**
   * Completion with function-calling / tool use.
   * Returns the full ChatCompletion so the caller can inspect tool_calls.
   */
  async completeWithTools(
    options: KimiCompletionOptions & {
      tools?: Array<{
        type: "function";
        function: { name: string; description: string; parameters: Record<string, unknown> };
      }>;
      tool_choice?: "auto" | "none";
    }
  ): Promise<ChatCompletion> {
    const {
      messages,
      maxTokens = 4000,
      temperature = 0.3,
      timeout = 120000,
      tools,
      tool_choice = "auto",
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
    } = options;

    const request = {
      model: this.model,
      messages: messages as any,
      max_tokens: maxTokens,
      temperature,
      ...(tools && tools.length > 0 ? { tools, tool_choice } : {}),
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
      posthogCaptureImmediate: true,
    } as Parameters<typeof this.client.chat.completions.create>[0];

    let response: ChatCompletion;
    try {
      response = (await this.client.chat.completions.create(request, {
        timeout,
      })) as ChatCompletion;
    } catch (error) {
      if (!this.canFallbackToFireworks(error)) {
        throw error;
      }

      console.warn(
        `[KimiClient] Cerebras returned 404 for model "${this.model}". Falling back to Fireworks "${this.fireworksModel}".`,
      );
      this.switchToFireworks();

      response = (await this.client.chat.completions.create(
        {
          ...request,
          model: this.model,
        },
        { timeout },
      )) as ChatCompletion;
    }

    return response;
  }

  /**
   * Streaming completion for real-time UI updates
   */
  async *completeStreaming(
    options: KimiCompletionOptions,
  ): AsyncGenerator<string> {
    const {
      messages,
      maxTokens = 4000,
      temperature = 0.1,
      timeout = 180000,
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
    } = options;

    const request = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      posthogDistinctId,
      posthogTraceId,
      posthogProperties,
      posthogCaptureImmediate: true,
    } as Parameters<typeof this.client.chat.completions.create>[0];

    let stream: Stream<ChatCompletionChunk>;
    try {
      stream = (await this.client.chat.completions.create(request, {
        timeout,
      })) as Stream<ChatCompletionChunk>;
    } catch (error) {
      if (!this.canFallbackToFireworks(error)) {
        throw error;
      }

      console.warn(
        `[KimiClient] Cerebras returned 404 for model "${this.model}". Falling back to Fireworks "${this.fireworksModel}".`,
      );
      this.switchToFireworks();

      stream = (await this.client.chat.completions.create(
        {
          ...request,
          model: this.model,
        },
        { timeout },
      )) as Stream<ChatCompletionChunk>;
    }

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Extract JSON from a response that might contain markdown or extra text
   * Uses the improved JsonParser with multiple extraction strategies
   */
  static extractJson<T>(content: string): T {
    const result = JsonParser.parse<T>(content);
    if (result === null) {
      throw new Error("No JSON found in response");
    }
    return result;
  }
}

// Scene extraction prompt
export const SCENE_EXTRACTION_PROMPT = `You are a professional script supervisor analyzing a film/TV script. Extract all scenes from the provided script text.

For each scene, extract:
- scene_number: The scene number as written (e.g., "1", "2A", "45")
- int_ext: Either "INT" for interior or "EXT" for exterior
- set_name: The location/set name from the slugline (e.g., "JOHN'S APARTMENT - LIVING ROOM")
- time_of_day: One of: DAY, NIGHT, DAWN, DUSK, MORNING, AFTERNOON, EVENING, CONTINUOUS
- page_length_eighths: The scene length in 1/8ths of a page (1-8 for each full page)
- synopsis: A brief 1-2 sentence description of what happens in the scene
- characters: Array of character names who appear in the scene (speaking roles only)
- script_page_start: The starting page number
- script_page_end: The ending page number

Return a JSON object with this structure:
{
  "scenes": [
    {
      "scene_number": "1",
      "int_ext": "INT",
      "set_name": "JOHN'S APARTMENT - LIVING ROOM",
      "time_of_day": "DAY",
      "page_length_eighths": 4,
      "synopsis": "John wakes up and discovers the mysterious letter.",
      "characters": ["JOHN", "MARY"],
      "script_page_start": 1,
      "script_page_end": 1.5
    }
  ],
  "total_pages": 95,
  "total_scenes": 42
}

Important:
- Scene numbers should match exactly as written in the script
- Include all scenes, even very short ones
- For page_length_eighths, estimate based on the text length (8 eighths = 1 full page)
- Only include characters who have dialogue or are specifically mentioned in action
- Return ONLY valid JSON, no other text`;

// Element extraction prompt
export const ELEMENT_EXTRACTION_PROMPT = `You are a professional assistant director breaking down a script scene for production. Analyze the scene and extract all production elements.

Extract elements into these categories:
- CAST: Named characters (speaking roles)
- BACKGROUND: Extras/background actors needed
- PROP: Props used or mentioned
- WARDROBE: Specific costume requirements
- VEHICLE: Vehicles mentioned or needed
- ANIMAL: Any animals
- VFX: Visual effects shots
- SFX: Practical special effects
- STUNT: Stunt requirements
- MAKEUP: Special makeup requirements
- HAIR: Special hair requirements
- CAMERA: Special camera equipment or shots
- GRIP: Grip/rigging requirements
- ELECTRIC: Special lighting requirements
- SET_DRESSING: Set decoration elements
- SOUND: Special sound requirements
- MUSIC: Music cues or requirements
- GREENERY: Plants/landscaping
- MECHANICAL_EFFECTS: Mechanical effects (rain, wind machines, etc.)
- VIDEO_PLAYBACK: Screens/monitors needing playback
- SAFETY_NOTES: Safety considerations
- LOCATION_NOTES: Location requirements
- QUESTIONS: Things that need clarification

Return a JSON object:
{
  "elements": [
    { "category": "PROP", "name": "Mysterious letter", "notes": "Period-appropriate envelope" },
    { "category": "CAST", "name": "JOHN", "notes": "Lead" },
    { "category": "WARDROBE", "name": "John's pajamas", "notes": "Worn, comfortable" }
  ]
}

Important:
- Be thorough - every prop, costume piece, and effect matters for production
- Include implied elements (e.g., if someone "pours coffee", include coffee pot, mug, coffee)
- Note any special requirements or considerations
- Return ONLY valid JSON`;
