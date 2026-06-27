import type { SubscriptionPublicSummary, TransactionPublicSummary } from "@vcp/shared/contracts/subscription-payment.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { SubscriptionStatus } from "@vcp/shared/contracts/statuses.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type Subscription = {
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

export type Transaction = {
  transactionId: EntityId<"transactionId">;
  subscriptionId: EntityId<"subscriptionId">;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed";
  createdAt: string;
  updatedAt: string;
};

export function createSubscription(draft: Omit<Subscription, "status" | "createdAt" | "updatedAt" | "autoRenew" | "cardNumber" | "cardHolder" | "cardExpiry"> & { createdAt: string }): Subscription {
  return {
    ...draft,
    status: "pending",
    autoRenew: true,
    cardNumber: null,
    cardHolder: null,
    cardExpiry: null,
    createdAt: draft.createdAt,
    updatedAt: draft.createdAt
  };
}

export function isSubscriptionActive(sub: Pick<Subscription, "status" | "expiresAt">, nowStr: string): boolean {
  if (sub.status !== "active" && sub.status !== "expiring_soon") {
    return false;
  }
  return new Date(sub.expiresAt) > new Date(nowStr);
}

export function toSubscriptionPublicSummary(sub: Subscription): SubscriptionPublicSummary {
  return {
    subscriptionId: sub.subscriptionId,
    userId: sub.userId,
    workspaceId: sub.workspaceId,
    plan: sub.plan,
    status: sub.status,
    expiresAt: sub.expiresAt,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    autoRenew: sub.autoRenew,
    cardNumber: sub.cardNumber,
    cardHolder: sub.cardHolder,
    cardExpiry: sub.cardExpiry
  };
}

export function toTransactionPublicSummary(tx: Transaction): TransactionPublicSummary {
  return {
    transactionId: tx.transactionId,
    subscriptionId: tx.subscriptionId,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt
  };
}
