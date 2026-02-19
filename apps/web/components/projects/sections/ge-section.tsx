"use client";

import * as React from "react";
import { Bolt, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Scene as DBScene } from "@/lib/actions/scenes";
import type { ShootingDay } from "@/lib/types";
import {
  createLightingNeed,
  createLightingPlan,
  createRiggingTask,
  getLightingPlans,
  getPowerPlans,
  getRiggingTasks,
  upsertPowerPlanForDay,
  type LightingPlan,
  type PowerPlan,
  type RiggingTask,
} from "@/lib/actions/ge";
import { DayAlertsPanel } from "@/components/departments/day-alerts-panel";
import { AttachmentPanel } from "@/components/departments/attachment-panel";
import { CommentThreadPanel } from "@/components/departments/comment-thread-panel";

interface GeSectionProps {
  projectId: string;
  scenes: DBScene[];
  shootingDays: ShootingDay[];
}

interface PowerCircuitDraft {
  runLabel: string;
  loadAmps: string;
  breaker: string;
  status: string;
}

interface SafetyDraft {
  item: string;
  status: string;
  notes: string;
}

const DEFAULT_CIRCUIT: PowerCircuitDraft = {
  runLabel: "",
  loadAmps: "0",
  breaker: "",
  status: "PLANNED",
};

const DEFAULT_SAFETY: SafetyDraft = {
  item: "",
  status: "REQUIRED",
  notes: "",
};

