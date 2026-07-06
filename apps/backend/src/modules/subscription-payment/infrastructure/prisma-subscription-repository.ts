import type { PrismaClient } from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { SubscriptionStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Subscription, Transaction } from "../domain/subscription.ts";
import type { PromoCode } from "../domain/promo-code.ts";
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
      autoRenew: subscription.autoRenew
    };

    const record = await this.prisma.subscription.upsert({
      where: { subscriptionId: data.subscriptionId },
      create: data,
      update: data
    });

    // PCI-DSS Compliance: Lưu trữ thẻ tokenized vào bảng PaymentMethod thay vì bảng Subscription
    if (subscription.cardNumber && subscription.workspaceId) {
      const last4 = subscription.cardNumber.slice(-4);
      const isDefault = true;

      // Tìm xem đã có payment method cho thẻ này chưa để tránh duplicates
      const existingPm = await this.prisma.paymentMethod.findFirst({
        where: { workspaceId: subscription.workspaceId, last4, type: "card" }
      });

      if (existingPm) {
        await this.prisma.paymentMethod.update({
          where: { id: existingPm.id },
          data: {
            holder: subscription.cardHolder || "",
            isDefault,
            updatedAt: subscription.updatedAt
          }
        });
      } else {
        // Tạo mới PaymentMethod tokenized
        await this.prisma.paymentMethod.create({
          data: {
            workspaceId: subscription.workspaceId,
            type: "card",
            brand: "visa",
            last4,
            holder: subscription.cardHolder || "",
            isDefault,
            gatewayToken: "mock-gateway-token-" + subscription.subscriptionId,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt
          }
        });
      }
    }

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
      cardNumber: subscription.cardNumber,
      cardHolder: subscription.cardHolder,
      cardExpiry: subscription.cardExpiry
    };
  }

  private async enrichSubscriptionPaymentMethod(record: any): Promise<Subscription> {
    let cardNumber: string | null = null;
    let cardHolder: string | null = null;
    let cardExpiry: string | null = null;

    if (record.workspaceId) {
      const pm = await this.prisma.paymentMethod.findFirst({
        where: { workspaceId: record.workspaceId, isDefault: true }
      });
      if (pm) {
        cardNumber = "**** **** **** " + pm.last4;
        cardHolder = pm.holder;
        cardExpiry = "12/29";
      }
    }

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
      cardNumber,
      cardHolder,
      cardExpiry
    };
  }

  async findSubscriptionById(subscriptionId: EntityId<"subscriptionId">): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findUnique({
      where: { subscriptionId }
    });

    if (!record) return null;

    return this.enrichSubscriptionPaymentMethod(record);
  }

  async findSubscriptionByUserId(userId: EntityId<"userId">): Promise<Subscription | null> {
    const record = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    if (!record) return null;

    return this.enrichSubscriptionPaymentMethod(record);
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

    return this.enrichSubscriptionPaymentMethod(record);
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

  async findPromoCodeByCode(code: string): Promise<PromoCode | null> {
    const record = await this.prisma.promoCode.findUnique({
      where: { code: code.trim().toUpperCase() }
    });

    if (!record) return null;

    return {
      promoCodeId: record.promoCodeId as EntityId<"promoCodeId">,
      code: record.code,
      discountAmount: record.discountAmount,
      validFrom: record.validFrom,
      validUntil: record.validUntil,
      maxUsages: record.maxUsages,
      currentUsages: record.currentUsages,
      status: record.status as "active" | "expired" | "disabled",
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async savePromoCode(promo: PromoCode): Promise<PromoCode> {
    const data = {
      promoCodeId: promo.promoCodeId,
      code: promo.code.toUpperCase(),
      discountAmount: promo.discountAmount,
      validFrom: promo.validFrom,
      validUntil: promo.validUntil,
      maxUsages: promo.maxUsages,
      currentUsages: promo.currentUsages,
      status: promo.status,
      createdAt: promo.createdAt,
      updatedAt: promo.updatedAt
    };

    await this.prisma.promoCode.upsert({
      where: { promoCodeId: data.promoCodeId },
      create: data,
      update: data
    });

    return promo;
  }
}
