import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { PLAN_PRICES } from "@vcp/shared/contracts/plans.ts";
import type { SubscriptionDetailsResponse } from "@vcp/shared/contracts/subscription-payment.ts";
import type { SubscriptionRepository } from "./subscription-repository.ts";
import type { MockPaymentAdapter } from "../infrastructure/mock-payment-adapter.ts";
import {
  createSubscription,
  isSubscriptionActive,
  toSubscriptionPublicSummary,
  toTransactionPublicSummary,
  type Subscription,
  type Transaction
} from "../domain/subscription.ts";

export interface EventBus {
  publish(event: any): Promise<void>;
}

export interface JobQueue {
  enqueue(name: string, payload: Record<string, unknown>): Promise<any>;
}

export type CheckoutUseCasesDependencies = {
  repository: SubscriptionRepository;
  paymentAdapter: MockPaymentAdapter;
  eventBus: EventBus;
  jobQueue?: JobQueue;
  now: () => string;
  generateSubscriptionId: () => EntityId<"subscriptionId">;
  generateTransactionId: () => EntityId<"transactionId">;
  generateEventId: () => EntityId<"eventId">;
};

export class CheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutValidationError";
  }
}

export class CheckoutNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutNotFoundError";
  }
}

export class CheckoutUseCases {
  private readonly dependencies: CheckoutUseCasesDependencies;

  constructor(dependencies: CheckoutUseCasesDependencies) {
    this.dependencies = dependencies;
  }

  async initiateCheckout(
    userId: EntityId<"userId">,
    plan: SubscriptionPlan
  ): Promise<{ checkoutUrl: string; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
        const activeSub = await this.dependencies.repository.findSubscriptionByUserId(userId);
    const nowStr = this.dependencies.now();

    if (activeSub) {
      const isActive = isSubscriptionActive(activeSub, nowStr);
      const isPending = activeSub.status === "pending";

      if (isActive || isPending) {
        if (activeSub.plan === plan) {
          throw new CheckoutValidationError(`Bạn đã có một gói ${plan} đang hoạt động hoặc đang chờ thanh toán.`);
        }
        if (activeSub.plan === "standard" && plan === "premium") {
          return this.initiateUpgrade(userId, activeSub.subscriptionId);
        }
        throw new CheckoutValidationError(`Bạn không thể hạ cấp gói dịch vụ khi gói hiện tại đang hoạt động.`);
      }
    }

    const subscriptionId = this.dependencies.generateSubscriptionId();
    const transactionId = this.dependencies.generateTransactionId();
    const amount = PLAN_PRICES[plan];

    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subscription: Subscription = {
      subscriptionId,
      userId,
      workspaceId: null,
      plan,
      status: "pending",
      expiresAt,
      createdAt: nowStr,
      updatedAt: nowStr
    };

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount,
      currency: "USD",
      status: "pending",
      createdAt: nowStr,
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveSubscription(subscription);
    await this.dependencies.repository.saveTransaction(transaction);

    const session = await this.dependencies.paymentAdapter.createCheckoutSession(
      transactionId,
      plan,
      amount
    );

    return {
      checkoutUrl: session.checkoutUrl,
      subscriptionId,
      transactionId
    };
  }

  async initiateUpgrade(
    userId: EntityId<"userId">,
    subscriptionId: EntityId<"subscriptionId">
  ): Promise<{ checkoutUrl: string; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
    const sub = await this.dependencies.repository.findSubscriptionById(subscriptionId);

    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói dịch vụ để nâng cấp.");
    }

    if (sub.plan !== "standard") {
      throw new CheckoutValidationError("Chỉ hỗ trợ nâng cấp từ gói Standard lên Premium.");
    }

    const nowStr = this.dependencies.now();
    if (!isSubscriptionActive(sub, nowStr)) {
      throw new CheckoutValidationError("Gói Standard của bạn đã hết hạn, vui lòng mua gói mới thay vì nâng cấp.");
    }

