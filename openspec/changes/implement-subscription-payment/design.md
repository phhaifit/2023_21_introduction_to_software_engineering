## Context

The foundation defines subscription plans in shared contracts, a backend module boundary, a frontend feature boundary, and a payment webhook worker placeholder. V1 should demonstrate the subscription lifecycle without requiring real money movement.

## Goals / Non-Goals

**Goals:**
- Support Standard and Premium plan selection.
- Initiate purchase, renewal, and upgrade payment flows through a payment adapter.
- Reconcile payment callbacks asynchronously through a worker.
- Track subscription status, expiration, and transaction history.
- Emit public events for subscription changes that workspace provisioning can observe.

**Non-Goals:**
- Real production payment settlement.
- Tax, invoice, coupon, refund, or dispute management.
- Multiple payment providers in V1.

## Decisions

1. Use a mock/sandbox payment adapter for V1.
   - Rationale: It keeps the school demo reliable and avoids handling real financial data.
   - Alternative considered: Direct production payment gateway. Rejected for V1 because it adds compliance and operational risk.

2. Process payment callbacks through workers.
   - Rationale: Payment reconciliation is retryable and should not block HTTP request handling.
   - Alternative considered: Complete reconciliation directly inside the checkout callback request. Rejected because callback retries and failures are easier to handle asynchronously.

3. Store subscription state separately from workspace runtime state.
   - Rationale: Subscription owns billing entitlement; workspace management owns OpenClaw provisioning.
   - Alternative considered: Put plan data directly on workspace records only. Rejected because renewals and transactions need their own lifecycle.

4. Treat upgrades as subscription events that workspace management can consume.
   - Rationale: Upgrading from Standard to Premium may require OpenClaw resource changes, but runtime changes belong behind the workspace/OpenClaw boundary.

## Risks / Trade-offs

- Mock payments may hide provider-specific edge cases -> Keep provider behavior behind an adapter and document the demo assumptions.
- Upgrade flow touches workspace resources -> Use domain events instead of private module imports.
- Expiration notifications may be incomplete in V1 -> Store explicit expiration state so notification jobs can be added later.
