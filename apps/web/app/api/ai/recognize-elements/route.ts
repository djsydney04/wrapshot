import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { buildAiCacheKey, getAiCachedResponse, setAiCachedResponse } from "@/lib/ai/cache";
import {
  ELEMENT_RECOGNITION_PROMPT,
  ELEMENT_RECOGNITION_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";

interface RecognizedElement {
  text: string;
  startIndex: number;
  endIndex: number;
  category: string;
  confidence: number;
  suggestion: string;
}

interface RecognitionResponse {
  elements: RecognizedElement[];
}

const RECOGNIZE_ELEMENTS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

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
      scriptText?: string;
      forceRefresh?: boolean;
    };
    const { sceneId, projectId, scriptText } = body;
    const forceRefresh = Boolean(body.forceRefresh);

    if (!scriptText) {
      return NextResponse.json(
        { error: "scriptText is required" },
        { status: 400 }
      );
    }

    // Limit script text length to prevent token overflow
    const truncatedText = scriptText.slice(0, 5000);

    const cacheKey = buildAiCacheKey({
      scope: projectId || user.id,
      sceneId: sceneId || null,
      scriptText: truncatedText,
    });

    if (!forceRefresh) {
      const cached = await getAiCachedResponse<{ elements: RecognizedElement[] }>(supabase, {
        endpoint: "/api/ai/recognize-elements",
        cacheKey,
      });

      if (cached) {
        const processingTime = Date.now() - startTime;
        await supabase.from("AIProcessingLog").insert({
          projectId,
          userId: user.id,
          endpoint: "/api/ai/recognize-elements",
          processingTimeMs: processingTime,
          success: true,
          metadata: {
            sceneId,
            elementsFound: cached.elements.length,
            textLength: truncatedText.length,
            cacheHit: true,
          },
        });

        return NextResponse.json({ data: cached, meta: { cached: true } });
      }
    }

    // 3. Build the user message
    const userMessage = buildPrompt(ELEMENT_RECOGNITION_USER_TEMPLATE, {
      sceneText: truncatedText,
    });

    // 4. Call Kimi
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: ELEMENT_RECOGNITION_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 2000,
      temperature: 0.2,
    });

    // 5. Parse the response
    const parsed = KimiClient.extractJson<RecognitionResponse>(response);

    // Validate and filter elements
    const elements = (parsed.elements || [])
      .filter((e) => {
        // Validate indices
        if (
          typeof e.startIndex !== "number" ||
          typeof e.endIndex !== "number" ||
          e.startIndex < 0 ||
          e.endIndex > truncatedText.length ||
          e.startIndex >= e.endIndex
        ) {
          return false;
        }
        // Validate confidence
        if (typeof e.confidence !== "number" || e.confidence < 0.5) {
          return false;
        }
        return true;
      })
      .map((e) => ({
        id: crypto.randomUUID(),
        text: e.text || truncatedText.slice(e.startIndex, e.endIndex),
        startIndex: e.startIndex,
        endIndex: e.endIndex,
        category: e.category || "UNKNOWN",
        confidence: Math.min(1, Math.max(0, e.confidence)),
        suggestion: e.suggestion || e.text,
      }))
      // Sort by position
      .sort((a, b) => a.startIndex - b.startIndex);

    // 6. Remove overlapping elements (keep higher confidence)
    const nonOverlapping: typeof elements = [];
    for (const element of elements) {
      const hasOverlap = nonOverlapping.some(
        (e) =>
          (element.startIndex >= e.startIndex && element.startIndex < e.endIndex) ||
          (element.endIndex > e.startIndex && element.endIndex <= e.endIndex)
      );
      if (!hasOverlap) {
        nonOverlapping.push(element);
      }
    }

    // 7. Log the processing
    const responseData = { elements: nonOverlapping };

    await setAiCachedResponse(supabase, {
      endpoint: "/api/ai/recognize-elements",
      cacheKey,
      projectId: projectId || undefined,
      userId: user.id,
      response: responseData,
      ttlSeconds: RECOGNIZE_ELEMENTS_CACHE_TTL_SECONDS,
    });

    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/recognize-elements",
      processingTimeMs: processingTime,
      success: true,
      metadata: {
        sceneId,
        elementsFound: nonOverlapping.length,
        textLength: truncatedText.length,
        cacheHit: false,
      },
    });

    return NextResponse.json({ data: responseData, meta: { cached: false } });
  } catch (error) {
    console.error("Element recognition error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/recognize-elements",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Failed to recognize elements" },
      { status: 500 }
    );
  }
}
