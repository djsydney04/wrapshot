"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import {
  BUDGET_SUGGESTION_PROMPT,
  BUDGET_SUGGESTION_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";
import { getElementsWithSceneCounts } from "@/lib/actions/elements";
import { getShootingDays } from "@/lib/actions/shooting-days";
import { getScenes } from "@/lib/actions/scenes";
import { BUDGET_CHART_OF_ACCOUNTS } from "@/lib/types";
import {
  createBudgetCategory,
  updateBudgetCategory,
} from "@/lib/actions/budget-categories";
import {
  createBudgetLineItem,
  type LineItemUnits,
} from "@/lib/actions/budget-line-items";

export type BudgetSuggestionStatus = "pending" | "accepted" | "dismissed";

export interface BudgetSuggestionItem {
  departmentCode: string;
  departmentName: string;
  categoryCode: string;
  categoryName: string;
  accountCode: string;
  description: string;
  units: LineItemUnits;
  quantity: number;
  rate: number;
  fringePercent: number;
  confidence: number;
  rationale?: string;
  source?: string;
  budgetId: string;
}

interface BudgetSuggestionResponse {
  suggestions: BudgetSuggestionItem[];
}

export interface BudgetSuggestionRow {
  id: string;
  projectId: string;
  sceneId: string | null;
  type: string;
  suggestion: BudgetSuggestionItem;
  status: BudgetSuggestionStatus;
  confidence: number | null;
  createdAt: string;
}

const ELEMENT_CATEGORY_TO_BUDGET_CATEGORY: Record<string, string> = {
  PROP: "2200",
  WARDROBE: "2600",
  VEHICLE: "2900",
  ANIMAL: "2200",
  SPECIAL_EQUIPMENT: "2300",
  VFX: "3300",
  SFX: "2500",
  STUNT: "2500",
  MAKEUP: "2700",
  HAIR: "2700",
  GREENERY: "2200",
  ART_DEPARTMENT: "2200",
  SOUND: "2400",
  MUSIC: "3400",
  BACKGROUND: "2100",
  CAMERA: "2300",
  GRIP: "2500",
  ELECTRIC: "2500",
  SET_DRESSING: "2200",
  ADDITIONAL_LABOR: "2100",
  ANIMAL_WRANGLER: "2100",
  MECHANICAL_EFFECTS: "2500",
  VIDEO_PLAYBACK: "2300",
  SECURITY: "2100",
};

function getDepartmentForCategoryCode(code: string) {
  if (!code || code.length < 1) return null;
  const departmentCode = `${code[0]}000`;
  const department =
    BUDGET_CHART_OF_ACCOUNTS[departmentCode as keyof typeof BUDGET_CHART_OF_ACCOUNTS];
  if (!department) return null;
  return { departmentCode, departmentName: department.name };
}

function normalizeUnits(units?: string): LineItemUnits {
  if (units === "DAYS" || units === "WEEKS" || units === "FLAT" || units === "HOURS" || units === "EACH") {
    return units;
  }
  return "EACH";
}

function buildFallbackAccountCode(categoryCode: string, index: number) {
  return `${categoryCode}${(index + 1).toString().padStart(2, "0")}`;
}

function buildCategoryMap(): Record<string, { name: string; parentCode: string; parentName: string }> {
  const map: Record<string, { name: string; parentCode: string; parentName: string }> = {};
  Object.entries(BUDGET_CHART_OF_ACCOUNTS).forEach(([parentCode, parent]) => {
    Object.entries(parent.subcategories).forEach(([code, name]) => {
      map[code] = { name, parentCode, parentName: parent.name };
    });
  });
  return map;
}

function buildHeuristicSuggestions(params: {
  budgetId: string;
  shootingDayCount: number;
  elements: Array<{ category: string; name: string; sceneCount?: number }>;
}): BudgetSuggestionItem[] {
  const categoryMap = buildCategoryMap();
  const suggestions: BudgetSuggestionItem[] = [];

  params.elements.forEach((element, index) => {
    const categoryCode = ELEMENT_CATEGORY_TO_BUDGET_CATEGORY[element.category] || "2200";
    const categoryInfo = categoryMap[categoryCode];
    if (!categoryInfo) return;

    suggestions.push({
      budgetId: params.budgetId,
      departmentCode: categoryInfo.parentCode,
      departmentName: categoryInfo.parentName,
      categoryCode,
      categoryName: categoryInfo.name,
      accountCode: buildFallbackAccountCode(categoryCode, index),
      description: element.name,
      units: "EACH",
      quantity: Math.max(element.sceneCount || 1, 1),
      rate: 0,
      fringePercent: 0,
      confidence: 0.55,
      rationale: `Derived from ${element.category} element`,
      source: "project_data",
    });
  });

  if (params.shootingDayCount > 0) {
    const productionCategory = categoryMap["2100"];
    if (productionCategory) {
      suggestions.push({
        budgetId: params.budgetId,
        departmentCode: productionCategory.parentCode,
        departmentName: productionCategory.parentName,
        categoryCode: "2100",
        categoryName: productionCategory.name,
        accountCode: buildFallbackAccountCode("2100", suggestions.length),
        description: "Production staff (daily)",
        units: "DAYS",
        quantity: params.shootingDayCount,
        rate: 0,
        fringePercent: 0,
        confidence: 0.6,
        rationale: "Based on scheduled shooting days",
        source: "project_data",
      });
    }
  }

  return suggestions;
}

