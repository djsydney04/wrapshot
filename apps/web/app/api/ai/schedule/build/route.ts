import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import {
  SCHEDULE_PLANNER_PROMPT,
  SCHEDULE_PLANNER_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";
import type { ShootingDay } from "@/lib/types";

interface SchedulePlannerResponse {
  days: Array<{
    dateOffset: number;
    generalCall: string;
    estimatedWrap: string;
    sceneIds: string[];
    notes: string;
  }>;
  unscheduledSceneIds: string[];
  assumptions: string[];
}

interface SceneWithLocation {
  id: string;
  sceneNumber: string;
  synopsis: string | null;
  intExt: string;
  dayNight: string;
  pageCount: number;
  sortOrder: number;
  location: { name: string } | { name: string }[] | null;
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
    const body = (await request.json()) as {
      projectId: string;
      replaceExisting?: boolean;
      maxScenesPerDay?: number;
      startDate?: string;
    };

    const {
      projectId,
      replaceExisting = false,
      maxScenesPerDay = 8,
      startDate,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // 3. Verify project access
    const { data: project, error: projectError } = await supabase
      .from("Project")
      .select("id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // 4. Fetch scenes for the project
    const { data: scenes, error: scenesError } = await supabase
      .from("Scene")
      .select(
        `
        id,
        sceneNumber,
        synopsis,
        intExt,
        dayNight,
        pageCount,
        sortOrder,
        location:Location(name)
      `
      )
      .eq("projectId", projectId)
      .order("sortOrder", { ascending: true });

    if (scenesError) {
      console.error("Error fetching scenes:", scenesError);
      return NextResponse.json(
        { error: "Failed to fetch scenes" },
        { status: 500 }
      );
    }

    if (!scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: "No scenes found for this project" },
        { status: 400 }
      );
    }

    // 5. Format scenes for the AI prompt
    const sceneList = (scenes as SceneWithLocation[])
      .map((s) => {
        let locationName = "Unknown";
        if (s.location) {
          if (Array.isArray(s.location)) {
            locationName = s.location[0]?.name || "Unknown";
          } else {
            locationName = s.location.name || "Unknown";
          }
        }
        return `- ID: ${s.id} | Scene ${s.sceneNumber} | ${s.intExt} ${locationName} - ${s.dayNight} | ${s.pageCount} pages | ${s.synopsis || "No synopsis"}`;
      })
      .join("\n");

    // Determine start date (default to tomorrow if not provided)
    const scheduleStartDate =
      startDate ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 6. Build the user message
    const userMessage = buildPrompt(SCHEDULE_PLANNER_USER_TEMPLATE, {
      projectName: project.name,
      startDate: scheduleStartDate,
      maxScenesPerDay: String(maxScenesPerDay),
      sceneList,
    });

    // 7. Call the AI
    const kimi = new KimiClient();
    const response = await kimi.complete({
      messages: [
        { role: "system", content: SCHEDULE_PLANNER_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 4000,
      temperature: 0.3,
    });

    // 8. Parse the AI response
    const parsed = KimiClient.extractJson<SchedulePlannerResponse>(response);

    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error("Invalid AI response: missing days array");
    }

    // 9. If replaceExisting, delete all existing shooting days for this project
    if (replaceExisting) {
      // First delete all scene associations
      const { data: existingDays } = await supabase
        .from("ShootingDay")
        .select("id")
        .eq("projectId", projectId);

      if (existingDays && existingDays.length > 0) {
        const dayIds = existingDays.map((d) => d.id);

        // Delete scene associations
        await supabase
          .from("ShootingDayScene")
          .delete()
          .in("shootingDayId", dayIds);

        // Delete cast associations
        await supabase
          .from("ShootingDayCast")
          .delete()
          .in("shootingDayId", dayIds);

        // Delete call sheets
        await supabase.from("CallSheet").delete().in("shootingDayId", dayIds);

        // Delete shooting days
        await supabase.from("ShootingDay").delete().eq("projectId", projectId);
      }
    }

    // 10. Create new shooting days based on AI response
    const createdDays: ShootingDay[] = [];
    const validSceneIds = new Set(scenes.map((s) => s.id));
    let scenesAssigned = 0;
    let scenesUnscheduled = 0;

    for (let i = 0; i < parsed.days.length; i++) {
      const dayPlan = parsed.days[i];

      // Calculate the actual date based on offset
      const dayDate = new Date(scheduleStartDate);
      dayDate.setDate(dayDate.getDate() + dayPlan.dateOffset);
      const dateString = dayDate.toISOString().split("T")[0];

      // Filter to only valid scene IDs
      const validDaySceneIds = dayPlan.sceneIds.filter((id) =>
        validSceneIds.has(id)
      );

      // Create the shooting day
      const { data: shootingDay, error: createError } = await supabase
        .from("ShootingDay")
        .insert({
          projectId,
          date: dateString,
          dayNumber: i + 1,
          unit: "MAIN",
          status: "TENTATIVE",
          generalCall: dayPlan.generalCall || "07:00",
          estimatedWrap: dayPlan.estimatedWrap || "19:00",
          notes: dayPlan.notes || null,
          isShootingDay: true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating shooting day:", createError);
        continue;
      }

      // Create call sheet for this shooting day
      await supabase.from("CallSheet").insert({ shootingDayId: shootingDay.id });

      // Create scene associations
      if (validDaySceneIds.length > 0) {
        const sceneInserts = validDaySceneIds.map((sceneId, index) => ({
          shootingDayId: shootingDay.id,
          sceneId,
          sortOrder: index,
        }));

        const { error: scenesInsertError } = await supabase
          .from("ShootingDayScene")
          .insert(sceneInserts);

        if (scenesInsertError) {
          console.error("Error inserting scene associations:", scenesInsertError);
        } else {
          scenesAssigned += validDaySceneIds.length;
        }

        // Update scene status to SCHEDULED
        await supabase
          .from("Scene")
          .update({ status: "SCHEDULED" })
          .in("id", validDaySceneIds);
      }

      // Build the response day object
      createdDays.push({
        id: shootingDay.id,
        projectId: shootingDay.projectId,
        date: shootingDay.date,
        dayNumber: shootingDay.dayNumber,
        unit: shootingDay.unit as "MAIN" | "SECOND",
        status: shootingDay.status as ShootingDay["status"],
        generalCall: shootingDay.generalCall || "07:00",
        wrapTime: shootingDay.estimatedWrap || undefined,
        scenes: validDaySceneIds,
        notes: shootingDay.notes || undefined,
      });
    }

    // Count unscheduled scenes
    const scheduledSceneIds = new Set(createdDays.flatMap((d) => d.scenes));
    scenesUnscheduled = scenes.filter((s) => !scheduledSceneIds.has(s.id)).length;

    // 11. Log the processing
    const processingTime = Date.now() - startTime;
    await supabase.from("AIProcessingLog").insert({
      projectId,
      userId: user.id,
      endpoint: "/api/ai/schedule/build",
      processingTimeMs: processingTime,
      success: true,
      metadata: {
        daysCreated: createdDays.length,
        scenesAssigned,
        scenesUnscheduled,
        replaceExisting,
      },
    });

    // 12. Revalidate paths
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/schedule");

    // 13. Return the response
    return NextResponse.json({
      data: {
        shootingDays: createdDays,
        assumptions: parsed.assumptions || [],
        stats: {
          daysCreated: createdDays.length,
          scenesAssigned,
          scenesUnscheduled,
        },
      },
    });
  } catch (error) {
    console.error("Schedule build error:", error);

    // Log the error
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const body = await request.clone().json().catch(() => ({})) as { projectId?: string };
        await supabase.from("AIProcessingLog").insert({
          projectId: body.projectId || null,
          userId: user.id,
          endpoint: "/api/ai/schedule/build",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build schedule" },
      { status: 500 }
    );
  }
}
