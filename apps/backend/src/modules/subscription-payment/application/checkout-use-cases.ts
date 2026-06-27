import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import { PLAN_PRICES, PLAN_ENTITLEMENTS } from "@vcp/shared/contracts/plans.ts";
import type { 
  SubscriptionDetailsResponse, 
  WorkspaceResourceUsageResponse,
  ValidatePromoResponse
} from "@vcp/shared/contracts/subscription-payment.ts";
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
  agentRepository?: any;       // Kết nối chéo Agent
  documentRepository?: any;    // Kết nối chéo RAG
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

  // 1. Áp dụng & Xác thực mã giảm giá
  validatePromo(promoCode: string): ValidatePromoResponse {
    const code = promoCode.trim().toUpperCase();
    if (code === "VCP10") {
      return { success: true, discount: 10 };
    }
    if (code === "VCP20") {
      return { success: true, discount: 20 };
    }
    return {
      success: false,
      discount: 0,
      message: "Mã giảm giá không tồn tại hoặc đã hết hạn."
    };
  }

  // 2. Bật/Tắt tự động gia hạn
  async toggleAutoRenewal(
    userId: EntityId<"userId">,
    autoRenew: boolean
  ): Promise<Subscription> {
    const sub = await this.dependencies.repository.findSubscriptionByUserId(userId);
    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói đăng ký nào để cập nhật.");
    }

    const updatedSub: Subscription = {
      ...sub,
      autoRenew,
      updatedAt: this.dependencies.now()
    };

    await this.dependencies.repository.saveSubscription(updatedSub);
    return updatedSub;
  }

  // 3. Cập nhật phương thức thanh toán ảo
  async updatePaymentMethod(
    userId: EntityId<"userId">,
    cardDetails: { cardNumber: string; cardHolder: string; cardExpiry: string }
  ): Promise<Subscription> {
    const sub = await this.dependencies.repository.findSubscriptionByUserId(userId);
    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói đăng ký nào để cập nhật phương thức thanh toán.");
    }

    const updatedSub: Subscription = {
      ...sub,
      cardNumber: cardDetails.cardNumber,
      cardHolder: cardDetails.cardHolder,
      cardExpiry: cardDetails.cardExpiry,
      updatedAt: this.dependencies.now()
    };

    await this.dependencies.repository.saveSubscription(updatedSub);
    return updatedSub;
  }

  // 4. Lấy dữ liệu tài nguyên thực tế của Workspace qua API
  async getWorkspaceResourceUsage(
    workspaceId: EntityId<"workspaceId">,
    userId: EntityId<"userId">
  ): Promise<WorkspaceResourceUsageResponse> {
    const sub = await this.dependencies.repository.findSubscriptionByUserId(userId);
    const nowStr = this.dependencies.now();
    const isActive = sub ? isSubscriptionActive(sub, nowStr) : false;
    const plan = isActive && sub ? sub.plan : "none";

    // Lấy hạn mức quota theo plan
    const entitlements = PLAN_ENTITLEMENTS[plan as SubscriptionPlan] || {
      cpuCores: 2,
      memoryGb: 4,
      maxAgents: 2,
      maxDocuments: 10
    };

    // Đếm số agents thực tế của workspace từ AgentRepository
    let agentsUsed = 0;
    if (this.dependencies.agentRepository) {
      try {
        const list = await this.dependencies.agentRepository.listByWorkspace(workspaceId, { limit: 100, offset: 0 });
        agentsUsed = list.agents.filter((a: any) => a.status !== "deleted").length;
      } catch (e) {
        console.error("Lỗi khi đếm Agents của workspace:", e);
      }
    }

    // Đếm số documents thực tế từ KnowledgeDocumentRepository
    let docsUsed = 0;
    if (this.dependencies.documentRepository) {
      try {
        const docsResult = await this.dependencies.documentRepository.listDocuments(workspaceId);
        docsUsed = docsResult.total || docsResult.items.length;
      } catch (e) {
        console.error("Lỗi khi đếm Documents của workspace:", e);
      }
    }

    // Tính toán tài nguyên dựa trên active agents
    const cpuUsed = agentsUsed * 1;
    const ramUsed = agentsUsed * 2;
    const storageUsed = Number((docsUsed * 0.42).toFixed(2)); // 0.42 GB cho mỗi document

    const storageMax = plan === "premium" ? 500 : plan === "standard" ? 50 : 10;

    return {
      cpu: { used: Math.min(cpuUsed, entitlements.cpuCores), max: entitlements.cpuCores },
      ram: { used: Math.min(ramUsed, entitlements.memoryGb), max: entitlements.memoryGb },
      agents: { used: agentsUsed, max: entitlements.maxAgents },
      storage: { used: Math.min(storageUsed, storageMax), max: storageMax }
    };
  }

  async initiateCheckout(
    userId: EntityId<"userId">,
    plan: SubscriptionPlan,
    promoCode?: string
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
          return this.initiateUpgrade(userId, activeSub.subscriptionId, promoCode);
        }
        throw new CheckoutValidationError(`Bạn không thể hạ cấp gói dịch vụ khi gói hiện tại đang hoạt động.`);
      }
    }

    const subscriptionId = this.dependencies.generateSubscriptionId();
    const transactionId = this.dependencies.generateTransactionId();
    
    // Áp dụng giảm giá
    const baseAmount = PLAN_PRICES[plan];
    let discount = 0;
    if (promoCode) {
      const promo = this.validatePromo(promoCode);
      if (promo.success) {
        discount = promo.discount;
      }
    }
    const amount = Math.max(0, baseAmount - discount);

    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subscription: Subscription = {
      subscriptionId,
      userId,
      workspaceId: null,
      plan,
      status: "pending",
      expiresAt,
      createdAt: nowStr,
      updatedAt: nowStr,
      autoRenew: true,
      cardNumber: null,
      cardHolder: null,
      cardExpiry: null
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
    subscriptionId: EntityId<"subscriptionId">,
    promoCode?: string
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
    
    // Áp dụng giảm giá nâng cấp
    const premiumPrice = PLAN_PRICES["premium"];
    const standardPrice = PLAN_PRICES["standard"];
    const baseUpgradeAmount = premiumPrice - standardPrice; // Phí nâng cấp ($50)
    let discount = 0;
    if (promoCode) {
      const promo = this.validatePromo(promoCode);
      if (promo.success) {
        discount = promo.discount;
      }
    }
    const upgradeAmount = Math.max(0, baseUpgradeAmount - discount);

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
      // Bất kỳ giao dịch thành công nào được kích hoạt khi gói hiện tại đang là Standard
      // và trạng thái là active thì được tính là nâng cấp lên Premium.
      const isUpgrade = sub.plan === "standard" && sub.status === "active";
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
