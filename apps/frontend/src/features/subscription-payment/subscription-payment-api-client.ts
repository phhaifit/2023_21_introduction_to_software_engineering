import type { SubscriptionDetailsResponse } from "@vcp/shared/contracts/subscription-payment.ts";

export class SubscriptionPaymentApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async getSubscriptionDetails(): Promise<SubscriptionDetailsResponse> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/details`);
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateCheckout(plan: "standard" | "premium"): Promise<{
    checkoutUrl: string;
    subscriptionId: string;
    transactionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
  }

  async initiateUpgrade(subscriptionId: string): Promise<{
    checkoutUrl: string;
    subscriptionId: string;
    transactionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId })
    });
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response));
    }
    const json = await response.json();
    return json.data;
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
