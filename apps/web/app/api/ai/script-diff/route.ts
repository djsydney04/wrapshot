import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import {
  SCRIPT_DIFF_PROMPT,
  SCRIPT_DIFF_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";

interface SceneChange {
  sceneNumber: string;
  changeType: "added" | "modified" | "deleted";
  summary: string;
  details: { type: string; description: string }[];
  productionImpact: "low" | "medium" | "high";
  suggestedActions: string[];
}

interface DiffSummary {
  totalScenesChanged: number;
  scenesAdded: number;
  scenesDeleted: number;
  estimatedScheduleImpact: string;
}

interface DiffResponse {
  changes: SceneChange[];
  summary: DiffSummary;
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
    const { projectId, previousScript, newScript, previousVersion, newVersion } = body;

    if (!previousScript || !newScript) {
      return NextResponse.json(
        { error: "Both previousScript and newScript are required" },
        { status: 400 }
      );
    }

    // 3. Build the user message
    const userMessage = buildPrompt(SCRIPT_DIFF_USER_TEMPLATE, {
      previousScript,
      newScript,
    });

    // 4. Call Kimi
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: SCRIPT_DIFF_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 4000,
      temperature: 0.2,
    });

    // 5. Parse the response
    const parsed = KimiClient.extractJson<DiffResponse>(response);

    // Validate and structure the response
    const result = {
      changes: (parsed.changes || []).map((change) => ({
        sceneNumber: change.sceneNumber || "Unknown",
        changeType: change.changeType || "modified",
        summary: change.summary || "No summary",
        details: change.details || [],
        productionImpact: change.productionImpact || "low",
        suggestedActions: change.suggestedActions || [],
      })),
      summary: {
        totalScenesChanged: parsed.summary?.totalScenesChanged || parsed.changes?.length || 0,
        scenesAdded: parsed.summary?.scenesAdded || 0,
        scenesDeleted: parsed.summary?.scenesDeleted || 0,
        estimatedScheduleImpact: parsed.summary?.estimatedScheduleImpact || "Unknown",
      },
      previousVersion,
      newVersion,
      analyzedAt: new Date().toISOString(),
    };

    // 6. Log the processing
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/script-diff",
      processingTimeMs: processingTime,
      success: true,
      metadata: {
        changesCount: result.changes.length,
        previousVersion,
        newVersion,
      },
    });

    // 7. Store change suggestions for tracking
    if (projectId && result.changes.length > 0) {
      const suggestionRecords = result.changes.map((change) => ({
        projectId,
        type: "script_change",
        suggestion: change,
        confidence: change.productionImpact === "high" ? 0.9 : change.productionImpact === "medium" ? 0.7 : 0.5,
        status: "pending",
      }));

      await supabase.from("AISuggestion").insert(suggestionRecords);
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Script diff error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/script-diff",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Failed to analyze script changes" },
      { status: 500 }
    );
  }
}
