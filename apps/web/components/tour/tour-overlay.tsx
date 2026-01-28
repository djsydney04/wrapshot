"use client";

import * as React from "react";

interface TourOverlayProps {
  targetRect: DOMRect | null;
}

export function TourOverlay({ targetRect }: TourOverlayProps) {
  const padding = 8; // Padding around the target element

  // Generate clip path that creates a spotlight effect
  const getClipPath = () => {
    if (!targetRect) {
      return "none";
    }

    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const width = targetRect.width + padding * 2;
    const height = targetRect.height + padding * 2;
    const radius = 8; // Border radius for the spotlight

    // Create a path that covers everything except the target area
    // Using polygon with a hole (outer rect + inner rect with rounded corners approximation)
    return `polygon(
      0% 0%,
      0% 100%,
      ${x}px 100%,
      ${x}px ${y + radius}px,
      ${x + radius}px ${y}px,
      ${x + width - radius}px ${y}px,
      ${x + width}px ${y + radius}px,
      ${x + width}px ${y + height - radius}px,
      ${x + width - radius}px ${y + height}px,
      ${x + radius}px ${y + height}px,
      ${x}px ${y + height - radius}px,
      ${x}px 100%,
      100% 100%,
      100% 0%
    )`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        clipPath: getClipPath(),
        transition: "clip-path 0.3s ease-out",
      }}
    />
  );
}
