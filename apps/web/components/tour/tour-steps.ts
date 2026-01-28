export interface TourStep {
  target: string; // CSS selector or data-tour attribute
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: "Welcome to Your Dashboard",
    description:
      "This is your home base. See upcoming shoots, track progress, and access quick actions all in one place.",
    position: "right",
  },
  {
    target: '[data-tour="projects"]',
    title: "Your Projects",
    description:
      "Manage all your productions here. Each project contains scenes, cast, crew, and shooting schedules.",
    position: "right",
  },
  {
    target: '[data-tour="schedule"]',
    title: "Production Schedule",
    description:
      "Plan shooting days, assign scenes, and generate call sheets. Your calendar for everything production.",
    position: "right",
  },
  {
    target: '[data-tour="command-palette"]',
    title: "Quick Actions",
    description:
      "Press ⌘K (or Ctrl+K) anytime to search, navigate, or take quick actions. It's the fastest way to get things done.",
    position: "bottom",
  },
];
