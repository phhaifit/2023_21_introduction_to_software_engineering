## Why

Workspaces need a subscription plan before the platform can provision the right OpenClaw runtime resources. This change defines the subscription and payment flow with a demo-safe payment adapter.

## What Changes

- Add Standard and Premium subscription plan selection.
- Add checkout or mock payment initiation for new purchases and renewals.
- Add payment webhook or callback reconciliation through a worker job.
- Add subscription upgrade from Standard to Premium.
- Add transaction history, subscription status, and expiration notification states.

## Capabilities

### New Capabilities
- `subscription-payment`: Plan selection, payment processing, upgrades, subscription lifecycle, transaction history, and payment callback handling.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/subscription-payment`
- Frontend feature: `apps/frontend/src/features/subscription-payment`
- Worker job: `apps/workers/src/jobs/payment-webhook`
- Shared contracts: subscription plans, lifecycle statuses, API responses, and domain events
- External boundary: mock/sandbox payment adapter only for V1
