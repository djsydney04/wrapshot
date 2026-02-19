import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { PROJECT_CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SceneContextRow {
  id: string;
  sceneNumber: string;
  intExt: string;
  dayNight: string;
  pageCount: number | null;
  status: string;
  synopsis: string | null;
  location: { name: string } | { name: string }[] | null;
}

const CHAT_HISTORY_LIMIT = 40;
const CHAT_RENDER_LIMIT = 240;

function trimText(value: string | null | undefined, maxLength: number): string {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function getLocationName(scene: SceneContextRow): string {
  if (!scene.location) return "Unknown";
  if (Array.isArray(scene.location)) {
    return scene.location[0]?.name || "Unknown";
  }
  return scene.location.name || "Unknown";
}

async function ensureProjectAccess(
  projectId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("ProjectMember")
    .select("id")
    .eq("projectId", projectId)
    .eq("userId", userId)
    .single();

  if (!membership) {
    return { ok: false, error: "Project access denied" };
  }

  return { ok: true };
}

async function buildProjectContext(projectId: string): Promise<string> {
  const supabase = await createClient();

  const [
    { data: project },
    { data: scenes },
    { data: locations },
    { data: shootingDays },
    { data: castMembers },
    { data: crewMembers },
    { data: scripts },
    { data: elements },
  ] = await Promise.all([
    supabase
      .from("Project")
      .select("name, description, status, startDate, endDate")
      .eq("id", projectId)
      .single(),
    supabase
      .from("Scene")
      .select(
        `
        id,
        sceneNumber,
        intExt,
        dayNight,
        pageCount,
        status,
        synopsis,
        location:Location(name)
      `
      )
      .eq("projectId", projectId)
      .order("sortOrder", { ascending: true })
      .order("sceneNumber", { ascending: true })
      .limit(200),
    supabase
      .from("Location")
      .select("name, address, permitStatus, locationType, interiorExterior")
      .eq("projectId", projectId)
      .order("name", { ascending: true })
      .limit(80),
    supabase
      .from("ShootingDay")
      .select(
        `
        dayNumber,
        date,
        status,
        generalCall,
        estimatedWrap,
        scenes:ShootingDayScene(sceneId)
      `
      )
      .eq("projectId", projectId)
      .order("date", { ascending: true })
      .limit(120),
    supabase
      .from("CastMember")
      .select("characterName, actorName, workStatus")
      .eq("projectId", projectId)
      .order("castNumber", { ascending: true })
      .limit(120),
    supabase
      .from("CrewMember")
      .select("name, role, department")
      .eq("projectId", projectId)
      .order("department", { ascending: true })
      .limit(160),
    supabase
      .from("Script")
      .select("fileName, isActive, uploadedAt, content")
      .eq("projectId", projectId)
      .order("uploadedAt", { ascending: false })
      .limit(2),
    supabase.from("Element").select("category").eq("projectId", projectId).limit(400),
  ]);

  const sceneRows = (scenes || []) as SceneContextRow[];
  const elementCounts = new Map<string, number>();
  (elements || []).forEach((element) => {
    const key = element.category || "OTHER";
    elementCounts.set(key, (elementCounts.get(key) || 0) + 1);
  });

  const activeScript =
    scripts?.find((script) => script.isActive) || scripts?.[0] || null;
  const scriptExcerpt = trimText(activeScript?.content, 2400);

  const lines: string[] = [];
  lines.push(`Project: ${project?.name || "Unknown"}`);
  lines.push(`Status: ${project?.status || "Unknown"}`);
  lines.push(
    `Dates: start=${project?.startDate ? String(project.startDate).slice(0, 10) : "N/A"}, end=${project?.endDate ? String(project.endDate).slice(0, 10) : "N/A"}`
  );
  lines.push(
    `Counts: scenes=${sceneRows.length}, shootingDays=${shootingDays?.length || 0}, locations=${locations?.length || 0}, cast=${castMembers?.length || 0}, crew=${crewMembers?.length || 0}, elements=${elements?.length || 0}`
  );

  if (activeScript) {
    lines.push(`Active script: ${activeScript.fileName || "Unnamed script"}`);
  }

  if (scriptExcerpt) {
    lines.push("Script excerpt:");
    lines.push(scriptExcerpt);
  }

  if (sceneRows.length > 0) {
    lines.push("Scenes:");
    sceneRows.slice(0, 120).forEach((scene) => {
      lines.push(
        `- ${scene.sceneNumber} | ${getLocationName(scene)} | ${scene.intExt}/${scene.dayNight} | pages=${scene.pageCount ?? 1} | status=${scene.status} | ${trimText(scene.synopsis, 80) || "No synopsis"}`
      );
    });
    if (sceneRows.length > 120) {
      lines.push(`- ... ${sceneRows.length - 120} additional scenes not shown`);
    }
  }

  if (shootingDays && shootingDays.length > 0) {
    lines.push("Shooting days:");
    shootingDays.forEach((day) => {
      const sceneCount = Array.isArray(day.scenes) ? day.scenes.length : 0;
      lines.push(
        `- Day ${day.dayNumber} on ${String(day.date).slice(0, 10)} | call=${day.generalCall || "N/A"} | wrap=${day.estimatedWrap || "N/A"} | scenes=${sceneCount} | status=${day.status}`
      );
    });
  }

  if (locations && locations.length > 0) {
    lines.push("Locations:");
    locations.forEach((location) => {
      lines.push(
        `- ${location.name} | ${location.locationType}/${location.interiorExterior} | permit=${location.permitStatus} | ${trimText(location.address, 80) || "No address"}`
      );
    });
  }

  if (castMembers && castMembers.length > 0) {
    lines.push("Cast:");
    castMembers.forEach((cast) => {
      lines.push(
        `- ${cast.characterName}${cast.actorName ? ` (${cast.actorName})` : ""} | ${cast.workStatus}`
      );
    });
  }

  if (crewMembers && crewMembers.length > 0) {
    lines.push("Crew:");
    crewMembers.forEach((crew) => {
      lines.push(`- ${crew.name} | ${crew.role || "Role not set"} | ${crew.department}`);
    });
  }

  if (elementCounts.size > 0) {
    lines.push("Elements by category:");
    Array.from(elementCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, count]) => {
        lines.push(`- ${category}: ${count}`);
      });
  }

  return lines.join("\n");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await ensureProjectAccess(projectId, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("ProjectAIChatMessage")
    .select("id, role, content, createdAt")
    .eq("projectId", projectId)
    .eq("userId", user.id)
    .order("createdAt", { ascending: true })
    .limit(CHAT_RENDER_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data || []) as ChatMessageRow[] });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await ensureProjectAccess(projectId, user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: 403 });
  }

  const { error } = await supabase
    .from("ProjectAIChatMessage")
    .delete()
    .eq("projectId", projectId)
    .eq("userId", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { projectId?: string; message?: string };
    const projectId = body.projectId;
    const message = body.message?.trim();

    if (!projectId || !message) {
      return NextResponse.json(
        { error: "projectId and message are required" },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Message is too long (max 4000 chars)" },
        { status: 400 }
      );
    }

    const access = await ensureProjectAccess(projectId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const { error: userInsertError } = await supabase.from("ProjectAIChatMessage").insert({
      projectId,
      userId: user.id,
      role: "user",
      content: message,
    });

    if (userInsertError) {
      return NextResponse.json(
        { error: userInsertError.message },
        { status: 500 }
      );
    }

    const [{ data: historyRows }, context] = await Promise.all([
      supabase
        .from("ProjectAIChatMessage")
        .select("role, content")
        .eq("projectId", projectId)
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(CHAT_HISTORY_LIMIT),
      buildProjectContext(projectId),
    ]);

    const history = [...(historyRows || [])].reverse();
    const modelMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: PROJECT_CHAT_SYSTEM_PROMPT },
      { role: "system", content: `Project context:\n${context}` },
      ...history.map((entry) => ({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      })),
    ];

    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: modelMessages,
      maxTokens: 1400,
      temperature: 0.3,
    });

    const assistantMessage =
      response.trim() || "I couldn't generate a response from this context. Please try again.";

    const { data: insertedAssistant, error: assistantInsertError } = await supabase
      .from("ProjectAIChatMessage")
      .insert({
        projectId,
        userId: user.id,
        role: "assistant",
        content: assistantMessage,
      })
      .select("id, role, content, createdAt")
      .single();

    if (assistantInsertError || !insertedAssistant) {
      return NextResponse.json(
        { error: assistantInsertError?.message || "Failed to store response" },
        { status: 500 }
      );
    }

    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/project-chat",
      processingTimeMs: Date.now() - startTime,
      success: true,
      metadata: {
        promptLength: message.length,
        responseLength: assistantMessage.length,
      },
    });

    return NextResponse.json({
      data: insertedAssistant as ChatMessageRow,
    });
  } catch (error) {
    console.error("Project chat error:", error);

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/project-chat",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging failures
    }

    return NextResponse.json({ error: "Failed to send chat message" }, { status: 500 });
  }
}
