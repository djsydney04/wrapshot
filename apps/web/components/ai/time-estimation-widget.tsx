"use client";

import * as React from "react";
import {
  Clock,
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAIStore, type TimeEstimate, type TimeEstimateFactor } from "@/lib/stores/ai-store";

interface TimeEstimationWidgetProps {
  sceneId: string;
  projectId: string;
  sceneNumber?: string;
  location?: string;
  intExt?: string;
  dayNight?: string;
  pageCount?: number;
  pageEighths?: number;
  cast?: { characterName: string; actorName?: string }[];
  elements?: { category: string; name: string }[];
  synopsis?: string;
  scriptText?: string;
  currentEstimate?: number;
  onEstimateChange?: (hours: number) => void;
  className?: string;
}

export function TimeEstimationWidget({
  sceneId,
  projectId,
  sceneNumber,
  location,
  intExt,
  dayNight,
  pageCount,
  pageEighths,
  cast,
  elements,
  synopsis,
  scriptText,
  currentEstimate,
  onEstimateChange,
  className,
}: TimeEstimationWidgetProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { getTimeEstimateForScene, setTimeEstimate, setLoadingTimeEstimate } = useAIStore();
  const estimate = getTimeEstimateForScene(sceneId);

  const fetchEstimate = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingTimeEstimate(sceneId, true);

    try {
      const response = await fetch("/api/ai/estimate-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          projectId,
          sceneNumber,
          location,
          intExt,
          dayNight,
          pageCount,
          pageEighths,
          cast,
          elements,
          synopsis,
          scriptText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get estimate");
      }

      const { data } = await response.json();
      setTimeEstimate(sceneId, data);

      if (onEstimateChange && data.hours) {
        onEstimateChange(data.hours);
      }
    } catch (err) {
      console.error("Time estimation error:", err);
      setError("Failed to estimate. Try again.");
    } finally {
      setIsLoading(false);
      setLoadingTimeEstimate(sceneId, false);
    }
  };

  // Get confidence color and label
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 0.8) {
      return {
        color: "bg-green-500",
        label: "High confidence",
        textColor: "text-green-600",
      };
    }
    if (confidence >= 0.5) {
      return {
        color: "bg-yellow-500",
        label: "Medium confidence",
        textColor: "text-yellow-600",
      };
    }
    return {
      color: "bg-red-500",
      label: "Low confidence",
      textColor: "text-red-600",
    };
  };

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // No estimate yet - show generate button
  if (!estimate && !isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEstimate}
          disabled={isLoading}
          className="gap-1.5 text-xs h-7"
        >
          <Sparkles className="h-3 w-3 text-primary" />
          Estimate Time
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  // Loading state
  if (isLoading && !estimate) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Estimating...</span>
      </div>
    );
  }

  if (!estimate) return null;

  const confidenceStyle = getConfidenceStyle(estimate.confidence);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Main estimate display */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-primary/10 rounded-md px-2 py-1">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-sm">
            {estimate.confidence >= 0.5 ? "" : "~"}
            {formatHours(estimate.hours)}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/70 ml-1">
            <Sparkles className="h-2.5 w-2.5" />
            Wrapshot Intelligence
          </span>
        </div>

        {/* Confidence bar */}
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", confidenceStyle.color)}
              style={{ width: `${estimate.confidence * 100}%` }}
            />
          </div>
          <span className={cn("text-[10px]", confidenceStyle.textColor)}>
            {Math.round(estimate.confidence * 100)}%
          </span>
        </div>

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fetchEstimate}
          disabled={isLoading}
          className="h-6 w-6 ml-auto"
          title="Recalculate"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>

        {estimate.factors.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6"
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Factors breakdown */}
      {isExpanded && estimate.factors.length > 0 && (
        <div className="bg-muted/50 rounded-md p-2 space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Factors
          </p>
          {estimate.factors.map((factor, index) => (
            <FactorRow key={index} factor={factor} />
          ))}
        </div>
      )}

      {/* Low confidence warning */}
      {estimate.confidence < 0.5 && (
        <p className="text-[10px] text-muted-foreground italic">
          Rough estimate - many unknown factors
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FactorRow({ factor }: { factor: TimeEstimateFactor }) {
  const Icon =
    factor.impact === "increases"
      ? TrendingUp
      : factor.impact === "decreases"
        ? TrendingDown
        : Minus;

  const iconColor =
    factor.impact === "increases"
      ? "text-red-500"
      : factor.impact === "decreases"
        ? "text-green-500"
        : "text-muted-foreground";

  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{factor.factor}</p>
        <p className="text-muted-foreground">{factor.description}</p>
      </div>
    </div>
  );
}
