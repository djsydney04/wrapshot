export const TEAM_MEMBER_MONTHLY_PRICE_CENTS = 500;

export function getTeamMonthlyCostCents(memberCount: number): number {
  return Math.max(0, memberCount) * TEAM_MEMBER_MONTHLY_PRICE_CENTS;
}

