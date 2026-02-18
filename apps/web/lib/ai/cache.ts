import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

interface AICacheLookupParams {
  endpoint: string;
  cacheKey: string;
}

interface AICacheWriteParams<T> extends AICacheLookupParams {
  projectId?: string;
  userId: string;
  response: T;
  ttlSeconds?: number;
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => [key, normalizeForHash(entryValue)]);

    return Object.fromEntries(entries);
  }

  return value;
}

export function buildAiCacheKey(input: unknown): string {
  const normalized = normalizeForHash(input);
  const payload = JSON.stringify(normalized);
  return createHash("sha256").update(payload).digest("hex");
}

function toIsoExpiry(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function getAiCachedResponse<T>(
  supabase: SupabaseClient,
  params: AICacheLookupParams
): Promise<T | null> {
  const { endpoint, cacheKey } = params;

  const { data, error } = await supabase
    .from("AICache")
    .select("response, expiresAt")
    .eq("endpoint", endpoint)
    .eq("cacheKey", cacheKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (isExpired(data.expiresAt)) {
    await supabase
      .from("AICache")
      .delete()
      .eq("endpoint", endpoint)
      .eq("cacheKey", cacheKey);
    return null;
  }

  return data.response as T;
}

export async function setAiCachedResponse<T>(
  supabase: SupabaseClient,
  params: AICacheWriteParams<T>
): Promise<void> {
  const {
    endpoint,
    cacheKey,
    userId,
    projectId,
    response,
    ttlSeconds = DEFAULT_CACHE_TTL_SECONDS,
  } = params;

  await supabase.from("AICache").upsert(
    {
      endpoint,
      cacheKey,
      projectId: projectId || null,
      userId,
      response,
      expiresAt: toIsoExpiry(ttlSeconds),
      updatedAt: new Date().toISOString(),
    },
    { onConflict: "endpoint,cacheKey" }
  );
}
