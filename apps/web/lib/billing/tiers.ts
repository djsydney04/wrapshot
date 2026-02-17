// Server-side tier functions (uses next/headers via supabase/server)
// For client-side code, use lib/billing/tiers-shared.ts or lib/hooks/use-tiers.tsx

import { createClient } from "@/lib/supabase/server";
import { type PlanTier, getDefaultTiers } from "./tiers-shared";

// Re-export shared types and functions for backwards compatibility
export type { PlanTier } from "./tiers-shared";
export { getDefaultTiers, formatPrice, formatLimit, getTierFeatures, planHasFeature } from "./tiers-shared";

// Fetch all plan tiers from the database
export async function getPlanTiers(): Promise<PlanTier[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("PlanTier")
    .select("*")
    .order("displayOrder", { ascending: true });

  if (error) {
    console.error("Error fetching plan tiers:", error);
    return getDefaultTiers();
  }

  return data as PlanTier[];
}

// Fetch a specific tier
export async function getPlanTier(tierId: string): Promise<PlanTier | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("PlanTier")
    .select("*")
    .eq("id", tierId)
    .single();

  if (error) {
    console.error("Error fetching plan tier:", error);
    return null;
  }

  return data as PlanTier;
}
