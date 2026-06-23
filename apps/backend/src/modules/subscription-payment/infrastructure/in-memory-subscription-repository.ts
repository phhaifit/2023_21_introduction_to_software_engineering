import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Subscription, Transaction } from "../domain/subscription.ts";
import type { SubscriptionRepository } from "../application/subscription-repository.ts";

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly transactions = new Map<string, Transaction>();

  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    this.subscriptions.set(subscription.subscriptionId, subscription);
    return subscription;
  }

  async findSubscriptionById(subscriptionId: EntityId<"subscriptionId">): Promise<Subscription | null> {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  async findSubscriptionByUserId(userId: EntityId<"userId">): Promise<Subscription | null> {
    const list = Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list[0] ?? null;
  }

  async findSubscriptionByWorkspaceId(workspaceId: EntityId<"workspaceId">): Promise<Subscription | null> {
    const list = Array.from(this.subscriptions.values())
      .filter(s => s.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list[0] ?? null;
  }

  async saveTransaction(transaction: Transaction): Promise<Transaction> {
    this.transactions.set(transaction.transactionId, transaction);
    return transaction;
  }

  async findTransactionById(transactionId: EntityId<"transactionId">): Promise<Transaction | null> {
    return this.transactions.get(transactionId) ?? null;
  }

  async listTransactionsBySubscriptionId(subscriptionId: EntityId<"subscriptionId">): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
