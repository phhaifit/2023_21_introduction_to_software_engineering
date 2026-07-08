import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Subscription, Transaction } from "../domain/subscription.ts";
import type { PromoCode } from "../domain/promo-code.ts";
import type { SubscriptionRepository } from "../application/subscription-repository.ts";

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly transactions = new Map<string, Transaction>();
  private readonly promoCodes = new Map<string, PromoCode>();

  constructor() {
    // Seed các promo code mặc định để backward-compatible
    const now = new Date().toISOString();
    const farFuture = "2099-12-31T23:59:59.000Z";

    this.promoCodes.set("VCP10", {
      promoCodeId: "promo-vcp10" as EntityId<"promoCodeId">,
      code: "VCP10",
      discountAmount: 10,
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: farFuture,
      maxUsages: 0,
      currentUsages: 0,
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    this.promoCodes.set("VCP20", {
      promoCodeId: "promo-vcp20" as EntityId<"promoCodeId">,
      code: "VCP20",
      discountAmount: 20,
      validFrom: "2020-01-01T00:00:00.000Z",
      validUntil: farFuture,
      maxUsages: 0,
      currentUsages: 0,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }

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
      .filter(s => s.workspaceId === workspaceId);
    
    const activeList = list.filter(s => s.status === "active" || s.status === "expiring_soon")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (activeList.length > 0) return activeList[0];

    const anyList = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return anyList[0] ?? null;
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

  async findPromoCodeByCode(code: string): Promise<PromoCode | null> {
    return this.promoCodes.get(code.trim().toUpperCase()) ?? null;
  }

  async savePromoCode(promo: PromoCode): Promise<PromoCode> {
    this.promoCodes.set(promo.code.toUpperCase(), promo);
    return promo;
  }
}
