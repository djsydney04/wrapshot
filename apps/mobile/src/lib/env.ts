function readEnv(name: string): string | undefined {
  const env =
    typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : undefined;
  const value = env?.[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSupabaseUrl(): string | undefined {
  return readEnv("EXPO_PUBLIC_SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function getConfigError(): string | null {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).";
  }
  return null;
}
