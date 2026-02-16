/**
 * Kimi K2.5 API client for script analysis
 * Uses Fireworks AI as the inference provider
 */
import { getFireworksApiKey } from "@/lib/ai/config";

interface KimiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface KimiCompletionOptions {
  messages: KimiMessage[];
  maxTokens?: number;
  temperature?: number;
}

interface KimiResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class KimiClient {
  private apiKey: string;
  private baseUrl = "https://api.fireworks.ai/inference/v1/chat/completions";
  private model = "accounts/fireworks/models/kimi-k2-5-instruct";

  constructor(apiKey?: string) {
    this.apiKey = getFireworksApiKey(apiKey);
    if (!this.apiKey) {
      throw new Error(
        "Fireworks API key missing. Set FIREWORKS_SECRET_KEY (or FIREWORKS_API_KEY) in apps/web/.env.local."
      );
    }
  }

  async complete(options: KimiCompletionOptions): Promise<string> {
    const { messages, maxTokens = 4000, temperature = 0.1 } = options;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kimi API error:", response.status, errorText);
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data: KimiResponse = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in Kimi response");
    }

    return content;
  }

  /**
   * Streaming completion for real-time UI updates
   */
  async *completeStreaming(options: KimiCompletionOptions): AsyncGenerator<string> {
    const { messages, maxTokens = 4000, temperature = 0.1 } = options;

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Kimi API error:", response.status, errorText);
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Extract JSON from a response that might contain markdown or extra text
   */
  static extractJson<T>(content: string): T {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try array
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (!arrayMatch) {
        throw new Error("No JSON found in response");
      }
      return JSON.parse(arrayMatch[0]) as T;
    }
    return JSON.parse(jsonMatch[0]) as T;
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
