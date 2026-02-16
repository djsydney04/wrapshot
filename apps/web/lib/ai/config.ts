export const WRAPSHOT_INTELLIGENCE_LABEL = "Wrapshot Intelligence";

/**
 * Resolve the Fireworks API key from supported environment variable names.
 * Uses `FIREWORKS_SECRET_KEY` as primary and `FIREWORKS_API_KEY` as fallback.
 */
export function getFireworksApiKey(explicitKey?: string): string {
  return explicitKey || process.env.FIREWORKS_SECRET_KEY || process.env.FIREWORKS_API_KEY || "";
}
