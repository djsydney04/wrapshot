"use client";

import * as React from "react";
import { format } from "date-fns";
import { ClipboardList, ArrowLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHasFeature } from "@/lib/hooks/use-tiers";
import { getCallSheetsForProject } from "@/lib/actions/call-sheets";
import { CallSheetEditor } from "@/components/callsheets/call-sheet-editor";
import type { ShootingDay } from "@/lib/types";
import type { Scene as DBScene } from "@/lib/actions/scenes";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";

interface CallSheetsSectionProps {
  projectId: string;
  shootingDays: ShootingDay[];
  scenes: DBScene[];
  cast: CastMemberWithInviteStatus[];
  crew: CrewMemberWithInviteStatus[];
}

interface CallSheetStatus {
  shootingDayId: string;
  status: "none" | "draft" | "published";
  version?: number;
}

export function CallSheetsSection({
  projectId,
  shootingDays,
  scenes,
  cast,
  crew,
}: CallSheetsSectionProps) {
  const hasFeature = useHasFeature("hasCallSheetGeneration");
  const [selectedShootingDayId, setSelectedShootingDayId] = React.useState<string | null>(null);
  const [callSheetStatuses, setCallSheetStatuses] = React.useState<Map<string, CallSheetStatus>>(new Map());
  const [loading, setLoading] = React.useState(true);

  // Fetch call sheet statuses
  React.useEffect(() => {
    async function fetchStatuses() {
      setLoading(true);
      const { data } = await getCallSheetsForProject(projectId);
      const statusMap = new Map<string, CallSheetStatus>();

      // Initialize all shooting days as "none"
      for (const sd of shootingDays) {
        statusMap.set(sd.id, { shootingDayId: sd.id, status: "none" });
      }

      // Update with actual call sheet data
      if (data) {
        for (const cs of data) {
          statusMap.set(cs.shootingDayId, {
            shootingDayId: cs.shootingDayId,
            status: cs.publishedAt ? "published" : "draft",
            version: cs.version,
          });
        }
      }

      setCallSheetStatuses(statusMap);
      setLoading(false);
    }
    fetchStatuses();
  }, [projectId, shootingDays]);

  // Feature gate
  if (!hasFeature) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Call Sheets</h2>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-6 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-amber-600 dark:text-amber-400 mb-3" />
          <h3 className="font-medium text-amber-900 dark:text-amber-200 mb-1">
            Call Sheet Generation
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
            Generate professional call sheets, download PDFs, and email them to your cast & crew.
            Upgrade to Pro or Studio to unlock this feature.
          </p>
          <Button variant="outline" onClick={() => window.open("/settings/billing", "_blank")}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  // Editor view for selected shooting day
  if (selectedShootingDayId) {
    const shootingDay = shootingDays.find((sd) => sd.id === selectedShootingDayId);
    if (!shootingDay) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedShootingDayId(null)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Call Sheets
          </Button>
          <span className="text-sm text-muted-foreground">
            Day {shootingDay.dayNumber} — {format(new Date(shootingDay.date), "EEEE, MMM d, yyyy")}
          </span>
        </div>
        <CallSheetEditor
          projectId={projectId}
          shootingDay={shootingDay}
          cast={cast}
          crew={crew}
          onBack={() => setSelectedShootingDayId(null)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Call Sheets</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : shootingDays.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">General Call</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Scenes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shootingDays.map((sd) => {
                const csStatus = callSheetStatuses.get(sd.id);
                return (
                  <tr
                    key={sd.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedShootingDayId(sd.id)}
                  >
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono">
                        {sd.dayNumber}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(sd.date), "EEE, MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sd.generalCall || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {sd.scenes.length}
                    </td>
                    <td className="px-4 py-3">
                      <CallSheetStatusBadge
                        status={csStatus?.status || "none"}
                        version={csStatus?.version}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm">
                        {csStatus?.status === "none" ? "Create" : "Edit"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">No shooting days yet</h3>
          <p className="text-sm text-muted-foreground">
            Create shooting days in the Schedule section first, then come back here to generate call sheets.
          </p>
        </div>
      )}
    </div>
  );
}

function CallSheetStatusBadge({
  status,
  version,
}: {
  status: "none" | "draft" | "published";
  version?: number;
}) {
  switch (status) {
    case "published":
      return (
        <Badge variant="pre-production">
          Published v{version || 1}
        </Badge>
      );
    case "draft":
      return <Badge variant="secondary">Draft</Badge>;
    default:
      return (
        <span className="text-xs text-muted-foreground">No Call Sheet</span>
      );
  }
}
