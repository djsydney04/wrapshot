"use client";

import * as React from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIIndicator, AILoadingSkeleton } from "@/components/ai/ai-indicator";
import type { Location } from "@/lib/actions/locations";

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

interface LocationIntelligenceData {
  summary: string;
  nearbySuggestions: NearbySuggestion[];
  permitGuidance: PermitGuidance;
  permitChecklist: string[];
  logisticsRisks: string[];
  nextActions: string[];
  confidenceNotes: string[];
}

interface LocationIntelligencePanelProps {
  projectId: string;
  projectName?: string;
  location: Location | null;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function LocationIntelligencePanel({
  projectId,
  projectName,
  location,
}: LocationIntelligencePanelProps) {
  const [resultsByLocation, setResultsByLocation] = React.useState<
    Record<string, LocationIntelligenceData>
  >({});
  const [loadingByLocation, setLoadingByLocation] = React.useState<Record<string, boolean>>({});
  const [errorByLocation, setErrorByLocation] = React.useState<Record<string, string | null>>({});

  const fetchIntelligence = React.useCallback(
    async (targetLocation: Location, force = false) => {
      if (!force && resultsByLocation[targetLocation.id]) return;
      if (loadingByLocation[targetLocation.id]) return;

      setLoadingByLocation((prev) => ({ ...prev, [targetLocation.id]: true }));
      setErrorByLocation((prev) => ({ ...prev, [targetLocation.id]: null }));

      try {
        const response = await fetch("/api/ai/location-intelligence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            projectName,
            locationId: targetLocation.id,
            forceRefresh: force,
            location: {
              name: targetLocation.name,
              address: targetLocation.address,
              immediateArea: targetLocation.immediateArea,
              locationType: targetLocation.locationType,
              interiorExterior: targetLocation.interiorExterior,
              permitStatus: targetLocation.permitStatus,
              parkingNotes: targetLocation.parkingNotes,
              technicalNotes: targetLocation.technicalNotes,
              soundNotes: targetLocation.soundNotes,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate intelligence");
        }

        const payload = (await response.json()) as { data?: LocationIntelligenceData };
        if (!payload.data) {
          throw new Error("No intelligence data returned");
        }
        const data = payload.data;

        setResultsByLocation((prev) => ({ ...prev, [targetLocation.id]: data }));
      } catch (error) {
        setErrorByLocation((prev) => ({
          ...prev,
          [targetLocation.id]:
            error instanceof Error ? error.message : "Failed to generate intelligence",
        }));
      } finally {
        setLoadingByLocation((prev) => ({ ...prev, [targetLocation.id]: false }));
      }
    },
    [loadingByLocation, projectId, projectName, resultsByLocation]
  );

  React.useEffect(() => {
    if (!location) return;
    if (resultsByLocation[location.id]) return;
    void fetchIntelligence(location);
  }, [fetchIntelligence, location, resultsByLocation]);

  if (!location) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <Lightbulb className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <h3 className="mb-1 text-sm font-medium">Location Intelligence</h3>
        <p className="text-sm text-muted-foreground">
          Select a location row to get nearby support ideas and permit guidance.
        </p>
      </div>
    );
  }

  const result = resultsByLocation[location.id];
  const isLoading = Boolean(loadingByLocation[location.id]);
  const error = errorByLocation[location.id];

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between gap-2 border-b border-primary/15 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">Location Intelligence</h3>
            <AIIndicator variant="pill" size="sm" label="Smart" />
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{location.name}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          disabled={isLoading}
          onClick={() => void fetchIntelligence(location, true)}
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {isLoading && !result && <AILoadingSkeleton lines={5} />}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !result && !error && (
          <Button size="sm" className="gap-1.5" onClick={() => void fetchIntelligence(location, true)}>
            <Lightbulb className="h-3.5 w-3.5" />
            Generate Suggestions
          </Button>
        )}

        {result && (
          <>
            {result.summary && (
              <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm">
                {result.summary}
              </div>
            )}

            <section className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nearby Suggestions
              </h4>
              {result.nearbySuggestions.length > 0 ? (
                <div className="space-y-2">
                  {result.nearbySuggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.category}-${index}`}
                      className="rounded-md border border-border bg-background/80 px-3 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{suggestion.suggestion}</p>
                        <Badge variant="secondary">{suggestion.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {suggestion.category}
                        {suggestion.distanceHint ? ` • ${suggestion.distanceHint}` : ""}
                      </p>
                      <p className="mt-1 text-sm">{suggestion.whyItHelps}</p>
                      {suggestion.searchQuery && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Search: {suggestion.searchQuery}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nearby suggestions generated yet.</p>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Permit Guidance
              </h4>
              <div className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm">
                {result.permitGuidance.likelyOffice && (
                  <p>
                    <span className="font-medium">Likely Office:</span> {result.permitGuidance.likelyOffice}
                  </p>
                )}
                {result.permitGuidance.applicationPath && (
                  <p>
                    <span className="font-medium">Start Here:</span>{" "}
                    {result.permitGuidance.applicationPath}
                  </p>
                )}
                {result.permitGuidance.leadTime && (
                  <p>
                    <span className="font-medium">Lead Time:</span> {result.permitGuidance.leadTime}
                  </p>
                )}
                {result.permitGuidance.officialWebsite && (
                  <p className="mt-1">
                    <span className="font-medium">Official Website:</span>{" "}
                    {isHttpUrl(result.permitGuidance.officialWebsite) ? (
                      <a
                        href={result.permitGuidance.officialWebsite}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open link
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      result.permitGuidance.officialWebsite
                    )}
                  </p>
                )}
                {result.permitGuidance.notes && (
                  <p className="mt-1 text-muted-foreground">{result.permitGuidance.notes}</p>
                )}
              </div>
            </section>

            {result.permitChecklist.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Permit Checklist
                </h4>
                <ul className="space-y-1 text-sm">
                  {result.permitChecklist.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-md bg-background/80 px-3 py-1.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.logisticsRisks.length > 0 && (
              <section className="space-y-2">
                <h4 className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Logistics Risks
                </h4>
                <ul className="space-y-1 text-sm">
                  {result.logisticsRisks.map((risk, index) => (
                    <li key={`${risk}-${index}`} className="rounded-md bg-background/80 px-3 py-1.5">
                      {risk}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.nextActions.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next Actions
                </h4>
                <ul className="space-y-1 text-sm">
                  {result.nextActions.map((action, index) => (
                    <li key={`${action}-${index}`} className="rounded-md bg-background/80 px-3 py-1.5">
                      {action}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {result.confidenceNotes.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Verification Notes
                </h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {result.confidenceNotes.map((note, index) => (
                    <li key={`${note}-${index}`} className="rounded-md bg-background/60 px-3 py-1.5">
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
