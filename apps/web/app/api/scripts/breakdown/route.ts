import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient, SCENE_EXTRACTION_PROMPT, KimiClient as KC } from "@/lib/ai/kimi-client";
import { parsePdfScript, normalizeScriptText } from "@/lib/scripts/parser";

export interface ExtractedScene {
  scene_number: string;
  int_ext: "INT" | "EXT";
  set_name: string;
  time_of_day: string;
  page_length_eighths: number;
  synopsis: string;
  characters: string[];
  script_page_start: number;
  script_page_end: number;
}

export interface BreakdownResult {
  scenes: ExtractedScene[];
  total_pages: number;
  total_scenes: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scriptId, fileUrl } = body;

    if (!scriptId || !fileUrl) {
      return NextResponse.json(
        { error: "scriptId and fileUrl are required" },
        { status: 400 }
      );
    }

    const fireworksKey = process.env.FIREWORKS_SECRET_KEY;
    if (!fireworksKey) {
      console.error("FIREWORKS_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "AI breakdown not configured" },
        { status: 500 }
      );
    }

    // Update script status to IN_PROGRESS
    await supabase
      .from("Script")
      .update({
        breakdownStatus: "IN_PROGRESS",
        breakdownStartedAt: new Date().toISOString(),
      })
      .eq("id", scriptId);

    // Fetch the PDF file
    let pdfBuffer: Buffer;
    try {
      const pdfResponse = await fetch(fileUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
      }
      const arrayBuffer = await pdfResponse.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } catch (fetchError) {
      console.error("Error fetching PDF:", fetchError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "Failed to fetch script file" },
        { status: 500 }
      );
    }

    // Parse the PDF
    let scriptText: string;
    let pageCount: number;
    try {
      const parsed = await parsePdfScript(pdfBuffer);
      scriptText = normalizeScriptText(parsed.text);
      pageCount = parsed.pageCount;
    } catch (parseError) {
      console.error("Error parsing PDF:", parseError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "Failed to parse script PDF" },
        { status: 500 }
      );
    }

    // Use Kimi to extract scenes
    const kimi = new KimiClient(fireworksKey);
    let breakdownResult: BreakdownResult;

    try {
      // For very long scripts, we might need to chunk. For now, send the whole thing
      // with a character limit warning
      const maxChars = 50000; // ~15 pages of script
      const truncatedText = scriptText.length > maxChars
        ? scriptText.slice(0, maxChars) + "\n\n[SCRIPT TRUNCATED FOR PROCESSING]"
        : scriptText;

      const response = await kimi.complete({
        messages: [
          { role: "system", content: SCENE_EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Please analyze this screenplay and extract all scenes:\n\n${truncatedText}`,
          },
        ],
        maxTokens: 8000,
        temperature: 0.1,
      });

      breakdownResult = KC.extractJson<BreakdownResult>(response);

      // Validate the result
      if (!breakdownResult.scenes || !Array.isArray(breakdownResult.scenes)) {
        throw new Error("Invalid breakdown result: missing scenes array");
      }
    } catch (aiError) {
      console.error("Error in AI breakdown:", aiError);
      await supabase
        .from("Script")
        .update({ breakdownStatus: "FAILED" })
        .eq("id", scriptId);
      return NextResponse.json(
        { error: "AI breakdown failed" },
        { status: 500 }
      );
    }

    // Update script with results
    await supabase
      .from("Script")
      .update({
        breakdownStatus: "COMPLETED",
        breakdownCompletedAt: new Date().toISOString(),
        parsedContent: breakdownResult,
      })
      .eq("id", scriptId);

    return NextResponse.json({
      success: true,
      data: breakdownResult,
      pageCount,
    });
  } catch (error) {
    console.error("Error in script breakdown:", error);
    return NextResponse.json(
      { error: "Failed to breakdown script" },
      { status: 500 }
    );
  }
}

// GET endpoint to check breakdown status
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get("scriptId");

    if (!scriptId) {
      return NextResponse.json(
        { error: "scriptId is required" },
        { status: 400 }
      );
    }

    const { data: script, error } = await supabase
      .from("Script")
      .select("id, breakdownStatus, breakdownStartedAt, breakdownCompletedAt, parsedContent")
      .eq("id", scriptId)
      .single();

    if (error || !script) {
      return NextResponse.json(
        { error: "Script not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: script.breakdownStatus,
      startedAt: script.breakdownStartedAt,
      completedAt: script.breakdownCompletedAt,
      data: script.parsedContent,
    });
  } catch (error) {
    console.error("Error checking breakdown status:", error);
    return NextResponse.json(
      { error: "Failed to check breakdown status" },
      { status: 500 }
    );
  }
}
