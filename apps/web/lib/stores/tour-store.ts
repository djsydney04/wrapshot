import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TourState {
  isActive: boolean;
  currentStepIndex: number;
  hasCompletedTour: boolean;

  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentStepIndex: 0,
      hasCompletedTour: false,

      startTour: () => {
        set({ isActive: true, currentStepIndex: 0 });
      },

      nextStep: () => {
        set((state) => ({ currentStepIndex: state.currentStepIndex + 1 }));
      },

      prevStep: () => {
        set((state) => ({
          currentStepIndex: Math.max(0, state.currentStepIndex - 1),
        }));
      },

      skipTour: () => {
        set({ isActive: false, currentStepIndex: 0, hasCompletedTour: true });
      },

      completeTour: () => {
        set({ isActive: false, currentStepIndex: 0, hasCompletedTour: true });
      },

      resetTour: () => {
        set({ isActive: false, currentStepIndex: 0, hasCompletedTour: false });
      },
    }),
    {
      name: "tour-store",
      partialize: (state) => ({ hasCompletedTour: state.hasCompletedTour }),
    }
  )
);
