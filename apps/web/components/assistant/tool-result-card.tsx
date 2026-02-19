"use client";

import * as React from "react";
import { Check, AlertTriangle, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExecutionResultItem } from "@/lib/ai/tools/types";

interface ToolResultCardProps {
  results: ExecutionResultItem[];
}

export function ToolResultCard({ results }: ToolResultCardProps) {
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const allSuccess = results.every((r) => r.result.success);
  const allVerified = results.every(
    (r) => !r.verification || r.verification.verified
  );

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3 text-sm",
        allSuccess && allVerified
          ? "border-green-500/30 bg-green-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {allSuccess && allVerified ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span
          className={
            allSuccess && allVerified
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          }
        >
          {results.length} action{results.length !== 1 ? "s" : ""} executed
        </span>
      </div>

      <div className="mt-2 space-y-1">
        {results.map((r, i) => {
          const expanded = expandedIndex === i;
          return (
            <div key={i} className="rounded-lg border border-border bg-background/60">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs"
                onClick={() => setExpandedIndex(expanded ? null : i)}
              >
                {r.result.success ? (
                  <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                ) : (
                  <X className="h-3 w-3 flex-shrink-0 text-destructive" />
                )}
                <span className="flex-1 truncate">{r.toolName}</span>
                {r.verification && (
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px]",
                      r.verification.verified
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {r.verification.verified ? "verified" : "issues"}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </button>
              {expanded && (
                <div className="border-t border-border px-2.5 py-2 text-[11px] text-muted-foreground">
                  {r.result.error && (
                    <p className="text-destructive">Error: {r.result.error}</p>
                  )}
                  {r.verification && !r.verification.verified && (
                    <div className="mt-1">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Verification issues:
                      </p>
                      <ul className="ml-3 mt-0.5 list-disc space-y-0.5">
                        {r.verification.discrepancies.map((d, j) => (
                          <li key={j}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.result.success && !r.result.error && (
                    <p>Completed successfully</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
