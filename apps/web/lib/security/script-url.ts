const SUPABASE_STORAGE_PATH_PREFIX = "/storage/v1/object/";

function getConfiguredSupabaseHost(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    return new URL(supabaseUrl).host;
  } catch {
    return null;
  }
}

export function isTrustedSupabaseStorageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const configuredHost = getConfiguredSupabaseHost();

    if (!configuredHost) {
      return false;
    }

    if (parsed.host !== configuredHost) {
      return false;
    }

    return parsed.pathname.includes(SUPABASE_STORAGE_PATH_PREFIX);
  } catch {
    return false;
  }
}
