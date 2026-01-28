export type PlanType = "FREE" | "PRO" | "STUDIO";

export interface PlanConfig {
  id: PlanType;
  name: string;
  description: string;
  priceMonthly: number;
  stripePriceId: string | null;
  features: string[];
  limits: {
    projects: number;
    teamMembers: number;
    historyDays: number;
    callSheets: boolean;
    apiAccess: boolean;
  };
}

export const PLANS: Record<PlanType, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "For individuals getting started",
    priceMonthly: 0,
    stripePriceId: null,
    features: [
      "1 project",
      "3 team members",
      "Basic scheduling",
      "7-day history",
    ],
    limits: {
      projects: 1,
      teamMembers: 3,
      historyDays: 7,
      callSheets: false,
      apiAccess: false,
    },
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "For growing production teams",
    priceMonthly: 29,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    features: [
      "Unlimited projects",
      "25 team members",
      "Advanced scheduling",
      "Call sheet generation",
      "30-day history",
    ],
    limits: {
      projects: -1, // unlimited
      teamMembers: 25,
      historyDays: 30,
      callSheets: true,
      apiAccess: false,
    },
  },
  STUDIO: {
    id: "STUDIO",
    name: "Studio",
    description: "For large productions",
    priceMonthly: 99,
    stripePriceId: process.env.STRIPE_STUDIO_PRICE_ID || null,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Priority support",
      "Custom integrations",
      "Unlimited history",
      "API access",
    ],
    limits: {
      projects: -1, // unlimited
      teamMembers: -1, // unlimited
      historyDays: -1, // unlimited
      callSheets: true,
      apiAccess: true,
    },
  },
};

export function getPlanById(planId: PlanType): PlanConfig {
  return PLANS[planId] || PLANS.FREE;
}

export function canUpgrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
  const planOrder: PlanType[] = ["FREE", "PRO", "STUDIO"];
  return planOrder.indexOf(targetPlan) > planOrder.indexOf(currentPlan);
}

export function canDowngrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
  const planOrder: PlanType[] = ["FREE", "PRO", "STUDIO"];
  return planOrder.indexOf(targetPlan) < planOrder.indexOf(currentPlan);
}

// Check if organization is within plan limits
export function checkPlanLimit(
  plan: PlanType,
  resource: "projects" | "teamMembers",
  currentCount: number
): { allowed: boolean; limit: number; remaining: number } {
  const config = PLANS[plan];
  const limit = config.limits[resource];

  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1 };
  }

  return {
    allowed: currentCount < limit,
    limit,
    remaining: Math.max(0, limit - currentCount),
  };
}

// Trial duration in days
export const TRIAL_DURATION_DAYS = 14;
