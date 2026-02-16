import { createClient } from "@/lib/supabase/server";

export interface PlanTier {
  id: "FREE" | "PRO" | "STUDIO";
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxProjects: number; // -1 = unlimited
  maxTeamMembersPerProject: number; // -1 = unlimited
  historyRetentionDays: number; // -1 = unlimited
  hasCallSheetGeneration: boolean;
  hasPrioritySupport: boolean;
  hasCustomIntegrations: boolean;
  hasApiAccess: boolean;
  hasAdvancedScheduling: boolean;
  hasAiFeatures: boolean;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  displayOrder: number;
}

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

// Default tiers as fallback (matches database values)
export function getDefaultTiers(): PlanTier[] {
  return [
    {
      id: "FREE",
      name: "Free",
      description: "For individuals getting started",
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      maxProjects: 1,
      maxTeamMembersPerProject: 5,
      historyRetentionDays: 7,
      hasCallSheetGeneration: false,
      hasPrioritySupport: false,
      hasCustomIntegrations: false,
      hasApiAccess: false,
      hasAdvancedScheduling: false,
      hasAiFeatures: false,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
      displayOrder: 1,
    },
    {
      id: "PRO",
      name: "Pro",
      description: "For professionals on multiple productions",
      monthlyPriceCents: 2900,
      yearlyPriceCents: 29000,
      maxProjects: -1,
      maxTeamMembersPerProject: 25,
      historyRetentionDays: 30,
      hasCallSheetGeneration: true,
      hasPrioritySupport: false,
      hasCustomIntegrations: false,
      hasApiAccess: false,
      hasAdvancedScheduling: true,
      hasAiFeatures: true,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
      displayOrder: 2,
    },
    {
      id: "STUDIO",
      name: "Studio",
      description: "For power users and studios",
      monthlyPriceCents: 9900,
      yearlyPriceCents: 99000,
      maxProjects: -1,
      maxTeamMembersPerProject: -1,
      historyRetentionDays: -1,
      hasCallSheetGeneration: true,
      hasPrioritySupport: true,
      hasCustomIntegrations: true,
      hasApiAccess: true,
      hasAdvancedScheduling: true,
      hasAiFeatures: true,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
      displayOrder: 3,
    },
  ];
}

// Helper to format price
export function formatPrice(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(0)}`;
}

// Helper to format limit
export function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toString();
}

// Get features list for a tier (for display in UI)
export function getTierFeatures(tier: PlanTier): string[] {
  const features: string[] = [];

  // Project limit
  if (tier.maxProjects === -1) {
    features.push("Join unlimited projects");
  } else if (tier.maxProjects === 1) {
    features.push("Join 1 project");
  } else {
    features.push(`Join up to ${tier.maxProjects} projects`);
  }

  // Scheduling
  if (tier.hasAdvancedScheduling) {
    features.push("Advanced scheduling");
  } else {
    features.push("Basic scheduling");
  }

  // Call sheets
  if (tier.hasCallSheetGeneration) {
    features.push("Call sheet generation");
  }

  // History
  if (tier.historyRetentionDays === -1) {
    features.push("Unlimited history");
  } else {
    features.push(`${tier.historyRetentionDays}-day history`);
  }

  // AI features
  if (tier.hasAiFeatures) {
    features.push("AI-powered features");
  }

  // Priority support
  if (tier.hasPrioritySupport) {
    features.push("Priority support");
  }

  // Custom integrations
  if (tier.hasCustomIntegrations) {
    features.push("Custom integrations");
  }

  // API access
  if (tier.hasApiAccess) {
    features.push("API access");
  }

  return features;
}

// Check if a feature is available for a plan
export function planHasFeature(
  plan: "FREE" | "PRO" | "STUDIO",
  feature: keyof Pick<PlanTier,
    "hasCallSheetGeneration" | "hasPrioritySupport" | "hasCustomIntegrations" |
    "hasApiAccess" | "hasAdvancedScheduling" | "hasAiFeatures"
  >
): boolean {
  const defaults = getDefaultTiers();
  const tier = defaults.find((t) => t.id === plan);
  return tier?.[feature] ?? false;
}
