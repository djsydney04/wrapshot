/**
 * All tool definitions for the agentic assistant.
 * Each tool maps to an existing server action.
 */

import type { ToolDefinition } from "./types";

/** Safe optional arg: returns undefined only when the arg was not provided (undefined). */
function opt<T>(value: unknown): T | undefined {
  return value !== undefined ? (value as T) : undefined;
}

// ── Read Tools ──────────────────────────────────────────────────────────

const getScenes: ToolDefinition = {
  name: "get_scenes",
  description: "Get all scenes for the project. Returns scene numbers, locations, INT/EXT, day/night, page counts, status, and synopsis.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getScenes } = await import("@/lib/actions/scenes");
    const result = await getScenes(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const getCast: ToolDefinition = {
  name: "get_cast",
  description: "Get all cast members for the project. Returns character names, actor names, work status, and cast numbers.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getCastMembers } = await import("@/lib/actions/cast");
    const result = await getCastMembers(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const getLocations: ToolDefinition = {
  name: "get_locations",
  description: "Get all locations for the project. Returns names, addresses, permit status, and location type.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getLocations } = await import("@/lib/actions/locations");
    const result = await getLocations(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const getShootingDays: ToolDefinition = {
  name: "get_shooting_days",
  description: "Get all shooting days for the project. Returns dates, day numbers, call/wrap times, status, and assigned scenes.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getShootingDays } = await import("@/lib/actions/shooting-days");
    const result = await getShootingDays(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const getElements: ToolDefinition = {
  name: "get_elements",
  description: "Get all production elements (props, wardrobe, vehicles, etc.) for the project.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getElements } = await import("@/lib/actions/elements");
    const result = await getElements(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const getCrew: ToolDefinition = {
  name: "get_crew",
  description: "Get all crew members for the project. Returns names, roles, and departments.",
  tier: "read",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, ctx) {
    const { getCrewMembers } = await import("@/lib/actions/crew");
    const result = await getCrewMembers(ctx.projectId);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

// ── Mutate Tools ────────────────────────────────────────────────────────

const createScene: ToolDefinition = {
  name: "create_scene",
  description: "Create a new scene in the project.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      sceneNumber: { type: "string", description: "Scene number (e.g. '15', '2A')" },
      intExt: { type: "string", enum: ["INT", "EXT", "BOTH"], description: "Interior or exterior" },
      dayNight: { type: "string", enum: ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "AFTERNOON", "EVENING"], description: "Time of day" },
      setName: { type: "string", description: "Set/location name from the scene heading" },
      synopsis: { type: "string", description: "Brief description of what happens" },
      pageCount: { type: "number", description: "Page count (e.g. 1.5)" },
      locationId: { type: "string", description: "ID of an existing location to link" },
      scriptDay: { type: "string", description: "Script day number" },
      estimatedMinutes: { type: "number", description: "Estimated filming time in minutes" },
      notes: { type: "string", description: "Additional notes" },
    },
    required: ["sceneNumber"],
  },
  async execute(args, ctx) {
    const { createScene } = await import("@/lib/actions/scenes");
    const result = await createScene({
      projectId: ctx.projectId,
      sceneNumber: args.sceneNumber as string,
      intExt: opt<"INT" | "EXT" | "BOTH">(args.intExt),
      dayNight: opt<any>(args.dayNight),
      setName: opt<string>(args.setName),
      synopsis: opt<string>(args.synopsis),
      pageCount: opt<number>(args.pageCount),
      locationId: opt<string>(args.locationId),
      scriptDay: opt<string>(args.scriptDay),
      estimatedMinutes: opt<number>(args.estimatedMinutes),
      notes: opt<string>(args.notes),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success || !result.data) {
      return { verified: false, expected: "Scene created", actual: "Creation failed", discrepancies: [result.error || "No data returned"] };
    }
    const scene = result.data as { id: string; sceneNumber: string; intExt?: string; setName?: string };
    const issues: string[] = [];
    if (scene.sceneNumber !== args.sceneNumber) {
      issues.push(`sceneNumber: expected "${args.sceneNumber}", got "${scene.sceneNumber}"`);
    }
    if (args.intExt && scene.intExt !== args.intExt) {
      issues.push(`intExt: expected "${args.intExt}", got "${scene.intExt}"`);
    }
    return {
      verified: issues.length === 0,
      expected: `Scene ${args.sceneNumber} created`,
      actual: issues.length === 0 ? `Scene ${scene.sceneNumber} created with id ${scene.id}` : issues.join("; "),
      discrepancies: issues,
    };
  },
};

const updateScene: ToolDefinition = {
  name: "update_scene",
  description: "Update an existing scene. Provide the scene ID and only the fields to change.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      sceneId: { type: "string", description: "ID of the scene to update" },
      sceneNumber: { type: "string" },
      intExt: { type: "string", enum: ["INT", "EXT", "BOTH"] },
      dayNight: { type: "string", enum: ["DAY", "NIGHT", "DAWN", "DUSK", "MORNING", "AFTERNOON", "EVENING"] },
      setName: { type: "string" },
      synopsis: { type: "string" },
      pageCount: { type: "number" },
      locationId: { type: "string" },
      scriptDay: { type: "string" },
      estimatedMinutes: { type: "number" },
      notes: { type: "string" },
      status: { type: "string", enum: ["NOT_SCHEDULED", "SCHEDULED", "PARTIALLY_SHOT", "COMPLETED", "CUT"] },
    },
    required: ["sceneId"],
  },
  async execute(args, _ctx) {
    const { updateScene } = await import("@/lib/actions/scenes");
    const { sceneId, ...updates } = args;
    const result = await updateScene(sceneId as string, updates as any);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success) return { verified: false, expected: "Scene updated", actual: "Update failed", discrepancies: [result.error || "Unknown"] };
    const scene = result.data as Record<string, unknown>;
    const issues: string[] = [];
    for (const key of ["sceneNumber", "intExt", "dayNight", "setName", "synopsis"] as const) {
      if (args[key] !== undefined && scene[key] !== args[key]) {
        issues.push(`${key}: expected "${args[key]}", got "${scene[key]}"`);
      }
    }
    return { verified: issues.length === 0, expected: "Fields match", actual: issues.length ? issues.join("; ") : "All fields match", discrepancies: issues };
  },
};

const createCastMember: ToolDefinition = {
  name: "create_cast_member",
  description: "Create a new cast member (character) in the project.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      characterName: { type: "string", description: "Character name" },
      actorName: { type: "string", description: "Actor's real name" },
      castNumber: { type: "number", description: "Cast number for scheduling" },
      workStatus: { type: "string", enum: ["ON_HOLD", "CONFIRMED", "WORKING", "WRAPPED", "DROPPED"] },
      notes: { type: "string" },
    },
    required: ["characterName"],
  },
  async execute(args, ctx) {
    const { createCastMember } = await import("@/lib/actions/cast");
    const result = await createCastMember({
      projectId: ctx.projectId,
      characterName: args.characterName as string,
      actorName: opt<string>(args.actorName),
      castNumber: opt<number>(args.castNumber),
      workStatus: opt<any>(args.workStatus),
      notes: opt<string>(args.notes),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success) return { verified: false, expected: "Cast member created", actual: "Failed", discrepancies: [result.error || "Unknown"] };
    const cast = result.data as { characterName: string };
    const issues: string[] = [];
    if (cast.characterName !== args.characterName) issues.push(`characterName mismatch`);
    return { verified: issues.length === 0, expected: `Created ${args.characterName}`, actual: `Created ${cast.characterName}`, discrepancies: issues };
  },
};

const updateCastMember: ToolDefinition = {
  name: "update_cast_member",
  description: "Update an existing cast member.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      castMemberId: { type: "string", description: "ID of the cast member" },
      characterName: { type: "string" },
      actorName: { type: "string" },
      castNumber: { type: "number" },
      workStatus: { type: "string", enum: ["ON_HOLD", "CONFIRMED", "WORKING", "WRAPPED", "DROPPED"] },
      notes: { type: "string" },
    },
    required: ["castMemberId"],
  },
  async execute(args, _ctx) {
    const { updateCastMember } = await import("@/lib/actions/cast");
    const { castMemberId, ...updates } = args;
    const result = await updateCastMember(castMemberId as string, updates as any);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const createLocation: ToolDefinition = {
  name: "create_location",
  description: "Create a new filming location.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Location name" },
      address: { type: "string", description: "Physical address" },
      locationType: { type: "string", enum: ["PRACTICAL", "STUDIO", "BACKLOT", "VIRTUAL"] },
      interiorExterior: { type: "string", enum: ["INT", "EXT", "BOTH"] },
      permitStatus: { type: "string", enum: ["NOT_STARTED", "APPLIED", "APPROVED", "DENIED"] },
      contactName: { type: "string" },
      contactPhone: { type: "string" },
      contactEmail: { type: "string" },
      technicalNotes: { type: "string" },
      parkingNotes: { type: "string" },
      soundNotes: { type: "string" },
    },
    required: ["name"],
  },
  async execute(args, ctx) {
    const { createLocation } = await import("@/lib/actions/locations");
    const result = await createLocation({
      projectId: ctx.projectId,
      name: args.name as string,
      address: opt<string>(args.address),
      locationType: opt<any>(args.locationType),
      interiorExterior: opt<any>(args.interiorExterior),
      permitStatus: opt<any>(args.permitStatus),
      contactName: opt<string>(args.contactName),
      contactPhone: opt<string>(args.contactPhone),
      contactEmail: opt<string>(args.contactEmail),
      technicalNotes: opt<string>(args.technicalNotes),
      parkingNotes: opt<string>(args.parkingNotes),
      soundNotes: opt<string>(args.soundNotes),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success) return { verified: false, expected: "Location created", actual: "Failed", discrepancies: [result.error || "Unknown"] };
    const loc = result.data as { name: string };
    const issues: string[] = [];
    if (loc.name !== args.name) issues.push(`name mismatch`);
    return { verified: issues.length === 0, expected: `Created ${args.name}`, actual: `Created ${loc.name}`, discrepancies: issues };
  },
};

const updateLocation: ToolDefinition = {
  name: "update_location",
  description: "Update an existing location.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      locationId: { type: "string", description: "ID of the location" },
      name: { type: "string" },
      address: { type: "string" },
      locationType: { type: "string", enum: ["PRACTICAL", "STUDIO", "BACKLOT", "VIRTUAL"] },
      interiorExterior: { type: "string", enum: ["INT", "EXT", "BOTH"] },
      permitStatus: { type: "string", enum: ["NOT_STARTED", "APPLIED", "APPROVED", "DENIED"] },
      contactName: { type: "string" },
      technicalNotes: { type: "string" },
      parkingNotes: { type: "string" },
      soundNotes: { type: "string" },
    },
    required: ["locationId"],
  },
  async execute(args, _ctx) {
    const { updateLocation } = await import("@/lib/actions/locations");
    const { locationId, ...updates } = args;
    const result = await updateLocation(locationId as string, updates as any);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const createElement: ToolDefinition = {
  name: "create_element",
  description: "Create a new production element (prop, wardrobe item, vehicle, etc.).",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Element category",
        enum: ["PROP", "WARDROBE", "VEHICLE", "ANIMAL", "VFX", "SFX", "MAKEUP", "HAIR", "SET_DRESSING", "GREENERY", "CAMERA", "SOUND", "BACKGROUND", "STUNT", "MECHANICAL_EFFECTS", "VIDEO_PLAYBACK"],
      },
      name: { type: "string", description: "Element name" },
      description: { type: "string" },
      notes: { type: "string" },
    },
    required: ["category", "name"],
  },
  async execute(args, ctx) {
    const { createElement } = await import("@/lib/actions/elements");
    const result = await createElement({
      projectId: ctx.projectId,
      category: args.category as any,
      name: args.name as string,
      description: opt<string>(args.description),
      notes: opt<string>(args.notes),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success) return { verified: false, expected: "Element created", actual: "Failed", discrepancies: [result.error || "Unknown"] };
    const el = result.data as { name: string; category: string };
    const issues: string[] = [];
    if (el.name !== args.name) issues.push(`name mismatch`);
    if (el.category !== args.category) issues.push(`category: expected "${args.category}", got "${el.category}"`);
    return { verified: issues.length === 0, expected: `Created ${args.name}`, actual: `Created ${el.name} (${el.category})`, discrepancies: issues };
  },
};

const createShootingDay: ToolDefinition = {
  name: "create_shooting_day",
  description: "Create a new shooting day in the schedule.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format" },
      dayNumber: { type: "number", description: "Day number (e.g. 1, 2, 3)" },
      generalCall: { type: "string", description: "General crew call time (HH:MM)" },
      estimatedWrap: { type: "string", description: "Estimated wrap time (HH:MM)" },
      status: { type: "string", enum: ["TENTATIVE", "SCHEDULED", "CONFIRMED"] },
      notes: { type: "string" },
      scenes: { type: "array", items: { type: "string" }, description: "Array of scene IDs to assign" },
    },
    required: ["date", "dayNumber"],
  },
  async execute(args, ctx) {
    const { createShootingDay } = await import("@/lib/actions/shooting-days");
    const result = await createShootingDay({
      projectId: ctx.projectId,
      date: args.date as string,
      dayNumber: args.dayNumber as number,
      generalCall: opt<string>(args.generalCall),
      estimatedWrap: opt<string>(args.estimatedWrap),
      status: opt<any>(args.status),
      notes: opt<string>(args.notes),
      scenes: opt<string[]>(args.scenes),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
  async verify(args, result, _ctx) {
    if (!result.success) return { verified: false, expected: "Shooting day created", actual: "Failed", discrepancies: [result.error || "Unknown"] };
    const day = result.data as { dayNumber: number; date: string };
    const issues: string[] = [];
    if (day.dayNumber !== args.dayNumber) issues.push(`dayNumber mismatch`);
    return { verified: issues.length === 0, expected: `Day ${args.dayNumber}`, actual: `Day ${day.dayNumber} on ${day.date}`, discrepancies: issues };
  },
};

const updateShootingDay: ToolDefinition = {
  name: "update_shooting_day",
  description: "Update an existing shooting day.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      shootingDayId: { type: "string", description: "ID of the shooting day" },
      date: { type: "string" },
      dayNumber: { type: "number" },
      generalCall: { type: "string" },
      estimatedWrap: { type: "string" },
      status: { type: "string", enum: ["TENTATIVE", "SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] },
      notes: { type: "string" },
    },
    required: ["shootingDayId"],
  },
  async execute(args, _ctx) {
    const { updateShootingDay } = await import("@/lib/actions/shooting-days");
    const { shootingDayId, ...updates } = args;
    const result = await updateShootingDay(shootingDayId as string, updates as any);
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

const assignSceneToDay: ToolDefinition = {
  name: "assign_scene_to_day",
  description: "Assign a scene to a shooting day at a given position.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      sceneId: { type: "string", description: "ID of the scene" },
      shootingDayId: { type: "string", description: "ID of the shooting day" },
      position: { type: "number", description: "Sort position (0-based)" },
    },
    required: ["sceneId", "shootingDayId"],
  },
  async execute(args, ctx) {
    const { assignSceneToShootingDay } = await import("@/lib/actions/scenes");
    const result = await assignSceneToShootingDay(
      args.sceneId as string,
      args.shootingDayId as string,
      (args.position as number) ?? 0,
      ctx.projectId
    );
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { assigned: true } };
  },
};

const addCastToScene: ToolDefinition = {
  name: "add_cast_to_scene",
  description: "Link a cast member to a scene.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      sceneId: { type: "string", description: "ID of the scene" },
      castMemberId: { type: "string", description: "ID of the cast member" },
    },
    required: ["sceneId", "castMemberId"],
  },
  async execute(args, ctx) {
    const { addCastToScene } = await import("@/lib/actions/scenes");
    const result = await addCastToScene(
      args.sceneId as string,
      args.castMemberId as string,
      ctx.projectId
    );
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { linked: true } };
  },
};

