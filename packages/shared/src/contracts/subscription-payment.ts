import type { SubscriptionPlan } from "./plans.ts";
import type { SubscriptionStatus } from "./statuses.ts";

export type SubscriptionPublicSummary = {
  subscriptionId: string;
  userId: string;
  workspaceId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionPublicSummary = {
  transactionId: string;
  subscriptionId: string;
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
