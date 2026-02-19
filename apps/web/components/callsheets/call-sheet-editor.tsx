"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Save,
  Send,
  Download,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  getFullCallSheetData,
  updateCallSheet,
  publishCallSheet,
  type CallSheetFullData,
} from "@/lib/actions/call-sheets";
import {
  getPostDependenciesForShootingDay,
  syncPostBlockersToCallSheet,
  type PostDependencyAlert,
} from "@/lib/actions/post-production";
import {
  getArtDependenciesForShootingDay,
  syncArtBlockersToCallSheet,
} from "@/lib/actions/art-department";
import type { DepartmentDayDependency } from "@/lib/actions/departments-readiness";
import { updateCastCallTimes, updateDepartmentCallTimes } from "@/lib/actions/shooting-days";
import { CallSheetPreview } from "./call-sheet-preview";
import { DistributeDialog } from "./distribute-dialog";
import type { ShootingDay } from "@/lib/types";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";

interface CallSheetEditorProps {
  projectId: string;
  shootingDay: ShootingDay;
  cast: CastMemberWithInviteStatus[];
  crew: CrewMemberWithInviteStatus[];
  onBack: () => void;
}

type CastCallTimeEdit = {
  castMemberId: string;
  workStatus: "W" | "SW" | "WF" | "SWF" | "H" | "R" | "T" | "WD";
  pickupTime: string;
  muHairCall: string;
  onSetCall: string;
  remarks: string;
};

type DeptCallTimeEdit = {
  department: string;
  callTime: string;
  notes: string;
};

