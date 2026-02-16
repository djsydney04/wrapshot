import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import {
  ELEMENT_SUGGESTION_PROMPT,
  ELEMENT_SUGGESTION_USER_TEMPLATE,
  buildPrompt,
  formatElementsForPrompt,
} from "@/lib/ai/prompts";
import type { ElementCategory } from "@/lib/constants/elements";

interface ElementSuggestion {
  category: ElementCategory;
  name: string;
  confidence: number;
  reason: string;
  sourceText?: string;
}

interface SuggestionResponse {
  suggestions: ElementSuggestion[];
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse input
    const body = await request.json();
    const { sceneId, projectId, scriptText, existingElements } = body;

    if (!sceneId || !scriptText) {
      return NextResponse.json(
        { error: "sceneId and scriptText are required" },
        { status: 400 }
      );
    }

    // 3. Format existing elements for the prompt
    const formattedElements = formatElementsForPrompt(
      existingElements || []
    );

    // 4. Build the user message
    const userMessage = buildPrompt(ELEMENT_SUGGESTION_USER_TEMPLATE, {
      sceneText: scriptText,
      existingElements: formattedElements,
    });

    // 5. Call Kimi
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: ELEMENT_SUGGESTION_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 2000,
      temperature: 0.2,
    });

    // 6. Parse the response
    const parsed = KimiClient.extractJson<SuggestionResponse>(response);

    // 7. Filter suggestions with low confidence
    const suggestions = (parsed.suggestions || [])
      .filter((s) => s.confidence >= 0.5)
      .map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        status: "pending" as const,
      }));

    // 8. Log the processing (optional)
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/suggestions/elements",
      processingTimeMs: processingTime,
      success: true,
      metadata: {
        sceneId,
        suggestionsCount: suggestions.length,
      },
    });

    // 9. Store suggestions for tracking (optional)
    if (projectId && suggestions.length > 0) {
      const suggestionRecords = suggestions.map((s) => ({
        projectId,
        sceneId,
        type: "element",
        suggestion: s,
        confidence: s.confidence,
        status: "pending",
      }));

      await supabase.from("AISuggestion").insert(suggestionRecords);
    }

    return NextResponse.json({ data: suggestions });
  } catch (error) {
    console.error("Element suggestion error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/suggestions/elements",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
