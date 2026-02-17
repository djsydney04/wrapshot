"use client";

import * as React from "react";
import { Users, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCrewSuggestions,
  acceptCrewSuggestion,
  dismissCrewSuggestion,
  type CrewSuggestion,
} from "@/lib/actions/crew-suggestions";
import { toast } from "sonner";

interface CrewSuggestionPanelProps {
  projectId: string;
  onAccepted?: () => void;
}

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  PRODUCTION: "Production",
  DIRECTION: "Direction",
  CAMERA: "Camera",
  SOUND: "Sound",
  LIGHTING: "Lighting",
  ART: "Art",
  COSTUME: "Costume",
  HAIR_MAKEUP: "Hair & Makeup",
  LOCATIONS: "Locations",
  STUNTS: "Stunts",
  VFX: "VFX",
  TRANSPORTATION: "Transportation",
  CATERING: "Catering",
  ACCOUNTING: "Accounting",
  POST_PRODUCTION: "Post-Production",
};

export function CrewSuggestionPanel({ projectId, onAccepted }: CrewSuggestionPanelProps) {
  const [suggestions, setSuggestions] = React.useState<CrewSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      const result = await getCrewSuggestions(projectId);
      if (result.data) {
        setSuggestions(result.data);
      }
      setLoading(false);
    }
    load();
  }, [projectId]);

  const handleAccept = async (suggestion: CrewSuggestion) => {
    setActionInProgress(suggestion.id);
    const result = await acceptCrewSuggestion(suggestion.id, projectId);
    if (result.error) {
      toast.error("Failed to accept suggestion", { description: result.error });
    } else {
      toast.success(`Added ${suggestion.role} to crew`);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      onAccepted?.();
    }
    setActionInProgress(null);
  };

  const handleDismiss = async (suggestion: CrewSuggestion) => {
    setActionInProgress(suggestion.id);
    const result = await dismissCrewSuggestion(suggestion.id);
    if (result.error) {
      toast.error("Failed to dismiss suggestion");
    } else {
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    }
    setActionInProgress(null);
  };

  if (loading) {
    return null;
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-medium text-purple-900 dark:text-purple-100">
          Suggested Crew Roles
        </h3>
        <Badge variant="secondary" className="text-xs">
          {suggestions.length}
        </Badge>
      </div>
      <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
        Based on your script analysis, these crew roles may be needed:
      </p>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="flex items-center gap-3 rounded-md bg-white dark:bg-gray-900 p-3 border border-purple-100 dark:border-purple-900"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{suggestion.role}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${PRIORITY_STYLES[suggestion.priority as keyof typeof PRIORITY_STYLES] || PRIORITY_STYLES.medium}`}
                >
                  {suggestion.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {DEPARTMENT_LABELS[suggestion.department] || suggestion.department}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {suggestion.reason}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {actionInProgress === suggestion.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                    onClick={() => handleAccept(suggestion)}
                    title="Accept — add to crew"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => handleDismiss(suggestion)}
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