const createCrewMember: ToolDefinition = {
  name: "create_crew_member",
  description: "Add a new crew member to the project.",
  tier: "mutate",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Person's name" },
      role: { type: "string", description: "Job title (e.g. 'Gaffer', 'Script Supervisor')" },
      department: {
        type: "string",
        enum: ["PRODUCTION", "DIRECTION", "CAMERA", "SOUND", "LIGHTING", "ART", "COSTUME", "HAIR_MAKEUP", "LOCATIONS", "STUNTS", "VFX", "TRANSPORTATION", "CATERING", "ACCOUNTING", "POST_PRODUCTION"],
        description: "Department",
      },
      email: { type: "string" },
      phone: { type: "string" },
      isHead: { type: "boolean", description: "Whether this person is a department head" },
    },
    required: ["name", "role", "department"],
  },
  async execute(args, ctx) {
    const { createCrewMember } = await import("@/lib/actions/crew");
    const result = await createCrewMember({
      projectId: ctx.projectId,
      name: args.name as string,
      role: args.role as string,
      department: args.department as any,
      email: opt<string>(args.email),
      phone: opt<string>(args.phone),
      isHead: opt<boolean>(args.isHead),
    });
    if (result.error) return { success: false, error: result.error };
    return { success: true, data: result.data };
  },
};

