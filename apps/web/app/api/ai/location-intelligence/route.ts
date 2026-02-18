import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { KimiClient } from "@/lib/ai/kimi-client";
import { buildAiCacheKey, getAiCachedResponse, setAiCachedResponse } from "@/lib/ai/cache";
import {
  LOCATION_INTELLIGENCE_PROMPT,
  LOCATION_INTELLIGENCE_USER_TEMPLATE,
  buildPrompt,
} from "@/lib/ai/prompts";

interface LocationContextInput {
  name?: string;
  address?: string | null;
  immediateArea?: string | null;
  locationType?: string;
  interiorExterior?: string;
  permitStatus?: string;
  parkingNotes?: string | null;
  technicalNotes?: string | null;
  soundNotes?: string | null;
}

interface NearbySuggestion {
  category: string;
  suggestion: string;
  whyItHelps: string;
  distanceHint: string;
  searchQuery: string;
  priority: "high" | "medium" | "low";
}

interface PermitGuidance {
  likelyOffice: string;
  applicationPath: string;
  officialWebsite: string;
  leadTime: string;
  notes: string;
}

interface LocationIntelligenceResponse {
  summary: string;
  nearbySuggestions: NearbySuggestion[];
  permitGuidance: PermitGuidance;
  permitChecklist: string[];
  logisticsRisks: string[];
  nextActions: string[];
  confidenceNotes: string[];
}

const LOCATION_INTELLIGENCE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 3;

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeNearbySuggestions(value: unknown): NearbySuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const rawPriority = asText(item.priority, "medium").toLowerCase();
      const priority: NearbySuggestion["priority"] =
        rawPriority === "high" || rawPriority === "low" ? rawPriority : "medium";

      return {
        category: asText(item.category, "General"),
        suggestion: asText(item.suggestion),
        whyItHelps: asText(item.whyItHelps),
        distanceHint: asText(item.distanceHint),
        searchQuery: asText(item.searchQuery),
        priority,
      };
    })
    .filter((item): item is NearbySuggestion => {
      return Boolean(item?.suggestion && item.whyItHelps);
    })
    .slice(0, 8);
}

function sanitizePermitGuidance(value: unknown): PermitGuidance {
  if (!isRecord(value)) {
    return {
      likelyOffice: "",
      applicationPath: "",
      officialWebsite: "",
      leadTime: "",
      notes: "",
    };
  }

  return {
    likelyOffice: asText(value.likelyOffice),
    applicationPath: asText(value.applicationPath),
    officialWebsite: asText(value.officialWebsite),
    leadTime: asText(value.leadTime),
    notes: asText(value.notes),
  };
}

function sanitizeResponse(value: unknown): LocationIntelligenceResponse {
  if (!isRecord(value)) {
    return {
      summary: "",
      nearbySuggestions: [],
      permitGuidance: sanitizePermitGuidance(null),
      permitChecklist: [],
      logisticsRisks: [],
      nextActions: [],
      confidenceNotes: [],
    };
  }

  return {
    summary: asText(value.summary),
    nearbySuggestions: sanitizeNearbySuggestions(value.nearbySuggestions),
    permitGuidance: sanitizePermitGuidance(value.permitGuidance),
    permitChecklist: asStringArray(value.permitChecklist, 10),
    logisticsRisks: asStringArray(value.logisticsRisks, 8),
    nextActions: asStringArray(value.nextActions, 8),
    confidenceNotes: asStringArray(value.confidenceNotes, 6),
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
      projectName?: string;
      locationId?: string;
      location?: LocationContextInput;
      forceRefresh?: boolean;
    };

    const projectId = asText(body.projectId);
    const projectName = asText(body.projectName, "Untitled Project");
    const locationId = asText(body.locationId);
    const location = body.location;
    const forceRefresh = Boolean(body.forceRefresh);

    if (!location || (!location.name && !location.address)) {
      return NextResponse.json(
        { error: "location.name or location.address is required" },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey({
      scope: projectId || user.id,
      projectName,
      locationId: locationId || null,
      location: {
        name: asText(location.name),
        address: asText(location.address),
        immediateArea: asText(location.immediateArea),
        locationType: asText(location.locationType),
        interiorExterior: asText(location.interiorExterior),
        permitStatus: asText(location.permitStatus),
        parkingNotes: asText(location.parkingNotes),
        technicalNotes: asText(location.technicalNotes),
        soundNotes: asText(location.soundNotes),
      },
    });

    if (!forceRefresh) {
      const cached = await getAiCachedResponse<LocationIntelligenceResponse>(supabase, {
        endpoint: "/api/ai/location-intelligence",
        cacheKey,
      });

      if (cached) {
        const processingTimeMs = Date.now() - startTime;
        const metadata: Record<string, unknown> = {
          locationId,
          nearbySuggestionCount: cached.nearbySuggestions.length,
          cacheHit: true,
        };

        const logPayload: Record<string, unknown> = {
          userId: user.id,
          endpoint: "/api/ai/location-intelligence",
          processingTimeMs,
          success: true,
          metadata,
        };

        if (projectId) {
          logPayload.projectId = projectId;
        }

        await supabase.from("AIProcessingLog").insert(logPayload);
        return NextResponse.json({ data: cached, meta: { cached: true } });
      }
    }

    const userMessage = buildPrompt(LOCATION_INTELLIGENCE_USER_TEMPLATE, {
      projectName,
      locationName: asText(location.name, "Unknown location"),
      address: asText(location.address, "Unknown address"),
      immediateArea: asText(location.immediateArea, "Not specified"),
      locationType: asText(location.locationType, "Unknown"),
      intExt: asText(location.interiorExterior, "Unknown"),
      permitStatus: asText(location.permitStatus, "Unknown"),
      parkingNotes: asText(location.parkingNotes, "None"),
      technicalNotes: asText(location.technicalNotes, "None"),
      soundNotes: asText(location.soundNotes, "None"),
    });

    const kimi = new KimiClient();
    const rawResponse = await kimi.complete({
      messages: [
        { role: "system", content: LOCATION_INTELLIGENCE_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 1800,
      temperature: 0.25,
    });

    const parsed = KimiClient.extractJson<unknown>(rawResponse);
    const intelligence = sanitizeResponse(parsed);

    await setAiCachedResponse(supabase, {
      endpoint: "/api/ai/location-intelligence",
      cacheKey,
      projectId: projectId || undefined,
      userId: user.id,
      response: intelligence,
      ttlSeconds: LOCATION_INTELLIGENCE_CACHE_TTL_SECONDS,
    });

    const processingTimeMs = Date.now() - startTime;
    const metadata: Record<string, unknown> = {
      locationId,
      nearbySuggestionCount: intelligence.nearbySuggestions.length,
      cacheHit: false,
    };

    const logPayload: Record<string, unknown> = {
      userId: user.id,
      endpoint: "/api/ai/location-intelligence",
      processingTimeMs,
      success: true,
      metadata,
    };

    if (projectId) {
      logPayload.projectId = projectId;
    }

    await supabase.from("AIProcessingLog").insert(logPayload);

    return NextResponse.json({ data: intelligence, meta: { cached: false } });
  } catch (error) {
    console.error("Location intelligence error:", error);

    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("AIProcessingLog").insert({
          userId: user.id,
          endpoint: "/api/ai/location-intelligence",
          processingTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } catch {
      // Ignore logging failures
    }

    return NextResponse.json(
      { error: "Failed to generate location intelligence" },
      { status: 500 }
    );
  }
}
