import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { AGENT_CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { toOpenAITools, TOOL_MAP } from "@/lib/ai/tools/tool-definitions";
import { executeTool, verifyTool } from "@/lib/ai/tools/tool-executor";
import type {
  ToolContext,
  PlannedAction,
  ExecutionResultItem,
  AgentMessageMetadata,
} from "@/lib/ai/tools/types";
import { randomUUID } from "crypto";

const CHAT_HISTORY_LIMIT = 30;
const MAX_TOOL_LOOP_ITERATIONS = 6;

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
    { data: elements },
  ] = await Promise.all([
    supabase
      .from("Project")
      .select("name, description, status, startDate, endDate")
      .eq("id", projectId)
      .single(),
    supabase
      .from("Scene")
      .select("id, sceneNumber, intExt, dayNight, pageCount, status, synopsis, setName")
      .eq("projectId", projectId)
      .order("sortOrder", { ascending: true })
      .limit(200),
    supabase
      .from("Location")
      .select("id, name, address, permitStatus, locationType")
      .eq("projectId", projectId)
      .limit(80),
    supabase
      .from("ShootingDay")
      .select("id, dayNumber, date, status, generalCall, estimatedWrap")
      .eq("projectId", projectId)
      .order("date", { ascending: true })
      .limit(120),
    supabase
      .from("CastMember")
      .select("id, characterName, actorName, workStatus, castNumber")
      .eq("projectId", projectId)
      .limit(120),
    supabase
      .from("CrewMember")
      .select("id, name, role, department")
      .eq("projectId", projectId)
      .limit(160),
    supabase.from("Element").select("id, category, name").eq("projectId", projectId).limit(400),
  ]);

  const lines: string[] = [];
  lines.push(`Project: ${project?.name || "Unknown"} | Status: ${project?.status || "Unknown"}`);
  lines.push(
    `Dates: ${project?.startDate ? String(project.startDate).slice(0, 10) : "N/A"} to ${project?.endDate ? String(project.endDate).slice(0, 10) : "N/A"}`
  );
  lines.push(
    `Counts: ${scenes?.length || 0} scenes, ${shootingDays?.length || 0} shoot days, ${locations?.length || 0} locations, ${castMembers?.length || 0} cast, ${crewMembers?.length || 0} crew, ${elements?.length || 0} elements`
  );

  if (scenes && scenes.length > 0) {
    lines.push("Scenes (id | number | set | INT/EXT | time | pages | status):");
    for (const s of scenes.slice(0, 60)) {
      lines.push(`  ${s.id} | ${s.sceneNumber} | ${s.setName || "-"} | ${s.intExt}/${s.dayNight} | ${s.pageCount ?? 1}pg | ${s.status}`);
    }
    if (scenes.length > 60) lines.push(`  ... +${scenes.length - 60} more`);
  }

  if (castMembers && castMembers.length > 0) {
    lines.push("Cast (id | character | actor | status):");
    for (const c of castMembers) {
      lines.push(`  ${c.id} | ${c.characterName} | ${c.actorName || "-"} | ${c.workStatus}`);
    }
  }

  if (locations && locations.length > 0) {
    lines.push("Locations (id | name | type | permit):");
    for (const l of locations) {
      lines.push(`  ${l.id} | ${l.name} | ${l.locationType || "-"} | ${l.permitStatus}`);
    }
  }

  if (shootingDays && shootingDays.length > 0) {
    lines.push("Shooting Days (id | day# | date | call | wrap | status):");
    for (const d of shootingDays) {
      lines.push(`  ${d.id} | Day ${d.dayNumber} | ${String(d.date).slice(0, 10)} | ${d.generalCall || "-"} | ${d.estimatedWrap || "-"} | ${d.status}`);
    }
  }

  if (crewMembers && crewMembers.length > 0) {
    lines.push("Crew (id | name | role | dept):");
    for (const cr of crewMembers.slice(0, 40)) {
      lines.push(`  ${cr.id} | ${cr.name} | ${cr.role} | ${cr.department}`);
    }
    if (crewMembers.length > 40) lines.push(`  ... +${crewMembers.length - 40} more`);
  }

  if (elements && elements.length > 0) {
    const grouped = new Map<string, number>();
    for (const e of elements) {
      grouped.set(e.category, (grouped.get(e.category) || 0) + 1);
    }
    lines.push("Elements by category:");
    for (const [cat, count] of Array.from(grouped.entries()).sort()) {
      lines.push(`  ${cat}: ${count}`);
    }
  }

  return lines.join("\n");
}

