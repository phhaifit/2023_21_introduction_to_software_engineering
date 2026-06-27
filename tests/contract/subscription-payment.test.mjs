import assert from "node:assert/strict";
import { CheckoutUseCases } from "../../apps/backend/src/modules/subscription-payment/application/checkout-use-cases.ts";
import { InMemorySubscriptionRepository } from "../../apps/backend/src/modules/subscription-payment/infrastructure/in-memory-subscription-repository.ts";
import { MockPaymentAdapter } from "../../apps/backend/src/modules/subscription-payment/infrastructure/mock-payment-adapter.ts";

class MockEventBus {
  constructor() {
    this.events = [];
  }
  async publish(event) {
    this.events.push(event);
  }
}

async function runTests() {
  const repository = new InMemorySubscriptionRepository();
  const paymentAdapter = new MockPaymentAdapter();
  const eventBus = new MockEventBus();

  let timeSequence = 0;
  let subIdSequence = 0;
  let txIdSequence = 0;
  let eventIdSequence = 0;

  const now = () => `2026-06-22T12:00:0${timeSequence++}.000Z`;
  const generateSubscriptionId = () => `sub-${++subIdSequence}`;
  const generateTransactionId = () => `tx-${++txIdSequence}`;
  const generateEventId = () => `evt-${++eventIdSequence}`;

  const useCases = new CheckoutUseCases({
    repository,
    paymentAdapter,
    eventBus,
    now,
    generateSubscriptionId,
    generateTransactionId,
    generateEventId
  });

  const userId = "user-123";

  console.log("Running subscription tests...");

  // Scenario 1: Initiate Standard Checkout
  const checkoutRes = await useCases.initiateCheckout(userId, "standard");
  assert.equal(checkoutRes.subscriptionId, "sub-1");
  assert.equal(checkoutRes.transactionId, "tx-1");
  assert.ok(checkoutRes.checkoutUrl.includes("sandbox-checkout"));
  assert.ok(checkoutRes.checkoutUrl.includes("plan=standard"));
  assert.ok(checkoutRes.checkoutUrl.includes("amount=29"));

  const subPending = await repository.findSubscriptionById("sub-1");
  assert.ok(subPending);
  assert.equal(subPending.plan, "standard");
  assert.equal(subPending.status, "pending");

  const txPending = await repository.findTransactionById("tx-1");
  assert.ok(txPending);
  assert.equal(txPending.status, "pending");
  assert.equal(txPending.amount, 29);

  // Scenario 2: Try to checkout standard again when standard is pending -> should throw error
  await assert.rejects(
    async () => {
      await useCases.initiateCheckout(userId, "standard");
    },
    (err) => {
      return err.message.includes("đã có một gói standard");
    }
  );

  // Scenario 3: Webhook payment successful callback
  const reconcileRes = await useCases.reconcilePayment("tx-1", "success");
  assert.equal(reconcileRes.status, "success");

  const subActive = await repository.findSubscriptionById("sub-1");
  assert.equal(subActive.status, "active");
  assert.equal(subActive.plan, "standard");
  
  // Verify event emitted
  assert.equal(eventBus.events.length, 1);
  assert.equal(eventBus.events[0].name, "subscription.activated");
  assert.equal(eventBus.events[0].payload.subscriptionId, "sub-1");
  assert.equal(eventBus.events[0].payload.plan, "standard");

  // Scenario 4: Initiate Upgrade to Premium
  const upgradeRes = await useCases.initiateUpgrade(userId, "sub-1");
  assert.equal(upgradeRes.subscriptionId, "sub-1");
  assert.equal(upgradeRes.transactionId, "tx-2");
  assert.ok(upgradeRes.checkoutUrl.includes("plan=premium"));
  assert.ok(upgradeRes.checkoutUrl.includes("amount=50")); // 79 - 29 = 50

  const txUpgradePending = await repository.findTransactionById("tx-2");
  assert.equal(txUpgradePending.status, "pending");
  assert.equal(txUpgradePending.amount, 50);

  // Scenario 5: Webhook Upgrade successful callback
  const reconcileUpgradeRes = await useCases.reconcilePayment("tx-2", "success");
  assert.equal(reconcileUpgradeRes.status, "success");

  const subUpgraded = await repository.findSubscriptionById("sub-1");
  assert.equal(subUpgraded.status, "active");
  assert.equal(subUpgraded.plan, "premium");

  // Verify upgrade event emitted
  assert.equal(eventBus.events.length, 2);
  assert.equal(eventBus.events[1].name, "subscription.upgraded");
  assert.equal(eventBus.events[1].payload.subscriptionId, "sub-1");
  assert.equal(eventBus.events[1].payload.fromPlan, "standard");
  assert.equal(eventBus.events[1].payload.toPlan, "premium");

  // Scenario 6: Re-checkout Premium when already having active Premium -> should throw error
  await assert.rejects(
    async () => {
      await useCases.initiateCheckout(userId, "premium");
    },
    (err) => {
      return err.message.includes("đã có một gói premium");
    }
  );

  // Scenario 7: Webhook payment failed callback
  const anotherUser = "user-456";
  const checkoutRes2 = await useCases.initiateCheckout(anotherUser, "standard");
  
  const reconcileFailedRes = await useCases.reconcilePayment(checkoutRes2.transactionId, "failed");
  assert.equal(reconcileFailedRes.status, "failed");

  const subCancelled = await repository.findSubscriptionById(checkoutRes2.subscriptionId);
  assert.equal(subCancelled.status, "cancelled");

  // Scenario 8: Validate Promo Codes
  const promoValid = useCases.validatePromo("VCP10");
  assert.equal(promoValid.success, true);
  assert.equal(promoValid.discount, 10);

  const promoInvalid = useCases.validatePromo("INVALID_CODE");
  assert.equal(promoInvalid.success, false);
  assert.equal(promoInvalid.discount, 0);

  // Scenario 9: Toggle Auto-Renewal
  const subToggleRes = await useCases.toggleAutoRenewal(userId, false);
  assert.equal(subToggleRes.autoRenew, false);
  
  const subToggleVerify = await repository.findSubscriptionById("sub-1");
  assert.equal(subToggleVerify.autoRenew, false);

  // Scenario 10: Update Payment Method Card details
  const subCardRes = await useCases.updatePaymentMethod(userId, {
    cardNumber: "1111 2222 3333 4444",
    cardHolder: "VCP Tester",
    cardExpiry: "09/30"
  });
  assert.equal(subCardRes.cardNumber, "1111 2222 3333 4444");
  assert.equal(subCardRes.cardHolder, "VCP Tester");

  const subCardVerify = await repository.findSubscriptionById("sub-1");
  assert.equal(subCardVerify.cardNumber, "1111 2222 3333 4444");

  // Scenario 11: Get Resource Usage
  const usage = await useCases.getWorkspaceResourceUsage("workspace-123", userId);
  assert.ok(usage.cpu);
  assert.ok(usage.ram);
  assert.ok(usage.agents);
  assert.ok(usage.storage);

  // Scenario 12: Get Plans Configuration
  const plans = useCases.getPlans();
  assert.equal(plans.standard.price, 29);
  assert.equal(plans.premium.price, 79);

  console.log("All subscription tests passed! ✓");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
