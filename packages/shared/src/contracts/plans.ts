export const SUBSCRIPTION_PLANS = ["standard", "premium"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export type ResourceEntitlement = {
  cpuCores: number;
  memoryGb: number;
  maxAgents: number;
  maxDocuments: number;
};

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, ResourceEntitlement> = {
  standard: {
    cpuCores: 2,
    memoryGb: 4,
    maxAgents: 10,
    maxDocuments: 100
  },
  premium: {
    cpuCores: 4,
    memoryGb: 8,
    maxAgents: 30,
    maxDocuments: 1000
  }
};