// Use a generic message type compatible with KimiMessage
type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

// Helper to safely extract function info from a tool call
function getToolCallFn(tc: any): { id: string; name: string; arguments: string } {
  return {
    id: tc.id,
    name: tc.function?.name ?? tc.name ?? "",
    arguments: tc.function?.arguments ?? "{}",
  };
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

    const body = (await request.json()) as {
      projectId?: string;
      message?: string;
      confirmationId?: string;
      approved?: boolean;
    };

    const projectId = body.projectId;
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const access = await ensureProjectAccess(projectId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const toolCtx: ToolContext = { projectId, userId: user.id };

    // ── Mode B: Confirmation response ──────────────────────────────
    if (body.confirmationId) {
      return handleConfirmation(supabase, body, toolCtx, startTime);
    }

    // ── Mode A: New message ────────────────────────────────────────
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "Message too long (max 4000 chars)" }, { status: 400 });
    }

    // Save user message
    await supabase.from("ProjectAIChatMessage").insert({
      projectId,
      userId: user.id,
      role: "user",
      content: message,
    });

    // Fetch history + context
    const [{ data: historyRows }, context] = await Promise.all([
      supabase
        .from("ProjectAIChatMessage")
        .select("role, content, metadata")
        .eq("projectId", projectId)
        .eq("userId", user.id)
        .order("createdAt", { ascending: false })
        .limit(CHAT_HISTORY_LIMIT),
      buildProjectContext(projectId),
    ]);

    const history = [...(historyRows || [])].reverse();

    // Build LLM messages
    const llmMessages: LLMMessage[] = [
      { role: "system", content: AGENT_CHAT_SYSTEM_PROMPT },
      { role: "system", content: `Current project context:\n${context}` },
    ];

    for (const entry of history) {
      llmMessages.push({
        role: entry.role as "user" | "assistant",
        content: entry.content,
      });
    }

    // Agentic tool loop
    const kimi = new KimiClient();
    const tools = toOpenAITools();

    for (let iteration = 0; iteration < MAX_TOOL_LOOP_ITERATIONS; iteration++) {
      const completion = await kimi.completeWithTools({
        messages: llmMessages,
        tools,
        maxTokens: 2000,
        temperature: 0.3,
      });

      const choice = completion.choices?.[0];
      if (!choice) break;

      const assistantMsg = choice.message;
      const toolCalls = assistantMsg.tool_calls;

      // No tool calls -- just a text response
      if (!toolCalls || toolCalls.length === 0) {
        const content =
          assistantMsg.content?.trim() ||
          "I couldn't generate a response. Please try again.";

        const { data: saved } = await supabase
          .from("ProjectAIChatMessage")
          .insert({
            projectId,
            userId: user.id,
            role: "assistant",
            content,
          })
          .select("id, role, content, createdAt, metadata")
          .single();

        await logProcessing(supabase, user.id, projectId, startTime, true);

        return NextResponse.json({ data: saved });
      }

      // Parse tool calls through our helper
      const parsedToolCalls = toolCalls.map(getToolCallFn);

      // Check tool tiers
      const allRead = parsedToolCalls.every((tc) => {
        const tool = TOOL_MAP.get(tc.name);
        return tool?.tier === "read";
      });

      if (allRead) {
        // Auto-execute read tools, append results, loop
        llmMessages.push({
          role: "assistant",
          content: assistantMsg.content || "",
          tool_calls: parsedToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        for (const tc of parsedToolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments || "{}");
          } catch {
            // empty
          }

          const result = await executeTool(tc.name, args, toolCtx);

          // Summarize data to avoid overloading context
          const resultStr = result.success
            ? JSON.stringify(result.data, null, 0).slice(0, 3000)
            : `Error: ${result.error}`;

          llmMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultStr,
          });
        }

        continue; // loop back for the next LLM call
      }

      // Mutating/destructive tool calls -- request confirmation
      const confirmationId = randomUUID();
      const actions: PlannedAction[] = parsedToolCalls.map((tc) => {
        const tool = TOOL_MAP.get(tc.name);
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments || "{}");
        } catch {
          // empty
        }
        return {
          toolName: tc.name,
          args: parsedArgs,
          tier: tool?.tier || "mutate",
          description: buildActionDescription(tc.name, parsedArgs),
        };
      });

      const metadata: AgentMessageMetadata = {
        type: "tool_confirmation_request",
        confirmationId,
        actions,
        toolCallsRaw: parsedToolCalls.map((tc) => ({
          id: tc.id,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };

      const confirmContent =
        assistantMsg.content ||
        `I'd like to perform ${actions.length} action(s). Please review and approve.`;

      const { data: saved } = await supabase
        .from("ProjectAIChatMessage")
        .insert({
          projectId,
          userId: user.id,
          role: "assistant",
          content: confirmContent,
          metadata,
        })
        .select("id, role, content, createdAt, metadata")
        .single();

      await logProcessing(supabase, user.id, projectId, startTime, true);

      return NextResponse.json({
        data: saved,
        status: "pending_confirmation",
        confirmationId,
      });
    }

    // Max iterations reached
    const fallbackContent = "I ran into the tool call limit. Could you break your request into smaller steps?";
    const { data: saved } = await supabase
      .from("ProjectAIChatMessage")
      .insert({ projectId, userId: user.id, role: "assistant", content: fallbackContent })
      .select("id, role, content, createdAt, metadata")
      .single();

    return NextResponse.json({ data: saved });
  } catch (error) {
    console.error("Agent chat error:", error);

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await logProcessing(supabase, user.id, undefined, startTime, false, error);
      }
    } catch {
      // Ignore logging failures
    }

    return NextResponse.json({ error: "Failed to process agent message" }, { status: 500 });
  }
}

