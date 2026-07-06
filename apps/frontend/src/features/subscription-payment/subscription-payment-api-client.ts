import type { 
  SubscriptionDetailsResponse, 
  WorkspaceResourceUsageResponse,
  ValidatePromoResponse 
} from "@vcp/shared/contracts/subscription-payment.ts";

export class SubscriptionPaymentApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async getSubscriptionDetails(workspaceId: string): Promise<SubscriptionDetailsResponse> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/details?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  // 1. Gọi API lấy tài nguyên sử dụng động của workspace
  async getWorkspaceResourceUsage(workspaceId: string): Promise<WorkspaceResourceUsageResponse> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/usage?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateCheckout(workspaceId: string, plan: "standard" | "premium", promoCode?: string): Promise<{
    checkoutUrl: string;
    subscriptionId: string;
    transactionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, plan, promoCode })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateUpgrade(subscriptionId: string, promoCode?: string): Promise<{
    checkoutUrl: string;
    subscriptionId: string;
    transactionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, promoCode })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  // 2. Gọi API toggle bật tắt tự gia hạn
  async toggleAutoRenewal(workspaceId: string, autoRenew: boolean): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/toggle-auto-renewal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, autoRenew })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  // 3. Gọi API cập nhật phương thức thanh toán ảo
  async updatePaymentMethod(
    workspaceId: string,
    cardNumber: string,
    cardHolder: string,
    cardExpiry: string
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/payment-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, cardNumber, cardHolder, cardExpiry })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async deletePaymentMethod(workspaceId: string, methodId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/payment-method/${encodeURIComponent(methodId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async cancelSubscription(workspaceId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async chargeSavedMethod(workspaceId: string, plan: string, methodId: string, promoCode?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/vnpay/charge-saved-method`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, plan, methodId, promoCode })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateVnPayBinding(workspaceId: string, returnUrl: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/vnpay/initiate-binding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, returnUrl })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async createStripeSetupIntent(workspaceId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/stripe/setup-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async confirmStripeBinding(workspaceId: string, paymentMethodId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/stripe/confirm-binding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, paymentMethodId })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async chargeStripePayment(workspaceId: string, plan: string, paymentMethodId: string, promoCode?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/stripe/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, plan, paymentMethodId, promoCode })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  // 4. Gọi API validate mã giảm giá
  async validatePromo(promoCode: string): Promise<ValidatePromoResponse> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/validate-promo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    return response.json().then(j => j.data);
  }

  async sendMockCallback(transactionId: string, status: "success" | "failed"): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/mock-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, status })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateVnPayCheckout(
    workspaceId: string,
    plan: "standard" | "premium",
    promoCode?: string,
    returnUrl?: string
  ): Promise<{
    checkoutUrl: string;
    subscriptionId: string;
    transactionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/vnpay/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, plan, promoCode, returnUrl })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async getPlans(): Promise<SubscriptionPlansResponse> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/plans`);
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const json = await response.json();
      return json.error?.message || `HTTP error ${response.status}`;
    } catch {
      return `HTTP error ${response.status}`;
    }
  }
}

export const subscriptionPaymentApiClient = new SubscriptionPaymentApiClient();
