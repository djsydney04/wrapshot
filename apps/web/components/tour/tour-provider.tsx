"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTourStore } from "@/lib/stores/tour-store";
import { TOUR_STEPS } from "./tour-steps";
import { TourOverlay } from "./tour-overlay";
import { TourTooltip } from "./tour-tooltip";
import { completeTour as completeTourAction } from "@/lib/actions/onboarding";

interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    isActive,
    currentStepIndex,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
  } = useTourStore();

  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

  // Check for tour query param
  React.useEffect(() => {
    if (searchParams.get("tour") === "1" || searchParams.get("startTour") === "true") {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour();
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete("tour");
        url.searchParams.delete("startTour");
        window.history.replaceState({}, "", url.toString());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, startTour]);

  // Update target rect when step changes
  React.useEffect(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }

    const step = TOUR_STEPS[currentStepIndex];
    if (!step) {
      handleComplete();
      return;
    }

    const findTarget = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      } else {
        setTargetRect(null);
      }
    };

    // Initial find
    findTarget();

    // Watch for layout changes
    const observer = new ResizeObserver(findTarget);
    const element = document.querySelector(step.target);
    if (element) {
      observer.observe(element);
    }

    // Also update on scroll
    window.addEventListener("scroll", findTarget, true);
    window.addEventListener("resize", findTarget);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", findTarget, true);
      window.removeEventListener("resize", findTarget);
    };
  }, [isActive, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      nextStep();
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    prevStep();
  };

  const handleSkip = async () => {
    skipTour();
    try {
      await completeTourAction();
    } catch (error) {
      console.error("Failed to save tour completion:", error);
    }
  };

  const handleComplete = async () => {
    completeTour();
    try {
      await completeTourAction();
    } catch (error) {
      console.error("Failed to save tour completion:", error);
    }
  };

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {children}

      {isActive && currentStep && (
        <>
          <TourOverlay targetRect={targetRect} />
          <TourTooltip
            step={currentStep}
            targetRect={targetRect}
            stepNumber={currentStepIndex + 1}
            totalSteps={TOUR_STEPS.length}
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={handleSkip}
            isFirst={isFirstStep}
            isLast={isLastStep}
          />
        </>
      )}
    </>
  );
}
