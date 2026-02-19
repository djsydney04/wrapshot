import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { buildAiCacheKey, getAiCachedResponse, setAiCachedResponse } from "@/lib/ai/cache";
import {
  TIME_ESTIMATION_PROMPT,
  TIME_ESTIMATION_USER_TEMPLATE,
  buildPrompt,
  formatElementsForPrompt,
  formatCastForPrompt,
} from "@/lib/ai/prompts";

interface TimeEstimateFactor {
  factor: string;
  impact: "increases" | "decreases" | "neutral";
  description: string;
}

interface TimeEstimateResponse {
  hours: number;
  confidence: number;
  factors: TimeEstimateFactor[];
}

const TIME_ESTIMATE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14;

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
    const body = (await request.json()) as {
      sceneId?: string;
      projectId?: string;
      sceneNumber?: string;
      location?: string;
      intExt?: string;
      dayNight?: string;
      pageCount?: number;
      pageEighths?: number;
      cast?: Array<{ characterName: string; actorName?: string }>;
      elements?: Array<{ category: string; name: string }>;
      synopsis?: string;
      scriptText?: string;
      forceRefresh?: boolean;
    };
    const {
      sceneId,
      projectId,
      sceneNumber,
      location,
      intExt,
      dayNight,
      pageCount,
      pageEighths,
      cast,
      elements,
      synopsis,
      scriptText,
      forceRefresh,
    } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: "sceneId is required" },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey({
      scope: projectId || user.id,
      sceneId,
      sceneNumber: sceneNumber || null,
      location: location || null,
      intExt: intExt || null,
      dayNight: dayNight || null,
      pageCount: pageCount || 0,
      pageEighths: pageEighths || 0,
      cast: cast || [],
      elements: elements || [],
      synopsis: synopsis || null,
      scriptText: scriptText || null,
    });

    if (!forceRefresh) {
      const cached = await getAiCachedResponse<{
        hours: number;
        confidence: number;
        factors: TimeEstimateFactor[];
        updatedAt: string;
      }>(supabase, {
        endpoint: "/api/ai/estimate-time",
        cacheKey,
      });

      if (cached) {
        const processingTime = Date.now() - startTime;
        await supabase.from("AIProcessingLog").insert({
          projectId,
          userId: user.id,
          endpoint: "/api/ai/estimate-time",
          processingTimeMs: processingTime,
          success: true,
          metadata: {
            sceneId,
            estimatedHours: cached.hours,
            confidence: cached.confidence,
            cacheHit: true,
          },
        });

        return NextResponse.json({ data: cached, meta: { cached: true } });
      }
    }

    // 3. Format inputs for the prompt
    const safeCast = Array.isArray(cast)
      ? cast
          .filter(
            (member): member is { characterName: string; actorName?: string } =>
              typeof member?.characterName === "string" && member.characterName.length > 0
          )
          .map((member) => ({
            characterName: member.characterName,
            actorName: member.actorName,
          }))
      : [];
    const safeElements = Array.isArray(elements)
      ? elements
          .filter(
            (
              element
            ): element is {
              category: string;
              name: string;
            } =>
              typeof element?.category === "string" &&
              element.category.length > 0 &&
              typeof element?.name === "string" &&
              element.name.length > 0
          )
          .map((element) => ({
            category: element.category,
            name: element.name,
          }))
      : [];

    const formattedCast = formatCastForPrompt(safeCast);
    const formattedElements = formatElementsForPrompt(safeElements);

    // 4. Build the user message
    const userMessage = buildPrompt(TIME_ESTIMATION_USER_TEMPLATE, {
      sceneNumber: sceneNumber || "Unknown",
      location: location || "Unknown",
      intExt: intExt || "INT",
      dayNight: dayNight || "DAY",
      pageCount: String(pageCount || 0),
      pageEighths: String(pageEighths || 0),
      cast: formattedCast,
      elements: formattedElements,
      synopsis: synopsis || "No synopsis available",
      sceneText: scriptText || "No script text available",
    });

    // 5. Call Kimi
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: TIME_ESTIMATION_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    });

    // 6. Parse the response
    const parsed = KimiClient.extractJson<TimeEstimateResponse>(response);

    // Validate and clamp values
    const estimate = {
      hours: Math.max(0.25, Math.min(24, parsed.hours || 1)),
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      factors: (parsed.factors || []).slice(0, 10).map((f) => ({
        factor: f.factor || "Unknown factor",
        impact: f.impact || "neutral",
        description: f.description || "",
      })),
      updatedAt: new Date().toISOString(),
    };

    await setAiCachedResponse(supabase, {
      endpoint: "/api/ai/estimate-time",
      cacheKey,
      projectId: projectId || undefined,
      userId: user.id,
      response: estimate,
      ttlSeconds: TIME_ESTIMATE_CACHE_TTL_SECONDS,
    });

    // 7. Log the processing
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/estimate-time",
      processingTimeMs: processingTime,
      success: true,
      metadata: {
        sceneId,
        estimatedHours: estimate.hours,
        confidence: estimate.confidence,
        cacheHit: false,
      },
    });

    // 8. Store the suggestion for tracking
    if (projectId) {
      await supabase.from("AISuggestion").insert({
        projectId,
        sceneId,
        type: "time_estimate",
        suggestion: estimate,
        confidence: estimate.confidence,
        status: "pending",
      });
    }

    return NextResponse.json({ data: estimate, meta: { cached: false } });
  } catch (error) {
    console.error("Time estimation error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/estimate-time",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Failed to estimate time" },
      { status: 500 }
    );
  }
}
