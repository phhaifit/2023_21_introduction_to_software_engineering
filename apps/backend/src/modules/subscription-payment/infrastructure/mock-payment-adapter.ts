import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export type MockCheckoutSession = {
  checkoutUrl: string;
  transactionId: EntityId<"transactionId">;
};

export class MockPaymentAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "http://127.0.0.1:5173") {
    this.baseUrl = baseUrl;
  }

  async createCheckoutSession(
    transactionId: EntityId<"transactionId">,
    plan: SubscriptionPlan,
    amount: number
  ): Promise<MockCheckoutSession> {
    const checkoutUrl = `${this.baseUrl}/billing/sandbox-checkout?transactionId=${transactionId}&plan=${plan}&amount=${amount}`;
    
    return {
      checkoutUrl,
      transactionId
    };
  }
}
