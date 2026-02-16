import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
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
    } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: "sceneId is required" },
        { status: 400 }
      );
    }

    // 3. Format inputs for the prompt
    const formattedCast = formatCastForPrompt(cast || []);
    const formattedElements = formatElementsForPrompt(elements || []);

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

    return NextResponse.json({ data: estimate });
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
