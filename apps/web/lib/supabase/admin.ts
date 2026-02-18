import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Create a Supabase client with the service role key for admin operations
// This should ONLY be used server-side for privileged operations like:
// - Inviting users by email (auth.admin.inviteUserByEmail)
// - Managing users
// - Bypassing RLS policies when necessary
// - Background agent jobs (no request cookies available)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: SupabaseClient<any, "public", any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): SupabaseClient<any, "public", any> {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