export async function getBudgetSuggestions(budgetId: string): Promise<BudgetSuggestionRow[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("projectId")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  const { data, error } = await supabase
    .from("AISuggestion")
    .select("*")
    .eq("projectId", budget.projectId)
    .eq("type", "budget_item")
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching budget suggestions:", error);
    return [];
  }

  return (data || [])
    .filter((row: BudgetSuggestionRow) => row.suggestion?.budgetId === budgetId)
    .map((row: BudgetSuggestionRow) => ({
      ...row,
      suggestion: {
        ...row.suggestion,
        budgetId,
      },
    }));
}

export async function generateBudgetSuggestions(budgetId: string): Promise<BudgetSuggestionRow[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: budget, error: budgetError } = await supabase
    .from("Budget")
    .select("id, projectId")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error("Budget not found");
  }

  const [{ data: scenesData }, { data: shootingDaysData }, elementsResult] = await Promise.all([
    getScenes(budget.projectId),
    getShootingDays(budget.projectId),
    getElementsWithSceneCounts(budget.projectId),
  ]);

  const scenes = scenesData || [];
  const shootingDays = shootingDaysData || [];
  const elements = elementsResult.data || [];

  const { data: categories } = await supabase
    .from("BudgetCategory")
    .select("id, code, name, parentCategoryId")
    .eq("budgetId", budgetId);

  const { data: lineItems } = await supabase
    .from("BudgetLineItem")
    .select("id, categoryId, accountCode, description")
    .in(
      "categoryId",
      (categories || []).map((category) => category.id)
    );

  const categoryLookup = buildCategoryMap();
  const existingCategoryCodes = (categories || []).map((category) => `${category.code} ${category.name}`);
  const existingLineItems = (lineItems || []).map(
    (item) => `${item.accountCode} ${item.description}`
  );

  const elementSummary = elements
    .map((element) => `${element.category}: ${element.name} (scenes: ${element.sceneCount || 0})`)
    .slice(0, 120)
    .join("\n");

  const projectSummary = [
    `Shooting days: ${shootingDays.length}`,
    `Scenes: ${scenes.length}`,
    "Elements:",
    elementSummary || "None",
  ].join("\n");

  const chartOfAccounts = Object.entries(BUDGET_CHART_OF_ACCOUNTS)
    .map(([code, category]) => {
      const subcats = Object.entries(category.subcategories)
        .map(([subCode, name]) => `${subCode} ${name}`)
        .join(", ");
      return `${code} ${category.name}: ${subcats}`;
    })
    .join("\n");

  const userMessage = buildPrompt(BUDGET_SUGGESTION_USER_TEMPLATE, {
    projectSummary,
    chartOfAccounts,
    existingCategories: existingCategoryCodes.join("\n") || "None",
    existingLineItems: existingLineItems.join("\n") || "None",
  });

  let suggestions: BudgetSuggestionItem[] = [];

  try {
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: BUDGET_SUGGESTION_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 1800,
      temperature: 0.2,
    });

    const parsed = KimiClient.extractJson<BudgetSuggestionResponse>(response);
    suggestions = (parsed.suggestions || [])
      .filter((suggestion) => suggestion && suggestion.description && suggestion.categoryCode)
      .map((suggestion, index) => {
      const categoryInfo = categoryLookup[suggestion.categoryCode];
      const departmentInfo = categoryInfo
        ? { departmentCode: categoryInfo.parentCode, departmentName: categoryInfo.parentName }
        : getDepartmentForCategoryCode(suggestion.categoryCode);

      const quantity = typeof suggestion.quantity === "number"
        ? suggestion.quantity
        : Number(suggestion.quantity);
      const rate = typeof suggestion.rate === "number"
        ? suggestion.rate
        : Number(suggestion.rate);
      const fringePercent = typeof suggestion.fringePercent === "number"
        ? suggestion.fringePercent
        : Number(suggestion.fringePercent);

      return {
        budgetId,
        departmentCode: suggestion.departmentCode || departmentInfo?.departmentCode || "2000",
        departmentName: suggestion.departmentName || departmentInfo?.departmentName || "Production",
        categoryCode: suggestion.categoryCode,
        categoryName: suggestion.categoryName || categoryInfo?.name || "General",
        accountCode: suggestion.accountCode || buildFallbackAccountCode(suggestion.categoryCode, index),
        description: suggestion.description,
        units: normalizeUnits(suggestion.units),
        quantity: Number.isFinite(quantity) ? quantity : 1,
        rate: Number.isFinite(rate) ? rate : 0,
        fringePercent: Number.isFinite(fringePercent) ? fringePercent : 0,
        confidence: Number.isFinite(suggestion.confidence) ? suggestion.confidence : 0.6,
        rationale: suggestion.rationale,
        source: suggestion.source || "ai",
      };
    });
  } catch (error) {
    console.error("Error generating Wrapshot Intelligence budget suggestions, falling back:", error);
    suggestions = buildHeuristicSuggestions({
      budgetId,
      shootingDayCount: shootingDays.length,
      elements: elements.map((element) => ({
        category: element.category,
        name: element.name,
        sceneCount: element.sceneCount,
      })),
    });
  }

  if (suggestions.length === 0) {
    return [];
  }

  const existingSuggestionDescriptions = new Set(
    (await getBudgetSuggestions(budgetId)).map((row) => row.suggestion.description)
  );
  const existingLineItemDescriptions = new Set(
    (lineItems || []).map((item) => item.description)
  );

  const deduped = suggestions.filter(
    (suggestion) =>
      !existingSuggestionDescriptions.has(suggestion.description) &&
      !existingLineItemDescriptions.has(suggestion.description)
  );

  if (deduped.length === 0) {
    return getBudgetSuggestions(budgetId);
  }

  const suggestionRecords = deduped.map((suggestion) => ({
    projectId: budget.projectId,
    type: "budget_item",
    suggestion: {
      ...suggestion,
      budgetId,
    },
    confidence: suggestion.confidence,
    status: "pending" as const,
  }));

  const { error: insertError } = await supabase.from("AISuggestion").insert(suggestionRecords);

  if (insertError) {
    console.error("Error saving budget suggestions:", insertError);
  }

  return getBudgetSuggestions(budgetId);
}

