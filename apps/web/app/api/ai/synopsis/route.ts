import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import {
  SYNOPSIS_GENERATION_PROMPT,
  SYNOPSIS_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";

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
    const { sceneId, projectId, sceneNumber, location, dayNight, scriptText, stream } = body;

    if (!scriptText) {
      return NextResponse.json(
        { error: "scriptText is required" },
        { status: 400 }
      );
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
          try {
            for await (const chunk of kimi.completeStreaming({
              messages: [
                { role: "system", content: SYNOPSIS_GENERATION_PROMPT },
                { role: "user", content: userMessage },
              ],
              maxTokens: 500,
              temperature: 0.3,
            })) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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

    // 6. Log the processing
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/synopsis",
      processingTimeMs: processingTime,
      success: true,
      metadata: { sceneId, synopsisLength: synopsis.length },
    });

    return NextResponse.json({ data: { synopsis } });
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
