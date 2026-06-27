export const SUBSCRIPTION_PLANS = ["free", "standard", "premium"] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export type ResourceEntitlement = {
  cpuCores: number;
  memoryGb: number;
  maxAgents: number;
  maxDocuments: number;
  maxStorageGb: number;
};

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, ResourceEntitlement> = {
  free: {
    cpuCores: 2,
    memoryGb: 4,
    maxAgents: 2,
    maxDocuments: 10,
    maxStorageGb: 10
  },
  standard: {
    cpuCores: 8,
    memoryGb: 16,
    maxAgents: 10,
    maxDocuments: 100,
    maxStorageGb: 50
  },
  premium: {
    cpuCores: 32,
    memoryGb: 64,
    maxAgents: 50,
    maxDocuments: 1000,
    maxStorageGb: 500
  }
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  standard: 29,
  premium: 79
};


