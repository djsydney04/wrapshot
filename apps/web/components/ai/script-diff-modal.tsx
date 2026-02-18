"use client";

import * as React from "react";
import {
  Plus,
  Minus,
  Edit2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

interface ChangeDetail {
  type: string;
  description: string;
}

interface SceneChange {
  sceneNumber: string;
  changeType: "added" | "modified" | "deleted";
  summary: string;
  details: ChangeDetail[];
  productionImpact: "low" | "medium" | "high";
  suggestedActions: string[];
}

interface DiffSummary {
  totalScenesChanged: number;
  scenesAdded: number;
  scenesDeleted: number;
  estimatedScheduleImpact: string;
}

interface ScriptDiffModalProps {
  open: boolean;
  onClose: () => void;
  changes: SceneChange[];
  summary: DiffSummary;
  previousVersion: number;
  newVersion: number;
  onApplyChanges?: (selectedChanges: string[]) => void;
}

export function ScriptDiffModal({
  open,
  onClose,
  changes,
  summary,
  previousVersion,
  newVersion,
  onApplyChanges,
}: ScriptDiffModalProps) {
  const [expandedScenes, setExpandedScenes] = React.useState<Set<string>>(new Set());
  const [selectedActions, setSelectedActions] = React.useState<Set<string>>(new Set());

  const toggleScene = (sceneNumber: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneNumber)) {
        next.delete(sceneNumber);
      } else {
        next.add(sceneNumber);
      }
      return next;
    });
  };

  const toggleAction = (actionId: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const handleApply = () => {
    onApplyChanges?.(Array.from(selectedActions));
    onClose();
  };

  const getChangeIcon = (type: "added" | "modified" | "deleted") => {
    switch (type) {
      case "added":
        return <Plus className="h-4 w-4 text-green-500" />;
      case "deleted":
        return <Minus className="h-4 w-4 text-red-500" />;
      default:
        return <Edit2 className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getImpactIcon = (impact: "low" | "medium" | "high") => {
    switch (impact) {
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getImpactBadge = (impact: "low" | "medium" | "high") => {
    const styles = {
      high: "bg-red-100 text-red-700 border-red-200",
      medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
      low: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return (
      <Badge variant="outline" className={cn("text-[10px]", styles[impact])}>
        {impact.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Script Changes Detected
          </DialogTitle>
          <DialogDescription>
            Version {previousVersion} → Version {newVersion}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-auto space-y-4">
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{summary.totalScenesChanged}</p>
              <p className="text-xs text-muted-foreground">Total Changes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{summary.scenesAdded}</p>
              <p className="text-xs text-muted-foreground">Added</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.scenesDeleted}</p>
              <p className="text-xs text-muted-foreground">Deleted</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{summary.estimatedScheduleImpact}</p>
              <p className="text-xs text-muted-foreground">Schedule Impact</p>
            </div>
          </div>

          {/* Changes list */}
          <div className="space-y-2">
            {changes.map((change) => {
              const isExpanded = expandedScenes.has(change.sceneNumber);
              const actionIds = change.suggestedActions.map(
                (_, i) => `${change.sceneNumber}-${i}`
              );

              return (
                <div
                  key={change.sceneNumber}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {/* Scene header */}
                  <button
                    type="button"
                    onClick={() => toggleScene(change.sceneNumber)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    {getChangeIcon(change.changeType)}
                    <span className="font-mono font-medium">Scene {change.sceneNumber}</span>
                    {getImpactBadge(change.productionImpact)}
                    <span className="flex-1 text-sm text-muted-foreground truncate">
                      {change.summary}
                    </span>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/20 space-y-3">
                      {/* Details */}
                      {change.details.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Details
                          </p>
                          {change.details.map((detail, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground shrink-0">•</span>
                              <div>
                                <span className="font-medium capitalize">{detail.type}:</span>{" "}
                                {detail.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggested actions */}
                      {change.suggestedActions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Suggested Actions
                          </p>
                          {change.suggestedActions.map((action, i) => {
                            const actionId = `${change.sceneNumber}-${i}`;
                            const isSelected = selectedActions.has(actionId);

                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggleAction(actionId)}
                                className={cn(
                                  "flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-md transition-colors",
                                  isSelected
                                    ? "bg-primary/10 border border-primary/30"
                                    : "bg-background border border-border hover:border-primary/30"
                                )}
                              >
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "border-muted-foreground/30"
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                </div>
                                <span>{action}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedActions.size > 0 && (
                <span>{selectedActions.size} action{selectedActions.size !== 1 ? "s" : ""} selected</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Dismiss
              </Button>
              {onApplyChanges && selectedActions.size > 0 && (
                <Button onClick={handleApply}>
                  Apply Selected Actions
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