export function GeSection({ projectId, scenes, shootingDays }: GeSectionProps) {
  const [tab, setTab] = React.useState("lighting");
  const [loading, setLoading] = React.useState(true);
  const [lightingPlans, setLightingPlans] = React.useState<LightingPlan[]>([]);
  const [riggingTasks, setRiggingTasks] = React.useState<RiggingTask[]>([]);
  const [powerPlans, setPowerPlans] = React.useState<PowerPlan[]>([]);

  const [lightingForm, setLightingForm] = React.useState({
    sceneId: scenes[0]?.id || "",
    shootingDayId: shootingDays[0]?.id || "",
    status: "DRAFT",
    notes: "",
  });

  const [lightingNeedForm, setLightingNeedForm] = React.useState({
    planId: "",
    fixtureType: "",
    qty: "1",
    powerDraw: "0",
    source: "OWNED",
    status: "PENDING",
    estimatedRate: "0",
    notes: "",
  });

  const [riggingForm, setRiggingForm] = React.useState({
    locationId: "",
    startDayId: shootingDays[0]?.id || "",
    endDayId: shootingDays[0]?.id || "",
    status: "PLANNED",
    notes: "",
    sceneIdsCsv: "",
  });

  const [powerForm, setPowerForm] = React.useState({
    shootingDayId: shootingDays[0]?.id || "",
    locationId: "",
    generator: "",
    capacityAmps: "0",
    distroNotes: "",
    status: "DRAFT",
  });

  const [circuits, setCircuits] = React.useState<PowerCircuitDraft[]>([
    { ...DEFAULT_CIRCUIT },
  ]);
  const [safetyItems, setSafetyItems] = React.useState<SafetyDraft[]>([
    { ...DEFAULT_SAFETY },
  ]);

  const loadGeData = React.useCallback(async () => {
    setLoading(true);
    const [lightingResult, riggingResult, powerResult] = await Promise.all([
      getLightingPlans(projectId),
      getRiggingTasks(projectId),
      getPowerPlans(projectId),
    ]);

    setLightingPlans(lightingResult.data || []);
    setRiggingTasks(riggingResult.data || []);
    setPowerPlans(powerResult.data || []);
    setLoading(false);
  }, [projectId]);

  React.useEffect(() => {
    void loadGeData();
  }, [loadGeData]);

  React.useEffect(() => {
    if (!lightingNeedForm.planId && lightingPlans.length > 0) {
      setLightingNeedForm((prev) => ({ ...prev, planId: lightingPlans[0].id }));
    }
  }, [lightingNeedForm.planId, lightingPlans]);

  const handleCreateLightingPlan = async () => {
    const result = await createLightingPlan({
      projectId,
      sceneId: lightingForm.sceneId,
      shootingDayId: lightingForm.shootingDayId || undefined,
      status: lightingForm.status as "DRAFT" | "IN_PROGRESS" | "PUBLISHED",
      notes: lightingForm.notes || undefined,
    });

    if (result.data) {
      setLightingForm((prev) => ({ ...prev, notes: "" }));
      await loadGeData();
    }
  };

  const handleCreateLightingNeed = async () => {
    const result = await createLightingNeed({
      planId: lightingNeedForm.planId,
      fixtureType: lightingNeedForm.fixtureType,
      qty: Number(lightingNeedForm.qty || 1),
      powerDraw: Number(lightingNeedForm.powerDraw || 0),
      source: lightingNeedForm.source as "OWNED" | "RENTAL" | "PURCHASE" | "BORROW",
      status: lightingNeedForm.status as "PENDING" | "SOURCED" | "UNAVAILABLE" | "READY",
      estimatedRate: Number(lightingNeedForm.estimatedRate || 0),
      notes: lightingNeedForm.notes || undefined,
    });

    if (result.data) {
      setLightingNeedForm((prev) => ({ ...prev, fixtureType: "", notes: "" }));
      await loadGeData();
    }
  };

  const handleCreateRiggingTask = async () => {
    const sceneIds = riggingForm.sceneIdsCsv
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const result = await createRiggingTask({
      projectId,
      locationId: riggingForm.locationId || undefined,
      startDayId: riggingForm.startDayId || undefined,
      endDayId: riggingForm.endDayId || undefined,
      status: riggingForm.status as "PLANNED" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED",
      notes: riggingForm.notes || undefined,
      sceneIds,
    });

    if (result.data) {
      setRiggingForm((prev) => ({ ...prev, notes: "", sceneIdsCsv: "" }));
      await loadGeData();
    }
  };

  const updateCircuit = (
    index: number,
    field: keyof PowerCircuitDraft,
    value: string,
  ) => {
    setCircuits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateSafety = (index: number, field: keyof SafetyDraft, value: string) => {
    setSafetyItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCircuit = () => setCircuits((prev) => [...prev, { ...DEFAULT_CIRCUIT }]);
  const addSafety = () => setSafetyItems((prev) => [...prev, { ...DEFAULT_SAFETY }]);

  const handleSavePowerPlan = async () => {
    const result = await upsertPowerPlanForDay({
      projectId,
      shootingDayId: powerForm.shootingDayId,
      locationId: powerForm.locationId || undefined,
      generator: powerForm.generator || undefined,
      capacityAmps: Number(powerForm.capacityAmps || 0),
      distroNotes: powerForm.distroNotes || undefined,
      status: powerForm.status as "DRAFT" | "IN_PROGRESS" | "PASSED" | "FAILED",
      circuits: circuits.map((circuit) => ({
        runLabel: circuit.runLabel,
        loadAmps: Number(circuit.loadAmps || 0),
        breaker: circuit.breaker || undefined,
        status: circuit.status as "PLANNED" | "ACTIVE" | "FAILED",
      })),
      safetyChecklist: safetyItems.map((item) => ({
        department: "GE",
        item: item.item,
        status: item.status as "REQUIRED" | "IN_PROGRESS" | "COMPLETE" | "FAILED",
        notes: item.notes || undefined,
      })),
    });

    if (result.data) {
      setPowerForm((prev) => ({ ...prev, distroNotes: "" }));
      await loadGeData();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Bolt className="h-4 w-4" />
              Grip & Electric Workspace
            </h3>
            <Badge variant="outline">{lightingPlans.length} lighting plans</Badge>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading G&E data...</p>
          ) : (
            <Tabs value={tab} onValueChange={setTab} defaultValue="lighting">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="lighting">Lighting Plans</TabsTrigger>
                <TabsTrigger value="rigging">Rigging Schedule</TabsTrigger>
                <TabsTrigger value="power">Power + Safety</TabsTrigger>
              </TabsList>

              <TabsContent value="lighting" className="space-y-4 pt-4">
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                  <Select
                    value={lightingForm.sceneId}
                    onChange={(event) =>
                      setLightingForm((prev) => ({ ...prev, sceneId: event.target.value }))
                    }
                    options={scenes.map((scene) => ({
                      value: scene.id,
                      label: `Scene ${scene.sceneNumber}`,
                    }))}
                  />
                  <Select
                    value={lightingForm.shootingDayId}
                    onChange={(event) =>
                      setLightingForm((prev) => ({ ...prev, shootingDayId: event.target.value }))
                    }
                    options={shootingDays.map((day) => ({
                      value: day.id,
                      label: `Day ${day.dayNumber} (${day.date})`,
                    }))}
                  />
                  <Select
                    value={lightingForm.status}
                    onChange={(event) =>
                      setLightingForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    options={[
                      { value: "DRAFT", label: "Draft" },
                      { value: "IN_PROGRESS", label: "In Progress" },
                      { value: "PUBLISHED", label: "Published" },
                    ]}
                  />
                  <div className="md:col-span-3">
                    <Input
                      value={lightingForm.notes}
                      onChange={(event) =>
                        setLightingForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Lighting setup notes"
                    />
                  </div>
                </div>
                <Button variant="skeuo" size="sm" onClick={handleCreateLightingPlan}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Lighting Plan
                </Button>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Add Lighting Need
                  </p>
                  <div className="grid gap-2 md:grid-cols-4">
                    <Select
                      value={lightingNeedForm.planId}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, planId: event.target.value }))
                      }
                      options={lightingPlans.map((plan) => ({
                        value: plan.id,
                        label: `Scene ${plan.scene?.sceneNumber || "-"}`,
                      }))}
                    />
                    <Input
                      value={lightingNeedForm.fixtureType}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, fixtureType: event.target.value }))
                      }
                      placeholder="Fixture"
                    />
                    <Input
                      value={lightingNeedForm.qty}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, qty: event.target.value }))
                      }
                      type="number"
                      min={1}
                      placeholder="Qty"
                    />
                    <Input
                      value={lightingNeedForm.powerDraw}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, powerDraw: event.target.value }))
                      }
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="Power draw"
                    />
                    <Select
                      value={lightingNeedForm.source}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, source: event.target.value }))
                      }
                      options={[
                        { value: "OWNED", label: "Owned" },
                        { value: "RENTAL", label: "Rental" },
                        { value: "PURCHASE", label: "Purchase" },
                        { value: "BORROW", label: "Borrow" },
                      ]}
                    />
                    <Input
                      value={lightingNeedForm.estimatedRate}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, estimatedRate: event.target.value }))
                      }
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Est. rate"
                    />
                    <Select
                      value={lightingNeedForm.status}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "SOURCED", label: "Sourced" },
                        { value: "UNAVAILABLE", label: "Unavailable" },
                        { value: "READY", label: "Ready" },
                      ]}
                    />
                    <Input
                      value={lightingNeedForm.notes}
                      onChange={(event) =>
                        setLightingNeedForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      placeholder="Notes"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCreateLightingNeed}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Need
                  </Button>
                </div>

                <div className="space-y-2">
                  {lightingPlans.map((plan) => (
                    <div key={plan.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Scene {plan.scene?.sceneNumber || "-"} · Day {plan.shootingDay?.dayNumber || "-"}
                        </p>
                        <Badge variant="outline">{plan.status}</Badge>
                      </div>
                      {plan.needs && plan.needs.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {plan.needs.map((need) => (
                            <p key={need.id}>
                              {need.fixtureType} x{need.qty} ({need.status})
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No lighting needs yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="rigging" className="space-y-4 pt-4">
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                  <Input
                    value={riggingForm.locationId}
                    onChange={(event) =>
                      setRiggingForm((prev) => ({ ...prev, locationId: event.target.value }))
                    }
                    placeholder="Location ID (optional)"
                  />
                  <Select
                    value={riggingForm.startDayId}
                    onChange={(event) =>
                      setRiggingForm((prev) => ({ ...prev, startDayId: event.target.value }))
                    }
                    options={shootingDays.map((day) => ({
                      value: day.id,
                      label: `Start Day ${day.dayNumber}`,
                    }))}
                  />
                  <Select
                    value={riggingForm.endDayId}
                    onChange={(event) =>
                      setRiggingForm((prev) => ({ ...prev, endDayId: event.target.value }))
                    }
                    options={shootingDays.map((day) => ({
                      value: day.id,
                      label: `End Day ${day.dayNumber}`,
                    }))}
                  />
                  <Select
                    value={riggingForm.status}
                    onChange={(event) =>
                      setRiggingForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    options={[
                      { value: "PLANNED", label: "Planned" },
                      { value: "IN_PROGRESS", label: "In Progress" },
                      { value: "COMPLETE", label: "Complete" },
                      { value: "BLOCKED", label: "Blocked" },
                    ]}
                  />
                  <div className="md:col-span-2">
                    <Input
                      value={riggingForm.sceneIdsCsv}
                      onChange={(event) =>
                        setRiggingForm((prev) => ({ ...prev, sceneIdsCsv: event.target.value }))
                      }
                      placeholder="Scene IDs (comma separated)"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Textarea
                      value={riggingForm.notes}
                      onChange={(event) =>
                        setRiggingForm((prev) => ({ ...prev, notes: event.target.value }))
                      }
                      rows={2}
                      placeholder="Rigging notes"
                    />
                  </div>
                </div>
                <Button variant="skeuo" size="sm" onClick={handleCreateRiggingTask}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Rigging Task
                </Button>

                <div className="space-y-2">
                  {riggingTasks.map((task) => (
                    <div key={task.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Task {task.id.slice(0, 8)}</p>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                      {task.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Scenes linked: {task.scenes?.length || 0}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="power" className="space-y-4 pt-4">
                <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
                  <Select
                    value={powerForm.shootingDayId}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, shootingDayId: event.target.value }))
                    }
                    options={shootingDays.map((day) => ({
                      value: day.id,
                      label: `Day ${day.dayNumber} (${day.date})`,
                    }))}
                  />
                  <Input
                    value={powerForm.locationId}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, locationId: event.target.value }))
                    }
                    placeholder="Location ID"
                  />
                  <Select
                    value={powerForm.status}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                    options={[
                      { value: "DRAFT", label: "Draft" },
                      { value: "IN_PROGRESS", label: "In Progress" },
                      { value: "PASSED", label: "Passed" },
                      { value: "FAILED", label: "Failed" },
                    ]}
                  />
                  <Input
                    value={powerForm.generator}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, generator: event.target.value }))
                    }
                    placeholder="Generator"
                  />
                  <Input
                    value={powerForm.capacityAmps}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, capacityAmps: event.target.value }))
                    }
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="Capacity amps"
                  />
                  <Input
                    value={powerForm.distroNotes}
                    onChange={(event) =>
                      setPowerForm((prev) => ({ ...prev, distroNotes: event.target.value }))
                    }
                    placeholder="Distro notes"
                  />
                </div>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Power Circuits
                  </p>
                  {circuits.map((circuit, index) => (
                    <div key={`${index}-${circuit.runLabel}`} className="grid gap-2 md:grid-cols-4">
                      <Input
                        value={circuit.runLabel}
                        onChange={(event) =>
                          updateCircuit(index, "runLabel", event.target.value)
                        }
                        placeholder="Run label"
                      />
                      <Input
                        value={circuit.loadAmps}
                        onChange={(event) => updateCircuit(index, "loadAmps", event.target.value)}
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="Load amps"
                      />
                      <Input
                        value={circuit.breaker}
                        onChange={(event) => updateCircuit(index, "breaker", event.target.value)}
                        placeholder="Breaker"
                      />
                      <Select
                        value={circuit.status}
                        onChange={(event) => updateCircuit(index, "status", event.target.value)}
                        options={[
                          { value: "PLANNED", label: "Planned" },
                          { value: "ACTIVE", label: "Active" },
                          { value: "FAILED", label: "Failed" },
                        ]}
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addCircuit}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Circuit
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Safety Checklist
                  </p>
                  {safetyItems.map((item, index) => (
                    <div key={`${index}-${item.item}`} className="grid gap-2 md:grid-cols-3">
                      <Input
                        value={item.item}
                        onChange={(event) => updateSafety(index, "item", event.target.value)}
                        placeholder="Checklist item"
                      />
                      <Select
                        value={item.status}
                        onChange={(event) => updateSafety(index, "status", event.target.value)}
                        options={[
                          { value: "REQUIRED", label: "Required" },
                          { value: "IN_PROGRESS", label: "In Progress" },
                          { value: "COMPLETE", label: "Complete" },
                          { value: "FAILED", label: "Failed" },
                        ]}
                      />
                      <Input
                        value={item.notes}
                        onChange={(event) => updateSafety(index, "notes", event.target.value)}
                        placeholder="Notes"
                      />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addSafety}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Safety Item
                  </Button>
                </div>

                <Button variant="skeuo" size="sm" onClick={handleSavePowerPlan}>
                  <Save className="mr-1 h-4 w-4" />
                  Save Power + Safety Plan
                </Button>

                <div className="space-y-2">
                  {powerPlans.map((plan) => (
                    <div key={plan.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          Day {shootingDays.find((day) => day.id === plan.shootingDayId)?.dayNumber || "-"}
                        </p>
                        <Badge variant="outline">{plan.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Capacity {Number(plan.capacityAmps || 0).toFixed(1)}A · {plan.circuits?.length || 0} circuits · {plan.safetyChecklist?.length || 0} safety checks
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="space-y-4">
          <DayAlertsPanel projectId={projectId} department="GE" title="G&E Alerts" />
          <AttachmentPanel
            projectId={projectId}
            entityType="GE_WORKSPACE"
            entityId={projectId}
            title="G&E Attachments"
          />
          <CommentThreadPanel
            projectId={projectId}
            entityType="GE_WORKSPACE"
            entityId={projectId}
            title="G&E Notes"
          />
        </div>
      </div>
    </div>
  );
}