    const transactionId = this.dependencies.generateTransactionId();
    const premiumPrice = PLAN_PRICES["premium"];
    const standardPrice = PLAN_PRICES["standard"];
    const upgradeAmount = premiumPrice - standardPrice; // Phí nâng cấp chênh lệch

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount: upgradeAmount,
      currency: "USD",
      status: "pending",
      createdAt: nowStr,
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveTransaction(transaction);

    const session = await this.dependencies.paymentAdapter.createCheckoutSession(
      transactionId,
      "premium",
      upgradeAmount
    );

    return {
      checkoutUrl: session.checkoutUrl,
      subscriptionId,
      transactionId
    };
  }

  async reconcilePayment(
    transactionId: EntityId<"transactionId">,
    status: "success" | "failed"
  ): Promise<Transaction> {
    const tx = await this.dependencies.repository.findTransactionById(transactionId);
    if (!tx) {
      throw new CheckoutNotFoundError(`Không tìm thấy giao dịch: ${transactionId}`);
    }

    if (tx.status !== "pending") {
      return tx; // Trả về nếu đã đối soát rồi (idempotent)
    }

    const nowStr = this.dependencies.now();
    const updatedTx: Transaction = {
      ...tx,
      status,
      updatedAt: nowStr
    };
    await this.dependencies.repository.saveTransaction(updatedTx);

    const sub = await this.dependencies.repository.findSubscriptionById(tx.subscriptionId);
    if (!sub) {
      throw new CheckoutNotFoundError(`Không tìm thấy gói dịch vụ cho giao dịch: ${tx.subscriptionId}`);
    }

    if (status === "success") {
      const isUpgrade = tx.amount === (PLAN_PRICES["premium"] - PLAN_PRICES["standard"]);
      let fromPlan = sub.plan;
      let toPlan = sub.plan;
      let updatedSub: Subscription;

      if (isUpgrade && sub.plan === "standard") {
        toPlan = "premium";
        updatedSub = {
          ...sub,
          plan: "premium",
          status: "active",
          expiresAt: new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: nowStr
        };

        await this.dependencies.repository.saveSubscription(updatedSub);

        // Bắn event subscription.upgraded
        await this.dependencies.eventBus.publish({
          name: "subscription.upgraded",
          eventId: this.dependencies.generateEventId(),
          occurredAt: nowStr,
          payload: {
            userId: sub.userId,
            subscriptionId: sub.subscriptionId,
            fromPlan,
            toPlan
          }
        });
      } else {
        updatedSub = {
          ...sub,
          status: "active",
          expiresAt: new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: nowStr
        };

        await this.dependencies.repository.saveSubscription(updatedSub);

        // Bắn event subscription.activated
        await this.dependencies.eventBus.publish({
          name: "subscription.activated",
          eventId: this.dependencies.generateEventId(),
          occurredAt: nowStr,
          payload: {
            userId: sub.userId,
            subscriptionId: sub.subscriptionId,
            plan: sub.plan
          }
        });
      }
    } else {
      // Thanh toán thất bại, không kích hoạt gói mới (hoặc giữ nguyên nếu đã active)
      if (sub.status === "pending") {
        const updatedSub: Subscription = {
          ...sub,
          status: "cancelled",
          updatedAt: nowStr
        };
        await this.dependencies.repository.saveSubscription(updatedSub);
      }
    }

    return updatedTx;
  }

  async getSubscriptionDetails(userId: EntityId<"userId">): Promise<SubscriptionDetailsResponse> {
    const sub = await this.dependencies.repository.findSubscriptionByUserId(userId);
    if (!sub) {
      return { subscription: null, transactions: [] };
    }

    const txs = await this.dependencies.repository.listTransactionsBySubscriptionId(sub.subscriptionId);

    return {
      subscription: toSubscriptionPublicSummary(sub),
      transactions: txs.map(toTransactionPublicSummary)
    };
  }
}