// ── Destructive Tools ───────────────────────────────────────────────────

const deleteScene: ToolDefinition = {
  name: "delete_scene",
  description: "Permanently delete a scene from the project.",
  tier: "destructive",
  parameters: {
    type: "object",
    properties: {
      sceneId: { type: "string", description: "ID of the scene to delete" },
    },
    required: ["sceneId"],
  },
  async execute(args, ctx) {
    const { deleteScene } = await import("@/lib/actions/scenes");
    const result = await deleteScene(args.sceneId as string, ctx.projectId);
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { deleted: true } };
  },
};

const deleteCastMember: ToolDefinition = {
  name: "delete_cast_member",
  description: "Permanently delete a cast member from the project.",
  tier: "destructive",
  parameters: {
    type: "object",
    properties: {
      castMemberId: { type: "string", description: "ID of the cast member to delete" },
    },
    required: ["castMemberId"],
  },
  async execute(args, ctx) {
    const { deleteCastMember } = await import("@/lib/actions/cast");
    const result = await deleteCastMember(args.castMemberId as string, ctx.projectId);
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { deleted: true } };
  },
};

const deleteLocation: ToolDefinition = {
  name: "delete_location",
  description: "Permanently delete a location from the project.",
  tier: "destructive",
  parameters: {
    type: "object",
    properties: {
      locationId: { type: "string", description: "ID of the location to delete" },
    },
    required: ["locationId"],
  },
  async execute(args, ctx) {
    const { deleteLocation } = await import("@/lib/actions/locations");
    const result = await deleteLocation(args.locationId as string, ctx.projectId);
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { deleted: true } };
  },
};