// ── Confirmation handler ────────────────────────────────────────────────

async function handleConfirmation(
  supabase: any,
  body: { projectId?: string; confirmationId?: string; approved?: boolean },
  toolCtx: ToolContext,
  startTime: number,
) {
  const { projectId, confirmationId, approved } = body;

  // Find the message with this confirmationId
  const { data: pendingMessages } = await supabase
    .from("ProjectAIChatMessage")
    .select("id, content, metadata")
    .eq("projectId", projectId)
    .eq("userId", toolCtx.userId)
    .order("createdAt", { ascending: false })
    .limit(10);

  const pendingMsg = (pendingMessages || []).find(
    (m: any) =>
      m.metadata?.confirmationId === confirmationId &&
      m.metadata?.type === "tool_confirmation_request"
  );

  if (!pendingMsg) {
    return NextResponse.json({ error: "Confirmation not found" }, { status: 404 });
  }

  const meta = pendingMsg.metadata as AgentMessageMetadata;

  if (approved !== true) {
    // User declined (or approved was not explicitly true)
    const declineContent = "Understood, I won't make those changes. What would you like to do instead?";
    const { data: saved } = await supabase
      .from("ProjectAIChatMessage")
      .insert({
        projectId,
        userId: toolCtx.userId,
        role: "assistant",
        content: declineContent,
        metadata: { type: "confirmation_declined", confirmationId },
      })
      .select("id, role, content, createdAt, metadata")
      .single();

    return NextResponse.json({ data: saved });
  }

  // User approved -- execute all planned actions
  const actions = meta.actions || [];
  const results: ExecutionResultItem[] = [];

  for (const action of actions) {
    const result = await executeTool(action.toolName, action.args, toolCtx);
    const verification = await verifyTool(action.toolName, action.args, result, toolCtx);
    results.push({
      toolName: action.toolName,
      args: action.args,
      result,
      verification: verification || undefined,
    });
  }

  // Build summary via LLM
  const summaryLines: string[] = [];
  for (const r of results) {
    const status = r.result.success ? "OK" : "FAILED";
    const verifyStatus = r.verification
      ? r.verification.verified
        ? "verified"
        : `issues: ${r.verification.discrepancies.join(", ")}`
      : "no verification";
    summaryLines.push(`- ${r.toolName}(${JSON.stringify(r.args).slice(0, 100)}): ${status} [${verifyStatus}]`);
  }

  const kimi = new KimiClient();
  const summaryResponse = await kimi.complete({
    messages: [
      {
        role: "system",
        content: "Summarize the following tool execution results in a concise, human-readable way. Report successes and any issues.",
      },
      {
        role: "user",
        content: `Tool execution results:\n${summaryLines.join("\n")}`,
      },
    ],
    maxTokens: 500,
    temperature: 0.2,
  });

  const resultMeta: AgentMessageMetadata = {
    type: "tool_execution_result",
    confirmationId,
    results,
  };

  const { data: saved } = await supabase
    .from("ProjectAIChatMessage")
    .insert({
      projectId,
      userId: toolCtx.userId,
      role: "assistant",
      content: summaryResponse,
      metadata: resultMeta,
    })
    .select("id, role, content, createdAt, metadata")
    .single();

  await logProcessing(supabase, toolCtx.userId, projectId, startTime, true);

  return NextResponse.json({ data: saved });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildActionDescription(
  toolName: string,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case "create_scene":
      return `Create scene ${args.sceneNumber || "?"}${args.setName ? ` - ${args.intExt || ""}. ${args.setName} - ${args.dayNight || ""}` : ""}`;
    case "update_scene":
      return `Update scene (${args.sceneId})`;
    case "delete_scene":
      return `Delete scene (${args.sceneId})`;
    case "create_cast_member":
      return `Create cast member: ${args.characterName || "?"}`;
    case "update_cast_member":
      return `Update cast member (${args.castMemberId})`;
    case "delete_cast_member":
      return `Delete cast member (${args.castMemberId})`;
    case "create_location":
      return `Create location: ${args.name || "?"}`;
    case "update_location":
      return `Update location (${args.locationId})`;
    case "delete_location":
      return `Delete location (${args.locationId})`;
    case "create_element":
      return `Create element: ${args.name || "?"} (${args.category || "?"})`;
    case "delete_element":
      return `Delete element (${args.elementId})`;
    case "create_shooting_day":
      return `Create shooting day ${args.dayNumber || "?"} on ${args.date || "?"}`;
    case "update_shooting_day":
      return `Update shooting day (${args.shootingDayId})`;
    case "delete_shooting_day":
      return `Delete shooting day (${args.shootingDayId})`;
    case "assign_scene_to_day":
      return `Assign scene to shooting day`;
    case "add_cast_to_scene":
      return `Link cast member to scene`;
    case "create_crew_member":
      return `Add crew member: ${args.name || "?"} (${args.role || "?"})`;
    default:
      return toolName;
  }
}

async function logProcessing(
  supabase: any,
  userId: string | undefined,
  projectId: string | undefined,
  startTime: number,
  success: boolean,
  error?: unknown
) {
  if (!userId) return;
  try {
    await supabase.from("AIProcessingLog").insert({
      projectId: projectId || null,
      userId,
      endpoint: "/api/ai/project-chat-agent",
      processingTimeMs: Date.now() - startTime,
      success,
      ...(error ? { errorMessage: error instanceof Error ? error.message : "Unknown" } : {}),
    });
  } catch {
    // Ignore
  }
}
