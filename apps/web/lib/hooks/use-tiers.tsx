"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/billing/tiers";
import { getDefaultTiers, getTierFeatures, formatPrice } from "@/lib/billing/tiers";

// Re-export helpers for convenience
export { getTierFeatures, formatPrice, formatLimit } from "@/lib/billing/tiers";
export type { PlanTier } from "@/lib/billing/tiers";

interface TiersContextType {
  tiers: PlanTier[];
  loading: boolean;
  getTier: (id: string) => PlanTier | undefined;
  refetch: () => Promise<void>;
}

const TiersContext = React.createContext<TiersContextType | undefined>(undefined);

export function TiersProvider({ children }: { children: React.ReactNode }) {
  const [tiers, setTiers] = React.useState<PlanTier[]>(getDefaultTiers());
  const [loading, setLoading] = React.useState(true);
  const supabase = createClient();

  const fetchTiers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("PlanTier")
        .select("*")
        .order("displayOrder", { ascending: true });

      if (error) {
        console.error("Error fetching tiers:", error);
        // Keep using default tiers
        return;
      }

      if (data && data.length > 0) {
        setTiers(data as PlanTier[]);
      }
    } catch (error) {
      console.error("Failed to fetch tiers:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const getTier = React.useCallback(
    (id: string) => tiers.find((t) => t.id === id),
    [tiers]
  );

  return (
    <TiersContext.Provider value={{ tiers, loading, getTier, refetch: fetchTiers }}>
      {children}
    </TiersContext.Provider>
  );
}

export function useTiers() {
  const context = React.useContext(TiersContext);
  if (!context) {
    // Return default tiers if provider not available
    return {
      tiers: getDefaultTiers(),
      loading: false,
      getTier: (id: string) => getDefaultTiers().find((t) => t.id === id),
      refetch: async () => {},
    };
  }
  return context;
}

// Hook to get a specific tier
export function useTier(tierId: "FREE" | "PRO" | "STUDIO") {
  const { getTier } = useTiers();
  return getTier(tierId);
}

// Hook to check if current user's plan has a feature
export function useHasFeature(
  feature: keyof Pick<PlanTier,
    "hasCallSheetGeneration" | "hasPrioritySupport" | "hasCustomIntegrations" |
    "hasApiAccess" | "hasAdvancedScheduling" | "hasAiFeatures"
  >
): boolean {
  const { subscription } = useSubscriptionContext();
  const { getTier } = useTiers();

  const currentPlan = subscription?.plan ?? "FREE";
  const tier = getTier(currentPlan);

  return tier?.[feature] ?? false;
}

// Import subscription context for feature checking
import { useAuth } from "@/components/providers/auth-provider";

function useSubscriptionContext() {
  const { subscription } = useAuth();
  return { subscription };
}
