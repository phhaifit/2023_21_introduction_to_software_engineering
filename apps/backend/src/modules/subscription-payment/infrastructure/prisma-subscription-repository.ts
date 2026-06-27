import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { SubscriptionStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Subscription, Transaction } from "../domain/subscription.ts";
import type { SubscriptionRepository } from "../application/subscription-repository.ts";

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async saveSubscription(subscription: Subscription): Promise<Subscription> {
    const data = {
      subscriptionId: subscription.subscriptionId,
      userId: subscription.userId,
      workspaceId: subscription.workspaceId,
      plan: subscription.plan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      autoRenew: subscription.autoRenew,
      cardNumber: subscription.cardNumber,
      cardHolder: subscription.cardHolder,
      cardExpiry: subscription.cardExpiry
    };

    const record = await this.prisma.subscription.upsert({
      where: { subscriptionId: data.subscriptionId },
      create: data,
      update: data
    });

    return {
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      userId: record.userId as EntityId<"userId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId"> | null,
      plan: record.plan as SubscriptionPlan,
      status: record.status as SubscriptionStatus,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      autoRenew: record.autoRenew ?? true,
      cardNumber: record.cardNumber,
      cardHolder: record.cardHolder,
      cardExpiry: record.cardExpiry
    };
  }

  async findSubscriptionById(subscriptionId: EntityId<"subscriptionId">): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findUnique({
      where: { subscriptionId }
    });

    if (!record) return null;

    return {
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      userId: record.userId as EntityId<"userId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId"> | null,
      plan: record.plan as SubscriptionPlan,
      status: record.status as SubscriptionStatus,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      autoRenew: record.autoRenew ?? true,
      cardNumber: record.cardNumber,
      cardHolder: record.cardHolder,
      cardExpiry: record.cardExpiry
    };
  }

  async findSubscriptionByUserId(userId: EntityId<"userId">): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    if (!record) return null;

    return {
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      userId: record.userId as EntityId<"userId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId"> | null,
      plan: record.plan as SubscriptionPlan,
      status: record.status as SubscriptionStatus,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      autoRenew: record.autoRenew ?? true,
      cardNumber: record.cardNumber,
      cardHolder: record.cardHolder,
      cardExpiry: record.cardExpiry
    };
  }

  async findSubscriptionByWorkspaceId(workspaceId: EntityId<"workspaceId">): Promise<Subscription | null> {
    // 1. Tìm gói active hoặc expiring_soon trước
    let record = await this.prisma.subscription.findFirst({
      where: { 
        workspaceId,
        status: { in: ["active", "expiring_soon"] }
      },
      orderBy: { createdAt: "desc" }
    });

    // 2. Nếu không có gói nào đang hoạt động, lấy gói mới nhất bất kỳ
    if (!record) {
      record = await this.prisma.subscription.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "desc" }
      });
    }

    if (!record) return null;

    return {
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      userId: record.userId as EntityId<"userId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId"> | null,
      plan: record.plan as SubscriptionPlan,
      status: record.status as SubscriptionStatus,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      autoRenew: record.autoRenew ?? true,
      cardNumber: record.cardNumber,
      cardHolder: record.cardHolder,
      cardExpiry: record.cardExpiry
    };
  }

  async saveTransaction(transaction: Transaction): Promise<Transaction> {
    const data = {
      transactionId: transaction.transactionId,
      subscriptionId: transaction.subscriptionId,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    };

    const record = await this.prisma.transaction.upsert({
      where: { transactionId: data.transactionId },
      create: data,
      update: data
    });

    return {
      transactionId: record.transactionId as EntityId<"transactionId">,
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      amount: record.amount,
      currency: record.currency,
      status: record.status as "pending" | "success" | "failed",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async findTransactionById(transactionId: EntityId<"transactionId">): Promise<Transaction | null> {
    const record = await this.prisma.transaction.findUnique({
      where: { transactionId }
    });

    if (!record) return null;

    return {
      transactionId: record.transactionId as EntityId<"transactionId">,
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      amount: record.amount,
      currency: record.currency,
      status: record.status as "pending" | "success" | "failed",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async listTransactionsBySubscriptionId(subscriptionId: EntityId<"subscriptionId">): Promise<Transaction[]> {
    const records = await this.prisma.transaction.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" }
    });

    return records.map(record => ({
      transactionId: record.transactionId as EntityId<"transactionId">,
      subscriptionId: record.subscriptionId as EntityId<"subscriptionId">,
      amount: record.amount,
      currency: record.currency,
      status: record.status as "pending" | "success" | "failed",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));
  }
}
