import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Subscription, Transaction } from "../domain/subscription.ts";

export interface SubscriptionRepository {
  saveSubscription(subscription: Subscription): Promise<Subscription>;
  findSubscriptionById(subscriptionId: EntityId<"subscriptionId">): Promise<Subscription | null>;
  findSubscriptionByUserId(userId: EntityId<"userId">): Promise<Subscription | null>;
  findSubscriptionByWorkspaceId(workspaceId: EntityId<"workspaceId">): Promise<Subscription | null>;
  
  saveTransaction(transaction: Transaction): Promise<Transaction>;
  findTransactionById(transactionId: EntityId<"transactionId">): Promise<Transaction | null>;
  listTransactionsBySubscriptionId(subscriptionId: EntityId<"subscriptionId">): Promise<Transaction[]>;
}
