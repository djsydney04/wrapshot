"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface SlidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
  showOverlay?: boolean;
}

export function SlidePanel({
  open,
  onOpenChange,
  children,
  side = "right",
  className,
  showOverlay = false,
}: SlidePanelProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  return (
    <>
      {/* Optional overlay */}
      {showOverlay && open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 animate-in fade-in-0"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 bottom-0 z-50 flex flex-col",
          "w-[380px] max-w-[90vw]",
          "bg-background border-border shadow-xl",
          "transition-transform duration-300 ease-in-out",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          side === "right"
            ? open
              ? "translate-x-0"
              : "translate-x-full"
            : open
            ? "translate-x-0"
            : "-translate-x-full",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

interface SlidePanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function SlidePanelHeader({
  children,
  className,
  onClose,
  ...props
}: SlidePanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30 flex-shrink-0",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 ml-2 flex-shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function SlidePanelTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-semibold", className)} {...props}>
      {children}
    </h3>
  );
}

export function SlidePanelDescription({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function SlidePanelBody({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 overflow-auto p-4", className)} {...props}>
      {children}
    </div>
  );
}

export function SlidePanelFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border p-4 flex-shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SlidePanelSection({
  children,
  className,
  title,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      )}
      {children}
    </div>
  );
}