const deleteShootingDay: ToolDefinition = {
  name: "delete_shooting_day",
  description: "Permanently delete a shooting day from the schedule.",
  tier: "destructive",
  parameters: {
    type: "object",
    properties: {
      shootingDayId: { type: "string", description: "ID of the shooting day to delete" },
    },
    required: ["shootingDayId"],
  },
  async execute(args, ctx) {
    const { deleteShootingDay } = await import("@/lib/actions/shooting-days");
    const result = await deleteShootingDay(args.shootingDayId as string, ctx.projectId);
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { deleted: true } };
  },
};

const deleteElement: ToolDefinition = {
  name: "delete_element",
  description: "Permanently delete a production element.",
  tier: "destructive",
  parameters: {
    type: "object",
    properties: {
      elementId: { type: "string", description: "ID of the element to delete" },
    },
    required: ["elementId"],
  },
  async execute(args, ctx) {
    const { deleteElement } = await import("@/lib/actions/elements");
    const result = await deleteElement(args.elementId as string, ctx.projectId);
    if (!result.success) return { success: false, error: result.error || "Failed" };
    return { success: true, data: { deleted: true } };
  },
};

// ── Registry ────────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  // read
  getScenes,
  getCast,
  getLocations,
  getShootingDays,
  getElements,
  getCrew,
  // mutate
  createScene,
  updateScene,
  createCastMember,
  updateCastMember,
  createLocation,
  updateLocation,
  createElement,
  createShootingDay,
  updateShootingDay,
  assignSceneToDay,
  addCastToScene,
  createCrewMember,
  // destructive
  deleteScene,
  deleteCastMember,
  deleteLocation,
  deleteShootingDay,
  deleteElement,
];

export const TOOL_MAP = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/**
 * Convert tool definitions to the OpenAI function-calling format.
 */
export function toOpenAITools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return ALL_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
