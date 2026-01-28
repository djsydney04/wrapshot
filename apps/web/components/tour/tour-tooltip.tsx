"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TourStep } from "./tour-steps";

interface TourTooltipProps {
  step: TourStep;
  targetRect: DOMRect | null;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function TourTooltip({
  step,
  targetRect,
  stepNumber,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast,
}: TourTooltipProps) {
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (!targetRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 16;
    const arrowOffset = 12;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "top":
        top = targetRect.top - tooltipRect.height - arrowOffset;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case "bottom":
        top = targetRect.bottom + arrowOffset;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case "left":
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - arrowOffset;
        break;
      case "right":
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.right + arrowOffset;
        break;
    }

    // Keep tooltip within viewport
    const maxLeft = window.innerWidth - tooltipRect.width - padding;
    const maxTop = window.innerHeight - tooltipRect.height - padding;

    left = Math.max(padding, Math.min(left, maxLeft));
    top = Math.max(padding, Math.min(top, maxTop));

    setPosition({ top, left });
  }, [targetRect, step.position]);

  if (!targetRect) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[101] w-80 rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Step {stepNumber} of {totalSteps}
          </p>
          <h3 className="font-semibold">{step.title}</h3>
        </div>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        <p className="text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip tour
        </Button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onPrev}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 pb-3">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === stepNumber - 1 ? "bg-foreground" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
