export const WRAPSHOT_INTELLIGENCE_LABEL = "Wrapshot Intelligence";
const DEFAULT_CEREBRAS_MODEL = "zai-glm-4.7";
const DEFAULT_FIREWORKS_MODEL = "accounts/fireworks/models/kimi-k2p5";

/**
 * Resolve the Cerebras API key from supported environment variable names.
 * Uses `CEREBRAS_API_KEY` as primary and `CEREBRAS_APPI_KEY` as fallback for compatibility.
 */
export function getCerebrasApiKey(explicitKey?: string): string {
  return explicitKey || process.env.CEREBRAS_API_KEY || process.env.CEREBRAS_APPI_KEY || "";
}

/**
 * Resolve the Fireworks API key from supported environment variable names.
 * Uses `FIREWORKS_SECRET_KEY` as primary and `FIREWORKS_API_KEY` as fallback.
 */
export function getFireworksApiKey(explicitKey?: string): string {
  return explicitKey || process.env.FIREWORKS_SECRET_KEY || process.env.FIREWORKS_API_KEY || "";
}

/**
 * Resolve the API key for script-analysis workloads.
 * Prefers Cerebras (GLM 4.7), then falls back to Fireworks.
 */
export function getScriptAnalysisApiKey(): string {
  return getCerebrasApiKey() || getFireworksApiKey();
}

export function getScriptAnalysisProvider(): "cerebras" | "fireworks" | null {
  if (getCerebrasApiKey()) return "cerebras";
  if (getFireworksApiKey()) return "fireworks";
  return null;
}

export function getCerebrasModel(): string {
  return process.env.CEREBRAS_MODEL || DEFAULT_CEREBRAS_MODEL;
}

export function getFireworksModel(): string {
  return process.env.FIREWORKS_MODEL || DEFAULT_FIREWORKS_MODEL;
}
