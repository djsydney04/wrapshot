/**
 * PostHog-instrumented Fireworks AI client
 *
 * Uses the OpenAI SDK pointed at Fireworks, wrapped by @posthog/ai
 * so every LLM call automatically emits a $ai_generation event.
 */
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { getFireworksApiKey } from "./config";

let _posthog: PostHog | null = null;

function getPostHogServer(): PostHog {
  if (!_posthog) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      throw new Error("NEXT_PUBLIC_POSTHOG_KEY is required for LLM analytics");
    }
    _posthog = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _posthog;
}

/**
 * Returns a PostHog-instrumented OpenAI client pointed at Fireworks AI.
 * Every chat.completions.create() call will automatically capture
 * an $ai_generation event in PostHog.
 */
export function getFireworksClient(apiKey?: string): OpenAI {
  const key = getFireworksApiKey(apiKey);
  if (!key) {
    throw new Error(
      "Fireworks API key missing. Set FIREWORKS_SECRET_KEY (or FIREWORKS_API_KEY) in apps/web/.env.local."
    );
  }

  return new OpenAI({
    baseURL: "https://api.fireworks.ai/inference/v1",
    apiKey: key,
    posthog: getPostHogServer(),
  });
}
