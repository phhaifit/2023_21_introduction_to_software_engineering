import Stripe from "stripe";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export class StripeAdapter {
  private readonly stripe: Stripe;
  private readonly frontendUrl: string;
  private static readonly customerMap = new Map<string, string>();

  constructor(apiKey: string, frontendUrl: string = "http://127.0.0.1:5173") {
    if (!apiKey) {
      throw new Error("Stripe API Key không được để trống.");
    }
    // Khởi tạo Stripe Client (bỏ apiVersion để tự động tương thích phiên bản tài khoản)
    this.stripe = new Stripe(apiKey);
    this.frontendUrl = frontendUrl;
  }

  // Helper tìm hoặc tạo Customer Stripe tương ứng với Workspace
  private async getOrCreateCustomer(workspaceId: string): Promise<string> {
    // 1. Kiểm tra cache in-memory trước để đảm bảo tính nhất quán tuyệt đối
    const cachedId = StripeAdapter.customerMap.get(workspaceId);
    if (cachedId) {
      return cachedId;
    }

    try {
      // 2. Tìm kiếm trên Stripe
      const customers = await this.stripe.customers.list({ limit: 50 });
      const existingCustomer = customers.data.find(c => c.metadata && c.metadata.workspaceId === workspaceId);
      if (existingCustomer) {
        StripeAdapter.customerMap.set(workspaceId, existingCustomer.id);
        return existingCustomer.id;
      }
      
      // 3. Tạo mới nếu chưa có
      const newCustomer = await this.stripe.customers.create({
        name: `Workspace ${workspaceId}`,
        metadata: { workspaceId }
      });
      StripeAdapter.customerMap.set(workspaceId, newCustomer.id);
      return newCustomer.id;
    } catch (err) {
      // Fallback tạo mới
      const newCustomer = await this.stripe.customers.create({
        name: `Workspace ${workspaceId}`,
        metadata: { workspaceId }
      });
      StripeAdapter.customerMap.set(workspaceId, newCustomer.id);
      return newCustomer.id;
    }
  }

  // 1. Tạo SetupIntent để liên kết thẻ (lưu Token)
  async createSetupIntent(workspaceId: string): Promise<{ clientSecret: string; setupIntentId: string }> {
    const customerId = await this.getOrCreateCustomer(workspaceId);

    const session = await this.stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session", // Cho phép tự động trừ tiền gia hạn hàng tháng (off-session)
      metadata: { workspaceId }
    });

    if (!session.client_secret) {
      throw new Error("Không thể khởi tạo SetupIntent từ Stripe.");
    }

    return {
      clientSecret: session.client_secret,
      setupIntentId: session.id
    };
  }

  // 2. Lấy thông tin phương thức thanh toán đã liên kết từ Stripe
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  // 3. Tạo PaymentIntent để trừ tiền trực tiếp qua Token thẻ đã lưu (1-click payment / Gia hạn tự động)
  async chargeToken(params: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    workspaceId: string;
    description?: string;
  }): Promise<{ success: boolean; transactionId: string; status: string }> {
    try {
      const customerId = await this.getOrCreateCustomer(params.workspaceId);

      // Đảm bảo thẻ được attach vào customer trước khi confirm
      try {
        await this.stripe.paymentMethods.attach(params.paymentMethodId, {
          customer: customerId
        });
      } catch (attachErr) {
        // Có thể thẻ đã được attach trước đó, bỏ qua lỗi này
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Stripe nhận cents (vd: $15.00 -> 1500)
        currency: params.currency.toLowerCase(),
        payment_method: params.paymentMethodId,
        customer: customerId,
        confirm: true,
        off_session: true, // Cho phép trừ tiền định kỳ tự động không cần người dùng online
        payment_method_types: ["card"],
        description: params.description || `Thanh toán gói dịch vụ Workspace ${params.workspaceId}`,
        metadata: { workspaceId: params.workspaceId }
      });

      const isSuccess = paymentIntent.status === "succeeded";

      return {
        success: isSuccess,
        transactionId: paymentIntent.id,
        status: paymentIntent.status
      };
    } catch (err: any) {
      console.error("Stripe Charge Error Details:", err);
      // Nếu có lỗi xác thực hoặc trừ tiền thất bại
      return {
        success: false,
        transactionId: err.payment_intent?.id || `failed_${Date.now()}`,
        status: err.code || err.message || "failed"
      };
    }
  }

  // 4. Refund (Hoàn tiền) giao dịch nếu cần
  async refundPayment(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId
    });
  }
}
