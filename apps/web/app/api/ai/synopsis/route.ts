import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { buildAiCacheKey, getAiCachedResponse, setAiCachedResponse } from "@/lib/ai/cache";
import {
  SYNOPSIS_GENERATION_PROMPT,
  SYNOPSIS_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";

const SYNOPSIS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

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
      dayNight?: string;
      scriptText?: string;
      stream?: boolean;
      forceRefresh?: boolean;
    };
    const {
      sceneId,
      projectId,
      sceneNumber,
      location,
      dayNight,
      scriptText,
      stream,
      forceRefresh,
    } = body;

    if (!scriptText) {
      return NextResponse.json(
        { error: "scriptText is required" },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey({
      scope: projectId || user.id,
      sceneId: sceneId || null,
      sceneNumber: sceneNumber || null,
      location: location || null,
      dayNight: dayNight || null,
      scriptText,
    });

    if (!forceRefresh) {
      const cached = await getAiCachedResponse<{ synopsis: string }>(supabase, {
        endpoint: "/api/ai/synopsis",
        cacheKey,
      });

      if (cached) {
        const processingTime = Date.now() - startTime;
        await supabase.from("AIProcessingLog").insert({
          projectId,
          userId: user.id,
          endpoint: "/api/ai/synopsis",
          processingTimeMs: processingTime,
          success: true,
          metadata: { sceneId, synopsisLength: cached.synopsis.length, cacheHit: true },
        });

        if (stream) {
          const encoder = new TextEncoder();
          const readableStream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: cached.synopsis })}\n\n`)
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return new Response(readableStream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        return NextResponse.json({ data: cached, meta: { cached: true } });
      }
    }

    // 3. Build the user message
    const userMessage = buildPrompt(SYNOPSIS_USER_TEMPLATE, {
      sceneNumber: sceneNumber || "Unknown",
      location: location || "Unknown",
      dayNight: dayNight || "DAY",
      sceneText: scriptText,
    });

    const kimi = new KimiClient();

    // 4. Handle streaming response if requested
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          let fullText = "";
          try {
            for await (const chunk of kimi.completeStreaming({
              messages: [
                { role: "system", content: SYNOPSIS_GENERATION_PROMPT },
                { role: "user", content: userMessage },
              ],
              maxTokens: 500,
              temperature: 0.3,
            })) {
              fullText += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));

            await setAiCachedResponse(supabase, {
              endpoint: "/api/ai/synopsis",
              cacheKey,
              projectId: projectId || undefined,
              userId: user.id,
              response: { synopsis: fullText.trim() },
              ttlSeconds: SYNOPSIS_CACHE_TTL_SECONDS,
            });

            await supabase.from("AIProcessingLog").insert({
              projectId,
              userId: user.id,
              endpoint: "/api/ai/synopsis",
              processingTimeMs: Date.now() - startTime,
              success: true,
              metadata: { sceneId, synopsisLength: fullText.trim().length, cacheHit: false },
            });

            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Generation failed" })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 5. Non-streaming response
    const response = await kimi.complete({
      messages: [
        { role: "system", content: SYNOPSIS_GENERATION_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 500,
      temperature: 0.3,
    });

    // Clean up the synopsis
    const synopsis = response.trim();

    await setAiCachedResponse(supabase, {
      endpoint: "/api/ai/synopsis",
      cacheKey,
      projectId: projectId || undefined,
      userId: user.id,
      response: { synopsis },
      ttlSeconds: SYNOPSIS_CACHE_TTL_SECONDS,
    });

    // 6. Log the processing
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/synopsis",
      processingTimeMs: processingTime,
      success: true,
      metadata: { sceneId, synopsisLength: synopsis.length, cacheHit: false },
    });

    return NextResponse.json({ data: { synopsis }, meta: { cached: false } });
  } catch (error) {
    console.error("Synopsis generation error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/synopsis",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: "Failed to generate synopsis" },
      { status: 500 }
    );
  }
}
