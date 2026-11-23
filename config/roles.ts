export const ROLES = ['DEFAULT', 'BUYER', 'MORTGAGE', 'ONBOARDING'] as const;
export type Role = (typeof ROLES)[number];
