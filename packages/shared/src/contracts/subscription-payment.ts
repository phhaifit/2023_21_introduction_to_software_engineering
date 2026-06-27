import type { EntityId } from "./ids.ts";
import type { SubscriptionPlan } from "./plans.ts";
import type { SubscriptionStatus } from "./statuses.ts";

export type SubscriptionPublicSummary = {
  subscriptionId: EntityId<"subscriptionId">;
  userId: EntityId<"userId">;
  workspaceId: EntityId<"workspaceId"> | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  autoRenew: boolean;
  cardNumber: string | null;
  cardHolder: string | null;
  cardExpiry: string | null;
};

export type TransactionPublicSummary = {
  transactionId: EntityId<"transactionId">;
  subscriptionId: EntityId<"subscriptionId">;
  amount: number;
  currency: string;
  status: string; // "pending" | "success" | "failed"
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionDetailsResponse = {
  subscription: SubscriptionPublicSummary | null;
  transactions: TransactionPublicSummary[];
};

export type ResourceUsageItem = {
  used: number;
  max: number;
};

export type WorkspaceResourceUsageResponse = {
  cpu: ResourceUsageItem;
  ram: ResourceUsageItem;
  agents: ResourceUsageItem;
  storage: ResourceUsageItem;
};

export type ValidatePromoResponse = {
  success: boolean;
  discount: number;
  message?: string;
};

export type PlanDetails = {
  price: number;
  entitlements: {
    cpuCores: number;
    memoryGb: number;
    maxAgents: number;
    maxDocuments: number;
  };
};

export type SubscriptionPlansResponse = {
  free: PlanDetails;
  standard: PlanDetails;
  premium: PlanDetails;
};