export async function acceptBudgetSuggestion(suggestionId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: suggestionRow, error } = await supabase
    .from("AISuggestion")
    .select("*")
    .eq("id", suggestionId)
    .single();

  if (error || !suggestionRow) {
    throw new Error("Suggestion not found");
  }

  const suggestion = suggestionRow.suggestion as BudgetSuggestionItem;
  if (!suggestion?.budgetId) {
    throw new Error("Suggestion missing budget context");
  }

  const { data: categories } = await supabase
    .from("BudgetCategory")
    .select("id, code, name, parentCategoryId")
    .eq("budgetId", suggestion.budgetId);

  const categoryMap = new Map((categories || []).map((category) => [category.code, category]));

  let departmentCategory = categoryMap.get(suggestion.departmentCode);
  if (!departmentCategory) {
    departmentCategory = await createBudgetCategory(suggestion.budgetId, {
      code: suggestion.departmentCode,
      name: suggestion.departmentName,
      parentCategoryId: null,
      allocatedBudget: 0,
    });
  }

  let targetCategory = categoryMap.get(suggestion.categoryCode);
  if (!targetCategory) {
    targetCategory = await createBudgetCategory(suggestion.budgetId, {
      code: suggestion.categoryCode,
      name: suggestion.categoryName,
      parentCategoryId: departmentCategory.id,
      allocatedBudget: 0,
    });
  } else if (targetCategory.parentCategoryId !== departmentCategory.id) {
    await updateBudgetCategory(targetCategory.id, {
      parentCategoryId: departmentCategory.id,
    });
  }

  await createBudgetLineItem(targetCategory.id, {
    accountCode: suggestion.accountCode,
    description: suggestion.description,
    units: normalizeUnits(suggestion.units),
    quantity: suggestion.quantity || 1,
    rate: suggestion.rate || 0,
    fringePercent: suggestion.fringePercent || 0,
  });

  await supabase
    .from("AISuggestion")
    .update({
      status: "accepted",
      respondedAt: new Date().toISOString(),
      respondedBy: userId,
    })
    .eq("id", suggestionId);
}

export async function dismissBudgetSuggestion(suggestionId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  await supabase
    .from("AISuggestion")
    .update({
      status: "dismissed",
      respondedAt: new Date().toISOString(),
      respondedBy: userId,
    })
    .eq("id", suggestionId);
}
