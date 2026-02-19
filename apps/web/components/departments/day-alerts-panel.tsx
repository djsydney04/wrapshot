"use client";

import * as React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getDepartmentDayDependencies,
  type DepartmentDayDependency,
} from "@/lib/actions/departments-readiness";

interface DayAlertsPanelProps {
  projectId: string;
  shootingDayId?: string;
  department?: string;
  title?: string;
}

const severityVariant: Record<string, "secondary" | "destructive" | "outline"> = {
  INFO: "secondary",
  WARNING: "outline",
  CRITICAL: "destructive",
};

export function DayAlertsPanel({
  projectId,
  shootingDayId,
  department,
  title = "Day Alerts",
}: DayAlertsPanelProps) {
  const [alerts, setAlerts] = React.useState<DepartmentDayDependency[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadAlerts = React.useCallback(async () => {
    setLoading(true);
    const { data } = await getDepartmentDayDependencies(projectId, {
      shootingDayId,
      department,
      status: "OPEN",
    });
    setAlerts(data || []);
    setLoading(false);
  }, [projectId, shootingDayId, department]);

  React.useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Badge variant="secondary">{alerts.length}</Badge>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading alerts...</p>
      ) : alerts.length > 0 ? (
        <div className="space-y-1">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-md border border-border px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium">
                    {alert.department} · {alert.sourceType}
                  </p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
                <Badge variant={severityVariant[alert.severity] || "outline"}>
                  {alert.severity}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>No open alerts.</span>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Warnings are soft-blocks and still allow publishing/locking workflows.</span>
        </div>
      )}
    </div>
  );
}
