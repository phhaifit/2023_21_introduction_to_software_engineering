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