export function CallSheetEditor({
  projectId,
  shootingDay,
  cast,
  crew,
  onBack,
}: CallSheetEditorProps) {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [showDistribute, setShowDistribute] = React.useState(false);
  const [fullData, setFullData] = React.useState<CallSheetFullData | null>(null);
  const [loadingPostAlerts, setLoadingPostAlerts] = React.useState(false);
  const [syncingPostAlerts, setSyncingPostAlerts] = React.useState(false);
  const [postAlerts, setPostAlerts] = React.useState<PostDependencyAlert[]>([]);
  const [loadingArtAlerts, setLoadingArtAlerts] = React.useState(false);
  const [syncingArtAlerts, setSyncingArtAlerts] = React.useState(false);
  const [artAlerts, setArtAlerts] = React.useState<DepartmentDayDependency[]>([]);

  // Editable notes fields
  const [nearestHospital, setNearestHospital] = React.useState("");
  const [safetyNotes, setSafetyNotes] = React.useState("");
  const [parkingNotes, setParkingNotes] = React.useState("");
  const [mealNotes, setMealNotes] = React.useState("");
  const [advanceNotes, setAdvanceNotes] = React.useState("");

  // Cast & department call times
  const [castCallTimes, setCastCallTimes] = React.useState<CastCallTimeEdit[]>([]);
  const [deptCallTimes, setDeptCallTimes] = React.useState<DeptCallTimeEdit[]>([]);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["general", "scenes", "cast", "departments", "location", "notes"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Load full data
  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await getFullCallSheetData(shootingDay.id, projectId);
      if (data) {
        setFullData(data);
        setNearestHospital(data.callSheet.nearestHospital || "");
        setSafetyNotes(data.callSheet.safetyNotes || "");
        setParkingNotes(data.callSheet.parkingNotes || "");
        setMealNotes(data.callSheet.mealNotes || "");
        setAdvanceNotes(data.callSheet.advanceNotes || "");

        // Initialize cast call times from data
        setCastCallTimes(
          data.castCallTimes.map((ct) => ({
            castMemberId: ct.castMemberId,
            workStatus: (ct.workStatus as CastCallTimeEdit["workStatus"]) || "W",
            pickupTime: ct.pickupTime || "",
            muHairCall: ct.muHairCall || "",
            onSetCall: ct.onSetCall || "",
            remarks: ct.remarks || "",
          }))
        );

        // Initialize department call times
        setDeptCallTimes(
          data.departmentCalls.map((dc) => ({
            department: dc.department,
            callTime: dc.callTime || "",
            notes: dc.notes || "",
          }))
        );
      } else {
        setLoadError(error || "Failed to load call sheet data.");
      }
      setLoading(false);
    }
    load();
  }, [shootingDay.id, projectId]);

  const reloadCallSheetData = React.useCallback(async () => {
    const { data, error } = await getFullCallSheetData(shootingDay.id, projectId);
    if (data) {
      setLoadError(null);
      setFullData(data);
      return data;
    } else if (error) {
      setLoadError(error);
    }
    return null;
  }, [shootingDay.id, projectId]);

  const loadPostAlerts = React.useCallback(async () => {
    setLoadingPostAlerts(true);
    try {
      const { alerts } = await getPostDependenciesForShootingDay(projectId, shootingDay.id);
      setPostAlerts(alerts.filter((alert) => alert.severity === "BLOCKER"));
    } catch (error) {
      console.error("Failed to load post blockers for call sheet editor", error);
      setPostAlerts([]);
    } finally {
      setLoadingPostAlerts(false);
    }
  }, [projectId, shootingDay.id]);

  const loadArtAlerts = React.useCallback(async () => {
    setLoadingArtAlerts(true);
    try {
      const { alerts } = await getArtDependenciesForShootingDay(projectId, shootingDay.id);
      setArtAlerts(alerts.filter((alert) => alert.severity === "CRITICAL"));
    } catch (error) {
      console.error("Failed to load art blockers for call sheet editor", error);
      setArtAlerts([]);
    } finally {
      setLoadingArtAlerts(false);
    }
  }, [projectId, shootingDay.id]);

  React.useEffect(() => {
    void loadPostAlerts();
  }, [loadPostAlerts]);

  React.useEffect(() => {
    void loadArtAlerts();
  }, [loadArtAlerts]);

  const persistCallSheet = React.useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!fullData) {
      return { success: false, error: "Call sheet data is not loaded yet." };
    }

    try {
      const invalidDeptCall = deptCallTimes.find(
        (dt) =>
          (dt.department.trim().length > 0 && dt.callTime.trim().length === 0) ||
          (dt.department.trim().length === 0 && dt.callTime.trim().length > 0)
      );

      if (invalidDeptCall) {
        return {
          success: false,
          error: "Each department call row must include both department and call time.",
        };
      }

      // Save call sheet notes
      const callSheetResult = await updateCallSheet(fullData.callSheet.id, {
        nearestHospital: nearestHospital || null,
        safetyNotes: safetyNotes || null,
        parkingNotes: parkingNotes || null,
        mealNotes: mealNotes || null,
        advanceNotes: advanceNotes || null,
      });

      if (callSheetResult.error) {
        return { success: false, error: callSheetResult.error };
      }

      // Save cast call times
      const castResult = await updateCastCallTimes(
        shootingDay.id,
        castCallTimes.map((ct) => ({
          castMemberId: ct.castMemberId,
          workStatus: ct.workStatus,
          pickupTime: ct.pickupTime || undefined,
          muHairCall: ct.muHairCall || undefined,
          onSetCall: ct.onSetCall || undefined,
          remarks: ct.remarks || undefined,
        }))
      );

      if (!castResult.success) {
        return { success: false, error: castResult.error || "Failed to save cast call times." };
      }

      // Save department call times
      const deptResult = await updateDepartmentCallTimes(
        shootingDay.id,
        deptCallTimes
          .filter((dt) => dt.department.trim().length > 0 && dt.callTime.trim().length > 0)
          .map((dt) => ({
            department: dt.department.trim(),
            callTime: dt.callTime,
            notes: dt.notes || undefined,
          }))
      );

      if (!deptResult.success) {
        return { success: false, error: deptResult.error || "Failed to save department call times." };
      }

      await reloadCallSheetData();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save call sheet.",
      };
    }
  }, [
    advanceNotes,
    castCallTimes,
    deptCallTimes,
    fullData,
    mealNotes,
    nearestHospital,
    parkingNotes,
    reloadCallSheetData,
    safetyNotes,
    shootingDay.id,
  ]);

  const handleSave = async () => {
    if (!fullData) return;
    setSaving(true);
    try {
      const result = await persistCallSheet();
      if (!result.success) {
        toast.error(result.error || "Failed to save call sheet.");
        return;
      }
      toast.success("Call sheet draft saved.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!fullData) return;
    setPublishing(true);
    try {
      const saveResult = await persistCallSheet();
      if (!saveResult.success) {
        toast.error(saveResult.error || "Failed to save call sheet before publishing.");
        return;
      }

      const publishResult = await publishCallSheet(fullData.callSheet.id);
      if (publishResult.error) {
        toast.error(publishResult.error);
        return;
      }

      await reloadCallSheetData();
      toast.success("Call sheet published.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!fullData) return;

    setDownloadingPdf(true);
    try {
      const saveResult = await persistCallSheet();
      if (!saveResult.success) {
        toast.error(saveResult.error || "Failed to save call sheet before exporting PDF.");
        return;
      }

      const response = await fetch(`/api/callsheets/${shootingDay.id}/pdf`);
      if (!response.ok) {
        let message = `PDF export failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData?.error) message = errorData.error;
        } catch {
          // Keep default message when response body is not JSON.
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const fallbackName = `${(fullData.project?.name || "Production")
        .replace(/[^a-zA-Z0-9]/g, "_")}_Day${fullData.shootingDay.dayNumber}_CallSheet.pdf`;
      const filename = filenameMatch?.[1] || fallbackName;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success("Call sheet PDF downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSyncPostAlerts = async () => {
    setSyncingPostAlerts(true);
    try {
      const result = await syncPostBlockersToCallSheet(shootingDay.id);
      setAdvanceNotes(result.advanceNotes || "");
      await Promise.all([reloadCallSheetData(), loadPostAlerts()]);

      if (result.blockerCount > 0) {
        toast.success(
          `Synced ${result.blockerCount} post blocker${result.blockerCount === 1 ? "" : "s"} to advance notes.`
        );
      } else {
        toast.success("No open post blockers. Auto-synced blocker notes were removed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync post blockers.");
    } finally {
      setSyncingPostAlerts(false);
    }
  };

  const handleSyncArtAlerts = async () => {
    setSyncingArtAlerts(true);
    try {
      const result = await syncArtBlockersToCallSheet(shootingDay.id);
      const [latestCallSheet] = await Promise.all([reloadCallSheetData(), loadArtAlerts()]);
      if (latestCallSheet?.callSheet.advanceNotes !== undefined) {
        setAdvanceNotes(latestCallSheet.callSheet.advanceNotes || "");
      }

      if (result.blockerCount > 0) {
        toast.success(
          `Synced ${result.blockerCount} art blocker${result.blockerCount === 1 ? "" : "s"} to call sheet notes.`
        );
      } else {
        toast.success("No open art blockers. Auto-synced blocker notes were removed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync art blockers.");
    } finally {
      setSyncingArtAlerts(false);
    }
  };

  const updateCastCallTime = (index: number, field: keyof CastCallTimeEdit, value: string) => {
    setCastCallTimes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCastCallTime = (castMemberId: string) => {
    setCastCallTimes((prev) => [
      ...prev,
      { castMemberId, workStatus: "W", pickupTime: "", muHairCall: "", onSetCall: "", remarks: "" },
    ]);
  };

  const updateDeptCallTime = (index: number, field: keyof DeptCallTimeEdit, value: string) => {
    setDeptCallTimes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addDeptCallTime = () => {
    setDeptCallTimes((prev) => [
      ...prev,
      { department: "", callTime: "", notes: "" },
    ]);
  };

  const removeDeptCallTime = (index: number) => {
    setDeptCallTimes((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fullData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {loadError || "Failed to load call sheet data."}
      </div>
    );
  }

  // Build the updated fullData for preview
  const previewData: CallSheetFullData = {
    ...fullData,
    callSheet: {
      ...fullData.callSheet,
      nearestHospital,
      safetyNotes,
      parkingNotes,
      mealNotes,
      advanceNotes,
    },
  };

  // Cast members that aren't in castCallTimes yet
  const unassignedCast = cast.filter(
    (c) => !castCallTimes.find((ct) => ct.castMemberId === c.id)
  );

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {fullData.callSheet.publishedAt && (
            <Badge variant="pre-production">
              <CheckCircle className="h-3 w-3 mr-1" />
              Published v{fullData.callSheet.version}
            </Badge>
          )}
          {!fullData.callSheet.publishedAt && (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving || publishing || downloadingPdf}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePublish}
            disabled={publishing || saving || downloadingPdf}
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Publish
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || saving || publishing}
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            PDF
          </Button>
          <Button size="sm" onClick={() => setShowDistribute(true)}>
            <Send className="h-4 w-4 mr-1" />
            Distribute
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList className="w-full">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="space-y-2">
            {/* General Info */}
            <CollapsibleSection
              title="General Info"
              expanded={expandedSections.has("general")}
              onToggle={() => toggleSection("general")}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoField label="Production" value={fullData.project?.name || "—"} />
                <InfoField label="Date" value={format(new Date(fullData.shootingDay.date), "EEEE, MMM d, yyyy")} />
                <InfoField label="Day #" value={String(fullData.shootingDay.dayNumber)} />
                <InfoField label="General Call" value={fullData.shootingDay.generalCall || "—"} />
                <InfoField label="Estimated Wrap" value={fullData.shootingDay.estimatedWrap || "—"} />
                <InfoField label="Weather" value={fullData.shootingDay.weatherNotes || "—"} />
                <div className="col-span-2 md:col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1">Nearest Hospital</label>
                  <Input
                    value={nearestHospital}
                    onChange={(e) => setNearestHospital(e.target.value)}
                    placeholder="Hospital name and address"
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Scene Schedule */}
            <CollapsibleSection
              title={`Scene Schedule (${fullData.scenes.length})`}
              expanded={expandedSections.has("scenes")}
              onToggle={() => toggleSection("scenes")}
            >
              {fullData.scenes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scene</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Synopsis</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cast</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">I/E</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">D/N</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pages</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Set/Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {fullData.scenes.map((s) => (
                        <tr key={s.sceneId} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono font-medium">{s.scene.sceneNumber}</td>
                          <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">
                            {s.scene.synopsis || "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {s.scene.castMembers?.map((cm) => cm.castMember.castNumber).filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-3 py-2">{s.scene.intExt}</td>
                          <td className="px-3 py-2">{s.scene.dayNight}</td>
                          <td className="px-3 py-2">{Number(s.scene.pageCount).toFixed(1)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {s.scene.setName || s.scene.location?.name || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No scenes assigned to this shooting day.
                </p>
              )}
            </CollapsibleSection>

            {/* Cast Call Times */}
            <CollapsibleSection
              title={`Cast Call Times (${castCallTimes.length})`}
              expanded={expandedSections.has("cast")}
              onToggle={() => toggleSection("cast")}
            >
              {castCallTimes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Character</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Actor</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pickup</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">MU/Hair</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">On Set</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {castCallTimes.map((ct, idx) => {
                        const member = cast.find((c) => c.id === ct.castMemberId) ||
                          fullData.castCallTimes.find((c) => c.castMemberId === ct.castMemberId)?.castMember;
                        return (
                          <tr key={ct.castMemberId}>
                            <td className="px-3 py-2 font-mono">
                              {(member as any)?.castNumber || "—"}
                            </td>
                            <td className="px-3 py-2 font-medium">
                              {(member as any)?.characterName || "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {(member as any)?.actorName || "—"}
                            </td>
                            <td className="px-3 py-1">
                              <select
                                value={ct.workStatus}
                                onChange={(e) => updateCastCallTime(idx, "workStatus", e.target.value)}
                                className="h-8 rounded border border-border bg-background px-2 text-xs"
                              >
                                <option value="W">W</option>
                                <option value="SW">SW</option>
                                <option value="WF">WF</option>
                                <option value="SWF">SWF</option>
                                <option value="H">H</option>
                                <option value="R">R</option>
                                <option value="T">T</option>
                                <option value="WD">WD</option>
                              </select>
                            </td>
                            <td className="px-3 py-1">
                              <Input
                                type="time"
                                value={ct.pickupTime}
                                onChange={(e) => updateCastCallTime(idx, "pickupTime", e.target.value)}
                                className="h-8 text-xs w-28"
                              />
                            </td>
                            <td className="px-3 py-1">
                              <Input
                                type="time"
                                value={ct.muHairCall}
                                onChange={(e) => updateCastCallTime(idx, "muHairCall", e.target.value)}
                                className="h-8 text-xs w-28"
                              />
                            </td>
                            <td className="px-3 py-1">
                              <Input
                                type="time"
                                value={ct.onSetCall}
                                onChange={(e) => updateCastCallTime(idx, "onSetCall", e.target.value)}
                                className="h-8 text-xs w-28"
                              />
                            </td>
                            <td className="px-3 py-1">
                              <Input
                                value={ct.remarks}
                                onChange={(e) => updateCastCallTime(idx, "remarks", e.target.value)}
                                className="h-8 text-xs w-32"
                                placeholder="Notes..."
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No cast call times set.
                </p>
              )}
              {unassignedCast.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground self-center">Add cast:</span>
                  {unassignedCast.slice(0, 10).map((c) => (
                    <Button
                      key={c.id}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => addCastCallTime(c.id)}
                    >
                      {c.characterName}
                    </Button>
                  ))}
                  {unassignedCast.length > 10 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{unassignedCast.length - 10} more
                    </span>
                  )}
                </div>
              )}
            </CollapsibleSection>

            {/* Department Calls */}
            <CollapsibleSection
              title={`Department Calls (${deptCallTimes.length})`}
              expanded={expandedSections.has("departments")}
              onToggle={() => toggleSection("departments")}
            >
              {deptCallTimes.length > 0 ? (
                <div className="space-y-2">
                  {deptCallTimes.map((dt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={dt.department}
                        onChange={(e) => updateDeptCallTime(idx, "department", e.target.value)}
                        placeholder="Department"
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        type="time"
                        value={dt.callTime}
                        onChange={(e) => updateDeptCallTime(idx, "callTime", e.target.value)}
                        className="w-32 h-8 text-sm"
                      />
                      <Input
                        value={dt.notes}
                        onChange={(e) => updateDeptCallTime(idx, "notes", e.target.value)}
                        placeholder="Notes"
                        className="flex-1 h-8 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-8 w-8 p-0"
                        onClick={() => removeDeptCallTime(idx)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={addDeptCallTime}>
                + Add Department
              </Button>
            </CollapsibleSection>

            {/* Location */}
            <CollapsibleSection
              title="Location"
              expanded={expandedSections.has("location")}
              onToggle={() => toggleSection("location")}
            >
              {fullData.locations.length > 0 ? (
                <div className="space-y-3">
                  {fullData.locations.map((loc, idx) => (
                    <div key={idx} className="rounded-md bg-muted/30 p-3 space-y-1">
                      <p className="text-sm font-medium">{loc.name}</p>
                      {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                      {loc.contactName && (
                        <p className="text-xs text-muted-foreground">
                          Contact: {loc.contactName} {loc.contactPhone ? `(${loc.contactPhone})` : ""}
                        </p>
                      )}
                      {loc.parkingNotes && (
                        <p className="text-xs text-muted-foreground">Parking: {loc.parkingNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No location info available.</p>
              )}
            </CollapsibleSection>

            {/* Notes */}
            <CollapsibleSection
              title="Notes"
              expanded={expandedSections.has("notes")}
              onToggle={() => toggleSection("notes")}
            >
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Art Blockers
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSyncArtAlerts}
                      disabled={syncingArtAlerts}
                    >
                      {syncingArtAlerts ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Sync to Call Sheet
                    </Button>
                  </div>
                  {loadingArtAlerts ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading art blockers...</span>
                    </div>
                  ) : artAlerts.length > 0 ? (
                    <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                      {artAlerts.map((alert) => (
                        <li key={alert.id} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{alert.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open art blockers.</p>
                  )}
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Post Blockers
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSyncPostAlerts}
                      disabled={syncingPostAlerts}
                    >
                      {syncingPostAlerts ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Sync to Advance Notes
                    </Button>
                  </div>
                  {loadingPostAlerts ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading post blockers...</span>
                    </div>
                  ) : postAlerts.length > 0 ? (
                    <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                      {postAlerts.map((alert) => (
                        <li key={alert.id} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{alert.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open post blockers.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Safety Notes</label>
                  <Textarea
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    placeholder="Safety briefing notes, hazards, emergency procedures..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Meal Notes</label>
                  <Textarea
                    value={mealNotes}
                    onChange={(e) => setMealNotes(e.target.value)}
                    placeholder="Catering info, meal times, dietary notes..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Parking Notes</label>
                  <Textarea
                    value={parkingNotes}
                    onChange={(e) => setParkingNotes(e.target.value)}
                    placeholder="Crew parking, base camp, directions..."
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Advance Schedule</label>
                  <Textarea
                    value={advanceNotes}
                    onChange={(e) => setAdvanceNotes(e.target.value)}
                    placeholder="Next day's schedule preview, advance notes..."
                    rows={2}
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <CallSheetPreview data={previewData} />
        </TabsContent>
      </Tabs>

      {/* Distribute Dialog */}
      <DistributeDialog
        open={showDistribute}
        onOpenChange={setShowDistribute}
        shootingDayId={shootingDay.id}
        cast={cast}
        crew={crew}
      />
    </div>
  );
}

// Collapsible section helper
function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {title}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Read-only info field
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
