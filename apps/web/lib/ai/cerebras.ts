/**
 * PostHog-instrumented Cerebras AI client
 *
 * Uses the OpenAI SDK pointed at Cerebras, wrapped by @posthog/ai
 * so every LLM call automatically emits a $ai_generation event.
 */
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { getCerebrasApiKey } from "./config";

let _posthog: PostHog | null = null;

function getPostHogServer(): PostHog {
  if (!_posthog) {
    const key = process.env.NEXT_POSTHOG_KEY;
    if (!key) {
      throw new Error("NEXT_POSTHOG_KEY is required for LLM analytics");
    }
    _posthog = new PostHog(key, {
      host: process.env.NEXT_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _posthog;
}

/**
 * Returns a PostHog-instrumented OpenAI client pointed at Cerebras.
 * Every chat.completions.create() call will automatically capture
 * an $ai_generation event in PostHog.
 */
export function getCerebrasClient(apiKey?: string): OpenAI {
  const key = getCerebrasApiKey(apiKey);
  if (!key) {
    throw new Error(
      "Cerebras API key missing. Set CEREBRAS_API_KEY (or CEREBRAS_APPI_KEY) in apps/web/.env.local.",
    );
  }

  return new OpenAI({
    baseURL: "https://api.cerebras.ai/v1",
    apiKey: key,
    posthog: getPostHogServer(),
  });
}
