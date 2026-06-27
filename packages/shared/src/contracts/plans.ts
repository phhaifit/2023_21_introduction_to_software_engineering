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
    cpuCores: 8,
    memoryGb: 16,
    maxAgents: 10,
    maxDocuments: 100
  },
  premium: {
    cpuCores: 32,
    memoryGb: 64,
    maxAgents: 50,
    maxDocuments: 1000
  }
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  standard: 29,
  premium: 79
};


