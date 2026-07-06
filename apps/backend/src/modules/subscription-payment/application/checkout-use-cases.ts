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
import { VnPayAdapter } from "../infrastructure/vnpay-adapter.ts";
import { StripeAdapter } from "../infrastructure/stripe-adapter.ts";
import {
  createSubscription,
  isSubscriptionActive,
  toSubscriptionPublicSummary,
  toTransactionPublicSummary,
  calculateProratedUpgradeAmount,
  type Subscription,
  type Transaction
} from "../domain/subscription.ts";
import { isPromoCodeValid } from "../domain/promo-code.ts";

export interface EventBus {
  publish(event: any): Promise<void>;
}

export interface JobQueue {
  enqueue(name: string, payload: Record<string, unknown>): Promise<any>;
}

export type CheckoutUseCasesDependencies = {
  repository: SubscriptionRepository;
  paymentAdapter: MockPaymentAdapter;
  vnpayAdapter?: VnPayAdapter;
  stripeAdapter?: StripeAdapter;
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
  private readonly vnpayAdapter: VnPayAdapter;
  private readonly stripeAdapter: StripeAdapter;

  constructor(dependencies: CheckoutUseCasesDependencies) {
    this.dependencies = dependencies;
    this.vnpayAdapter = dependencies.vnpayAdapter || new VnPayAdapter();
    this.stripeAdapter = dependencies.stripeAdapter || new StripeAdapter(
      process.env.STRIPE_SECRET_KEY || "sk_test_mock_key",
      process.env.FRONTEND_URL || "http://127.0.0.1:5173"
    );
  }

  // 1. Áp dụng & Xác thực mã giảm giá (async - query từ database)
  async validatePromo(promoCode: string): Promise<ValidatePromoResponse> {
    const promo = await this.dependencies.repository.findPromoCodeByCode(promoCode);
    if (!promo) {
      return {
        success: false,
        discount: 0,
        message: "Mã giảm giá không tồn tại hoặc đã hết hạn."
      };
    }

    const nowStr = this.dependencies.now();
    if (!isPromoCodeValid(promo, nowStr)) {
      return {
        success: false,
        discount: 0,
        message: "Mã giảm giá đã hết hạn hoặc đã hết lượt sử dụng."
      };
    }

    return { success: true, discount: promo.discountAmount };
  }

  // Helper: Áp dụng promo code và tăng usage counter
  private async applyPromoDiscount(promoCode: string | undefined): Promise<number> {
    if (!promoCode) return 0;
    const promo = await this.dependencies.repository.findPromoCodeByCode(promoCode);
    if (!promo) return 0;

    const nowStr = this.dependencies.now();
    if (!isPromoCodeValid(promo, nowStr)) return 0;

    // Tăng currentUsages
    await this.dependencies.repository.savePromoCode({
      ...promo,
      currentUsages: promo.currentUsages + 1,
      updatedAt: nowStr
    });

    return promo.discountAmount;
  }

  // 2. Bật/Tắt tự động gia hạn theo Workspace
  async toggleAutoRenewal(
    workspaceId: EntityId<"workspaceId">,
    autoRenew: boolean
  ): Promise<Subscription> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói đăng ký nào của Workspace để cập nhật.");
    }

    const updatedSub: Subscription = {
      ...sub,
      autoRenew,
      updatedAt: this.dependencies.now()
    };

    await this.dependencies.repository.saveSubscription(updatedSub);
    return updatedSub;
  }

  // 3. Cập nhật phương thức thanh toán ảo theo Workspace
  async updatePaymentMethod(
    workspaceId: EntityId<"workspaceId">,
    cardDetails: { cardNumber: string; cardHolder: string; cardExpiry: string }
  ): Promise<Subscription> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói đăng ký nào của Workspace để cập nhật phương thức thanh toán.");
    }

    const nowStr = this.dependencies.now();
    
    // Đồng bộ tạo bản ghi trong bảng paymentMethod nếu có Prisma
    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      const rawNum = cardDetails.cardNumber.replace(/\s/g, "");
      const isMomo = cardDetails.cardNumber.toLowerCase().includes("momo");
      const isVnpay = cardDetails.cardNumber.toLowerCase().includes("vnpay") || rawNum.startsWith("9704");
      const type = isMomo ? "momo" : isVnpay ? "vnpay" : "card";
      const brand = isVnpay ? "ncb" : isMomo ? undefined : "Visa";
      const last4 = rawNum.slice(-4);

      // Xem đã có thẻ nào chưa
      const methodsCount = await prisma.paymentMethod.count({
        where: { workspaceId }
      });
      const isDefault = methodsCount === 0;

      // Xem thẻ này đã tồn tại chưa để tránh trùng lặp
      const existing = await prisma.paymentMethod.findFirst({
        where: { workspaceId, last4, type }
      });

      if (!existing) {
        if (isDefault) {
          // Thẻ đầu tiên, cập nhật Subscription làm mặc định
          const updatedSub: Subscription = {
            ...sub,
            cardNumber: cardDetails.cardNumber,
            cardHolder: cardDetails.cardHolder,
            cardExpiry: cardDetails.cardExpiry,
            updatedAt: nowStr
          };
          await this.dependencies.repository.saveSubscription(updatedSub);
        }

        // Tạo phương thức mới
        await prisma.paymentMethod.create({
          data: {
            id: `${type}_${Date.now()}`,
            workspaceId,
            type,
            brand,
            last4,
            holder: cardDetails.cardHolder,
            isDefault,
            gatewayToken: `mock_token_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            createdAt: nowStr,
            updatedAt: nowStr
          }
        });
      } else {
        // Nếu đã tồn tại và là mặc định, cập nhật lại Subscription
        if (existing.isDefault) {
          const updatedSub: Subscription = {
            ...sub,
            cardNumber: cardDetails.cardNumber,
            cardHolder: cardDetails.cardHolder,
            cardExpiry: cardDetails.cardExpiry,
            updatedAt: nowStr
          };
          await this.dependencies.repository.saveSubscription(updatedSub);
        }
      }
    } else {
      // InMemory fallback: cập nhật trực tiếp Subscription
      const updatedSub: Subscription = {
        ...sub,
        cardNumber: cardDetails.cardNumber,
        cardHolder: cardDetails.cardHolder,
        cardExpiry: cardDetails.cardExpiry,
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveSubscription(updatedSub);
    }

    return (await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId)) || sub;
  }

  // 4. Lấy dữ liệu tài nguyên thực tế của Workspace qua API
  async getWorkspaceResourceUsage(
    workspaceId: EntityId<"workspaceId">,
    userId: EntityId<"userId">
  ): Promise<WorkspaceResourceUsageResponse> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const nowStr = this.dependencies.now();
    const isActive = sub ? isSubscriptionActive(sub, nowStr) : false;
    const plan = isActive && sub ? sub.plan : "free"; // Fallback sang gói free nếu không có gói active

    // Lấy hạn mức quota theo plan
    const entitlements = PLAN_ENTITLEMENTS[plan as SubscriptionPlan] || PLAN_ENTITLEMENTS.free;

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

    // Tính dung lượng lưu trữ thực tế từ sizeBytes của documents
    let storageUsedBytes = 0;
    if (this.dependencies.documentRepository) {
      try {
        if (typeof this.dependencies.documentRepository.getTotalStorageBytes === "function") {
          // Ưu tiên: Dùng hàm tính tổng dung lượng thực tế (bytes)
          storageUsedBytes = await this.dependencies.documentRepository.getTotalStorageBytes(workspaceId);
        } else {
          // Fallback: Đếm documents và ước lượng
          const docsResult = await this.dependencies.documentRepository.listDocuments(workspaceId);
          const docsUsed = docsResult.total || docsResult.items.length;
          storageUsedBytes = docsUsed * 0.42 * 1024 * 1024 * 1024; // Ước lượng 0.42GB/doc
        }
      } catch (e) {
        console.error("Lỗi khi tính dung lượng Storage của workspace:", e);
      }
    }

    // Tính toán tài nguyên dựa trên active agents
    const cpuUsed = agentsUsed * 1;
    const ramUsed = agentsUsed * 2;
    const storageUsed = Number((storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2)); // Chuyển bytes sang GB

    const storageMax = entitlements.maxStorageGb;

    return {
      cpu: { used: Math.min(cpuUsed, entitlements.cpuCores), max: entitlements.cpuCores },
      ram: { used: Math.min(ramUsed, entitlements.memoryGb), max: entitlements.memoryGb },
      agents: { used: agentsUsed, max: entitlements.maxAgents },
      storage: { used: Math.min(storageUsed, storageMax), max: storageMax }
    };
  }

  // 5. Khởi tạo Checkout theo Workspace (Có truyền Promo Code nếu có)
  async initiateCheckout(
    userId: EntityId<"userId">,
    workspaceId: EntityId<"workspaceId">,
    plan: SubscriptionPlan,
    promoCode?: string
  ): Promise<{ checkoutUrl: string; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
    if (plan === "free") {
      throw new CheckoutValidationError("Bạn không cần thanh toán cho gói Free.");
    }

    const activeSub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const nowStr = this.dependencies.now();

    if (activeSub) {
      const isActive = isSubscriptionActive(activeSub, nowStr);
      const isPending = activeSub.status === "pending";

      if (isActive || isPending) {
        if (activeSub.plan === plan) {
          throw new CheckoutValidationError(`Workspace đã có một gói ${plan} đang hoạt động hoặc đang chờ thanh toán.`);
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
    const discount = await this.applyPromoDiscount(promoCode);
    const amount = Math.max(0, baseAmount - discount);

    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subscription: Subscription = {
      subscriptionId,
      userId,
      workspaceId,
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

  // 6. Khởi tạo Upgrade từ Standard lên Premium theo Workspace
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
    
    // Tính phí nâng cấp theo proration (số ngày còn lại)
    const premiumPrice = PLAN_PRICES["premium"];
    const standardPrice = PLAN_PRICES["standard"];
    const baseUpgradeAmount = calculateProratedUpgradeAmount(sub, premiumPrice, standardPrice, nowStr);
    const discount = await this.applyPromoDiscount(promoCode);
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
      // Nếu là giao dịch liên kết thẻ đặc biệt (trị giá $1)
      if (tx.amount === 1) {
        return updatedTx;
      }

      const isUpgrade = sub.plan === "standard" && sub.status === "active";
      let fromPlan = sub.plan;
      let toPlan = sub.plan;
      let updatedSub: Subscription;

      if (isUpgrade && sub.plan === "standard") {
        toPlan = "premium";
        // Giữ nguyên expiresAt cũ vì phí upgrade đã tính pro-rata cho phần thời gian còn lại
        updatedSub = {
          ...sub,
          plan: "premium",
          status: "active",
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
            workspaceId: sub.workspaceId,
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
            workspaceId: sub.workspaceId,
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

  async getSubscriptionDetails(workspaceId: EntityId<"workspaceId">): Promise<SubscriptionDetailsResponse & { paymentMethods: any[] }> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    let paymentMethods: any[] = [];

    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      paymentMethods = await prisma.paymentMethod.findMany({
        where: { workspaceId }
      });
    }

    if (!sub) {
      return { subscription: null, transactions: [], paymentMethods };
    }

    const txs = await this.dependencies.repository.listTransactionsBySubscriptionId(sub.subscriptionId);

    return {
      subscription: toSubscriptionPublicSummary(sub),
      transactions: txs.map(toTransactionPublicSummary),
      paymentMethods
    };
  }

  getPlans(): SubscriptionPlansResponse {
    return {
      free: {
        price: PLAN_PRICES.free,
        entitlements: PLAN_ENTITLEMENTS.free
      },
      standard: {
        price: PLAN_PRICES.standard,
        entitlements: PLAN_ENTITLEMENTS.standard
      },
      premium: {
        price: PLAN_PRICES.premium,
        entitlements: PLAN_ENTITLEMENTS.premium
      }
    };
  }

  // 9. Khởi tạo Checkout qua VNPay Sandbox
  async initiateVnPayCheckout(
    userId: EntityId<"userId">,
    workspaceId: EntityId<"workspaceId">,
    plan: SubscriptionPlan,
    ipAddr: string,
    returnUrl: string,
    promoCode?: string
  ): Promise<{ checkoutUrl: string; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
    if (plan === "free") {
      throw new CheckoutValidationError("Bạn không cần thanh toán cho gói Free.");
    }

    const activeSub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const nowStr = this.dependencies.now();

    if (activeSub) {
      const isActive = isSubscriptionActive(activeSub, nowStr);
      const isPending = activeSub.status === "pending";

      if (isActive || isPending) {
        if (activeSub.plan === plan) {
          if (isPending) {
            // Tái sử dụng transaction cũ đang pending để thanh toán VNPay
            const txs = await this.dependencies.repository.listTransactionsBySubscriptionId(activeSub.subscriptionId);
            const pendingTx = txs.find(t => t.status === "pending");
            if (pendingTx) {
              const dateObj = new Date(nowStr);
              const createDateStr = dateObj.getFullYear() +
                String(dateObj.getMonth() + 1).padStart(2, '0') +
                String(dateObj.getDate()).padStart(2, '0') +
                String(dateObj.getHours()).padStart(2, '0') +
                String(dateObj.getMinutes()).padStart(2, '0') +
                String(dateObj.getSeconds()).padStart(2, '0');

              const checkoutUrl = this.vnpayAdapter.createPaymentUrl({
                transactionId: pendingTx.transactionId,
                amount: pendingTx.amount,
                ipAddr,
                returnUrl,
                createDateStr
              });

              return {
                checkoutUrl,
                subscriptionId: activeSub.subscriptionId,
                transactionId: pendingTx.transactionId
              };
            }
          }
          throw new CheckoutValidationError(`Workspace đã có một gói ${plan} đang hoạt động hoặc đang chờ thanh toán.`);
        }
        if (activeSub.plan === "standard" && plan === "premium") {
          return this.initiateVnPayUpgrade(userId, activeSub.subscriptionId, ipAddr, returnUrl, promoCode);
        }
        throw new CheckoutValidationError(`Bạn không thể hạ cấp gói dịch vụ khi gói hiện tại đang hoạt động.`);
      }
    }

    const subscriptionId = this.dependencies.generateSubscriptionId();
    const transactionId = this.dependencies.generateTransactionId();
    
    // Áp dụng giảm giá
    const baseAmount = PLAN_PRICES[plan];
    const discount = await this.applyPromoDiscount(promoCode);
    const amount = Math.max(0, baseAmount - discount);

    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const subscription: Subscription = {
      subscriptionId,
      userId,
      workspaceId,
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

    const dateObj = new Date(nowStr);
    const createDateStr = dateObj.getFullYear() +
      String(dateObj.getMonth() + 1).padStart(2, '0') +
      String(dateObj.getDate()).padStart(2, '0') +
      String(dateObj.getHours()).padStart(2, '0') +
      String(dateObj.getMinutes()).padStart(2, '0') +
      String(dateObj.getSeconds()).padStart(2, '0');

    const checkoutUrl = this.vnpayAdapter.createPaymentUrl({
      transactionId,
      amount,
      ipAddr,
      returnUrl,
      createDateStr
    });

    return {
      checkoutUrl,
      subscriptionId,
      transactionId
    };
  }

  // 10. Khởi tạo nâng cấp qua VNPay Sandbox
  async initiateVnPayUpgrade(
    userId: EntityId<"userId">,
    subscriptionId: EntityId<"subscriptionId">,
    ipAddr: string,
    returnUrl: string,
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
    
    // Tính phí nâng cấp theo proration (số ngày còn lại)
    const premiumPrice = PLAN_PRICES["premium"];
    const standardPrice = PLAN_PRICES["standard"];
    const baseUpgradeAmount = calculateProratedUpgradeAmount(sub, premiumPrice, standardPrice, nowStr);
    const discount = await this.applyPromoDiscount(promoCode);
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

    const dateObj = new Date(nowStr);
    const createDateStr = dateObj.getFullYear() +
      String(dateObj.getMonth() + 1).padStart(2, '0') +
      String(dateObj.getDate()).padStart(2, '0') +
      String(dateObj.getHours()).padStart(2, '0') +
      String(dateObj.getMinutes()).padStart(2, '0') +
      String(dateObj.getSeconds()).padStart(2, '0');

    const checkoutUrl = this.vnpayAdapter.createPaymentUrl({
      transactionId,
      amount: upgradeAmount,
      ipAddr,
      returnUrl,
      createDateStr
    });

    return {
      checkoutUrl,
      subscriptionId,
      transactionId
    };
  }

  // 11. Đối soát thanh toán VNPay (IPN / Return)
  async reconcileVnPayPayment(queryParams: Record<string, any>): Promise<Transaction> {
    const isValidSignature = this.vnpayAdapter.validateCallback(queryParams);
    if (!isValidSignature) {
      throw new CheckoutValidationError("Chữ ký bảo mật VNPay không hợp lệ.");
    }

    const transactionId = queryParams["vnp_TxnRef"] as EntityId<"transactionId">;
    const responseCode = queryParams["vnp_ResponseCode"];
    const vnpToken = queryParams["vnp_Token"]; // Tokenization token

    const tx = await this.dependencies.repository.findTransactionById(transactionId);
    if (!tx) {
      throw new CheckoutNotFoundError(`Không tìm thấy giao dịch VNPay tương ứng: ${transactionId}`);
    }

    // Đối soát trạng thái
    const status = responseCode === "00" ? "success" : "failed";
    const reconciledTx = await this.reconcilePayment(transactionId, status);

    // Lưu token nếu thanh toán thành công và VNPay trả về token liên kết thẻ (Tự sinh token giả lập để hỗ trợ demo nếu merchant bị giới hạn quyền Sandbox)
    if (status === "success") {
      const finalToken = vnpToken || `vnp_mock_token_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const sub = await this.dependencies.repository.findSubscriptionById(tx.subscriptionId);
      if (sub && sub.workspaceId) {
        const bankCode = queryParams["vnp_BankCode"] || "NCB";
        const cardNoMasked = queryParams["vnp_CardNum"] || "•••• 1998";
        const last4 = cardNoMasked.slice(-4);
        const nowStr = this.dependencies.now();

        // Đồng bộ lưu thông tin thanh toán VNPay Token
        const paymentMethod = {
          id: `vnpay_${Date.now()}`,
          workspaceId: sub.workspaceId,
          type: "vnpay",
          brand: bankCode,
          last4: last4,
          holder: "NGUYEN VAN A",
          isDefault: true,
          gatewayToken: finalToken,
          createdAt: nowStr,
          updatedAt: nowStr
        };

        // Lưu vào DB
        if (typeof (this.dependencies.repository as any).savePaymentMethod === "function") {
          await (this.dependencies.repository as any).savePaymentMethod(paymentMethod);
        } else {
          const prisma = (this.dependencies.repository as any).prisma;
          if (prisma) {
            await prisma.paymentMethod.updateMany({
              where: { workspaceId: sub.workspaceId },
              data: { isDefault: false }
            });
            await prisma.paymentMethod.create({
              data: paymentMethod
            });
          }
        }

        const updatedSub: Subscription = {
          ...sub,
          cardNumber: `VNPay: •••• •••• •••• ${last4}`,
          cardHolder: "NGUYEN VAN A",
          cardExpiry: "07/15",
          updatedAt: nowStr
        };
        await this.dependencies.repository.saveSubscription(updatedSub);
      }
    }

    return reconciledTx;
  }

  // 12. Xử lý gia hạn tự động qua Daily Cron Job (Thanh toán định kỳ)
  async processRenewal(subscriptionId: EntityId<"subscriptionId">): Promise<{ success: boolean; message: string }> {
    const sub = await this.dependencies.repository.findSubscriptionById(subscriptionId);
    if (!sub) {
      return { success: false, message: "Không tìm thấy Subscription." };
    }

    const nowStr = this.dependencies.now();
    if (!sub.workspaceId || !sub.autoRenew) {
      return { success: false, message: "Subscription không bật tự động gia hạn." };
    }

    let paymentMethod: any = null;
    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      paymentMethod = await prisma.paymentMethod.findFirst({
        where: { workspaceId: sub.workspaceId, isDefault: true }
      });
    }

    if (!paymentMethod || !paymentMethod.gatewayToken || paymentMethod.type !== "vnpay") {
      const updatedSub: Subscription = {
        ...sub,
        status: "past_due",
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveSubscription(updatedSub);
      return { success: false, message: "Không có thông tin thẻ liên kết VNPay Tokenization. Kích hoạt Grace Period." };
    }

    const transactionId = this.dependencies.generateTransactionId();
    const planPrice = PLAN_PRICES[sub.plan as SubscriptionPlan] || 29;

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount: planPrice,
      currency: "USD",
      status: "pending",
      createdAt: nowStr,
      updatedAt: nowStr
    };
    await this.dependencies.repository.saveTransaction(transaction);

    const dateObj = new Date(nowStr);
    const createDateStr = dateObj.getFullYear() +
      String(dateObj.getMonth() + 1).padStart(2, '0') +
      String(dateObj.getDate()).padStart(2, '0') +
      String(dateObj.getHours()).padStart(2, '0') +
      String(dateObj.getMinutes()).padStart(2, '0') +
      String(dateObj.getSeconds()).padStart(2, '0');

    const chargeResult = await this.vnpayAdapter.chargeToken({
      transactionId,
      amount: planPrice,
      token: paymentMethod.gatewayToken,
      ipAddr: "127.0.0.1",
      createDateStr
    });

    if (chargeResult.success) {
      const updatedTx: Transaction = {
        ...transaction,
        status: "success",
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveTransaction(updatedTx);

      const nextExpiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const updatedSub: Subscription = {
        ...sub,
        status: "active",
        expiresAt: nextExpiresAt,
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveSubscription(updatedSub);

      await this.dependencies.eventBus.publish({
        name: "subscription.activated",
        eventId: this.dependencies.generateEventId(),
        occurredAt: nowStr,
        payload: {
          userId: sub.userId,
          subscriptionId: sub.subscriptionId,
          workspaceId: sub.workspaceId,
          plan: sub.plan
        }
      });

      return { success: true, message: "Gia hạn tự động qua VNPay Tokenization thành công." };
    } else {
      const updatedTx: Transaction = {
        ...transaction,
        status: "failed",
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveTransaction(updatedTx);

      const updatedSub: Subscription = {
        ...sub,
        status: "past_due",
        updatedAt: nowStr
      };
      await this.dependencies.repository.saveSubscription(updatedSub);

      return { success: false, message: `Thanh toán qua Tokenization thất bại: ${chargeResult.message}. Chuyển sang Grace Period.` };
    }
  }

  // 13. Xóa phương thức thanh toán đã liên kết
  async deletePaymentMethod(workspaceId: string, methodId: string): Promise<any> {
    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      const method = await prisma.paymentMethod.findFirst({
        where: { id: methodId, workspaceId }
      });
      if (!method) {
        throw new CheckoutNotFoundError("Không tìm thấy phương thức thanh toán để xóa.");
      }
      
      await prisma.paymentMethod.delete({
        where: { id: methodId }
      });

      if (method.isDefault) {
        const nextMethod = await prisma.paymentMethod.findFirst({
          where: { workspaceId }
        });
        if (nextMethod) {
          await prisma.paymentMethod.update({
            where: { id: nextMethod.id },
            data: { isDefault: true }
          });
        }
      }

      // Xóa thông tin thẻ liên kết trong Subscription tương ứng của workspace
      const sub = await prisma.subscription.findFirst({
        where: { workspaceId }
      });
      if (sub && sub.cardNumber && sub.cardNumber.endsWith(method.last4)) {
        await prisma.subscription.update({
          where: { subscriptionId: sub.subscriptionId },
          data: {
            cardNumber: null,
            cardHolder: null,
            cardExpiry: null
          }
        });
      }
    } else {
      // InMemory fallback: cập nhật subscription
      const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId as EntityId<"workspaceId">);
      if (sub) {
        const updatedSub: Subscription = {
          ...sub,
          cardNumber: null,
          cardHolder: null,
          cardExpiry: null,
          updatedAt: this.dependencies.now()
        };
        await this.dependencies.repository.saveSubscription(updatedSub);
      }
    }
    
    return { success: true, message: "Đã xóa phương thức thanh toán thành công." };
  }

  // 14. Hủy gói dịch vụ đang hoạt động
  async cancelSubscription(workspaceId: EntityId<"workspaceId">): Promise<Subscription> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    if (!sub) {
      throw new CheckoutNotFoundError("Không tìm thấy gói đăng ký nào của Workspace để hủy.");
    }

    const nowStr = this.dependencies.now();
    const updatedSub: Subscription = {
      ...sub,
      status: "expired", // Chuyển ngay thành hết hạn
      autoRenew: false,  // Tắt gia hạn
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveSubscription(updatedSub);

    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      await prisma.workspace.update({
        where: { workspaceId },
        data: {
          plan: "free",
          updatedAt: nowStr
        }
      });
    }

    await this.dependencies.eventBus.publish({
      name: "subscription.cancelled",
      eventId: this.dependencies.generateEventId(),
      occurredAt: nowStr,
      payload: {
        userId: sub.userId,
        subscriptionId: sub.subscriptionId,
        workspaceId: sub.workspaceId,
        plan: sub.plan
      }
    });

    return updatedSub;
  }

  // 15. Trừ tiền trực tiếp bằng thẻ VNPay / phương thức đã liên kết sẵn (1-click payment)
  async chargeSavedMethod(
    workspaceId: EntityId<"workspaceId">,
    plan: SubscriptionPlan,
    methodId: string,
    promoCode?: string
  ): Promise<{ success: boolean; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const nowStr = this.dependencies.now();
    const transactionId = this.dependencies.generateTransactionId();
    
    const baseAmount = PLAN_PRICES[plan];
    const discount = await this.applyPromoDiscount(promoCode);
    const amount = Math.max(0, baseAmount - discount);

    const subscriptionId = sub ? sub.subscriptionId : this.dependencies.generateSubscriptionId();
    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Lấy thông tin thẻ đã lưu từ DB để đồng bộ hiển thị lên Subscription
    let last4 = "119";
    let holder = "NGUYEN VAN A";
    let expiry = "07/15";
    let type = "vnpay";

    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      const pm = await prisma.paymentMethod.findUnique({
        where: { id: methodId }
      });
      if (pm) {
        last4 = pm.last4;
        holder = pm.holder;
        expiry = pm.expiry || "07/15";
        type = pm.type;
      }
    }

    const updatedSub: Subscription = {
      subscriptionId,
      userId: sub ? sub.userId : "user_admin" as any,
      workspaceId,
      plan,
      status: "active",
      expiresAt,
      createdAt: sub ? sub.createdAt : nowStr,
      updatedAt: nowStr,
      autoRenew: true,
      cardNumber: `${type === "vnpay" ? "VNPay" : type === "momo" ? "MoMo" : "Card"}: •••• •••• •••• ${last4}`,
      cardHolder: holder,
      cardExpiry: expiry
    };

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount,
      currency: "USD",
      status: "success", // Thành công lập tức
      createdAt: nowStr,
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveSubscription(updatedSub);
    await this.dependencies.repository.saveTransaction(transaction);

    if (prisma) {
      await prisma.workspace.update({
        where: { workspaceId },
        data: {
          plan,
          updatedAt: nowStr
        }
      });
    }

    await this.dependencies.eventBus.publish({
      name: "subscription.activated",
      eventId: this.dependencies.generateEventId(),
      occurredAt: nowStr,
      payload: {
        userId: updatedSub.userId,
        subscriptionId,
        workspaceId,
        plan
      }
    });

    return { success: true, subscriptionId, transactionId };
  }

  // 16. Khởi tạo giao dịch liên kết thẻ $1 qua VNPay Sandbox
  async initiateVnPayBinding(
    userId: EntityId<"userId">,
    workspaceId: EntityId<"workspaceId">,
    ipAddr: string,
    returnUrl: string
  ): Promise<{ checkoutUrl: string; transactionId: EntityId<"transactionId"> }> {
    const transactionId = this.dependencies.generateTransactionId();
    const nowStr = this.dependencies.now();

    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const subscriptionId = sub ? sub.subscriptionId : this.dependencies.generateSubscriptionId();

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount: 1, // $1 test liên kết thẻ
      currency: "USD",
      status: "pending",
      createdAt: nowStr,
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveTransaction(transaction);

    const dateObj = new Date(nowStr);
    const createDateStr = dateObj.getFullYear() +
      String(dateObj.getMonth() + 1).padStart(2, '0') +
      String(dateObj.getDate()).padStart(2, '0') +
      String(dateObj.getHours()).padStart(2, '0') +
      String(dateObj.getMinutes()).padStart(2, '0') +
      String(dateObj.getSeconds()).padStart(2, '0');

    const checkoutUrl = this.vnpayAdapter.createPaymentUrl({
      transactionId,
      amount: 1,
      ipAddr,
      returnUrl,
      createDateStr
    });

    return { checkoutUrl, transactionId };
  }

  // 17. Khởi tạo SetupIntent cho Stripe liên kết thẻ
  async createStripeSetupIntent(workspaceId: EntityId<"workspaceId">): Promise<{ clientSecret: string; setupIntentId: string }> {
    return this.stripeAdapter.createSetupIntent(workspaceId);
  }

  // 18. Xác nhận liên kết thẻ Stripe thành công và lưu vào DB
  async confirmStripeBinding(
    workspaceId: EntityId<"workspaceId">,
    paymentMethodId: string
  ): Promise<{ success: boolean; paymentMethod: any }> {
    const nowStr = this.dependencies.now();
    const pm = await this.stripeAdapter.getPaymentMethod(paymentMethodId);
    
    const last4 = pm.card?.last4 || "4242";
    const brand = pm.card?.brand || "Visa";
    const holder = pm.billing_details?.name || "Card Holder";
    const expiry = pm.card ? `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}` : "12/28";

    const paymentMethod = {
      id: paymentMethodId,
      workspaceId,
      type: "card", // Thẻ quốc tế
      brand,
      last4,
      holder,
      isDefault: true,
      gatewayToken: paymentMethodId,
      createdAt: nowStr,
      updatedAt: nowStr
    };

    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      // Đặt tất cả các phương thức khác của workspace thành không mặc định
      await prisma.paymentMethod.updateMany({
        where: { workspaceId },
        data: { isDefault: false }
      });

      // Tạo mới hoặc cập nhật phương thức này
      await prisma.paymentMethod.upsert({
        where: { id: paymentMethodId },
        update: { isDefault: true, updatedAt: nowStr },
        create: paymentMethod
      });

      // Đồng bộ lưu thông tin thẻ mặc định vào Subscription tương ứng
      const sub = await prisma.subscription.findFirst({
        where: { workspaceId }
      });
      if (sub) {
        await prisma.subscription.update({
          where: { subscriptionId: sub.subscriptionId },
          data: {
            cardNumber: `${brand.toUpperCase()}: •••• •••• •••• ${last4}`,
            cardHolder: holder,
            cardExpiry: expiry,
            updatedAt: nowStr
          }
        });
      }
    } else {
      // InMemory fallback
      const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
      if (sub) {
        const updatedSub: Subscription = {
          ...sub,
          cardNumber: `${brand.toUpperCase()}: •••• •••• •••• ${last4}`,
          cardHolder: holder,
          cardExpiry: expiry,
          updatedAt: nowStr
        };
        await this.dependencies.repository.saveSubscription(updatedSub);
      }
    }

    return { success: true, paymentMethod };
  }

  // 19. Trừ tiền trực tiếp qua Token thẻ Stripe đã lưu (1-click payment)
  async chargeStripePayment(
    workspaceId: EntityId<"workspaceId">,
    plan: SubscriptionPlan,
    paymentMethodId: string,
    promoCode?: string
  ): Promise<{ success: boolean; subscriptionId: EntityId<"subscriptionId">; transactionId: EntityId<"transactionId"> }> {
    const sub = await this.dependencies.repository.findSubscriptionByWorkspaceId(workspaceId);
    const nowStr = this.dependencies.now();
    const transactionId = this.dependencies.generateTransactionId();

    const baseAmount = PLAN_PRICES[plan];
    const discount = await this.applyPromoDiscount(promoCode);
    const amount = Math.max(0, baseAmount - discount);

    // Thực hiện charge tiền qua Stripe Adapter
    if (paymentMethodId.startsWith("pm_")) {
      const chargeResult = await this.stripeAdapter.chargeToken({
        amount,
        currency: "usd",
        paymentMethodId,
        workspaceId,
        description: `Thanh toán gói dịch vụ ${plan.toUpperCase()} cho Workspace ${workspaceId}`
      });

      if (!chargeResult.success) {
        throw new CheckoutValidationError(`Thanh toán qua Stripe thất bại: ${chargeResult.status}`);
      }
    } else {
      // Giả lập thanh toán thành công cho các thẻ mock cũ (card_...)
      console.log(`[Stripe Mock Charge] Giả lập thanh toán thành công cho thẻ mock ${paymentMethodId}`);
    }

    const subscriptionId = sub ? sub.subscriptionId : this.dependencies.generateSubscriptionId();
    const expiresAt = new Date(new Date(nowStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Lấy thông tin thẻ đã lưu
    let last4 = "4242";
    let brand = "Visa";
    let holder = "Card Holder";
    let expiry = "12/28";

    const prisma = (this.dependencies.repository as any).prisma;
    if (prisma) {
      const pm = await prisma.paymentMethod.findUnique({
        where: { id: paymentMethodId }
      });
      if (pm) {
        last4 = pm.last4;
        brand = pm.brand;
        holder = pm.holder;
        expiry = pm.expiry || "12/28";
      }
    }

    const updatedSub: Subscription = {
      subscriptionId,
      userId: sub ? sub.userId : "user_admin" as any,
      workspaceId,
      plan,
      status: "active",
      expiresAt,
      createdAt: sub ? sub.createdAt : nowStr,
      updatedAt: nowStr,
      autoRenew: true,
      cardNumber: `${brand.toUpperCase()}: •••• •••• •••• ${last4}`,
      cardHolder: holder,
      cardExpiry: expiry
    };

    const transaction: Transaction = {
      transactionId,
      subscriptionId,
      amount,
      currency: "USD",
      status: "success",
      createdAt: nowStr,
      updatedAt: nowStr
    };

    await this.dependencies.repository.saveSubscription(updatedSub);
    await this.dependencies.repository.saveTransaction(transaction);

    if (prisma) {
      await prisma.workspace.update({
        where: { workspaceId },
        data: {
          plan,
          updatedAt: nowStr
        }
      });
    }

    await this.dependencies.eventBus.publish({
      name: "subscription.activated",
      eventId: this.dependencies.generateEventId(),
      occurredAt: nowStr,
      payload: {
        userId: updatedSub.userId,
        subscriptionId,
        workspaceId,
        plan
      }
    });

    return { success: true, subscriptionId, transactionId };
  }
}

