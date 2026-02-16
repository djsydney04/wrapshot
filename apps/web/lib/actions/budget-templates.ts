"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { BudgetTemplate } from "@/lib/types";

export async function getBudgetTemplates(): Promise<BudgetTemplate[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("BudgetTemplate")
    .select("*")
    .order("isSystemTemplate", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching budget templates:", error);
    return [];
  }

  return (data || []) as BudgetTemplate[];
}
