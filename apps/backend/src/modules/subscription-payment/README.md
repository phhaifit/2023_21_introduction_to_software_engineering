# Subscription & Payment Module

Owner: Member 2

OpenSpec change: `implement-subscription-payment`

Current OpenSpec status: in progress, 0/15 tasks checked as of 2026-07-08.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own plans, subscriptions, transactions, payment callbacks, and upgrade events.
- Publish entitlement changes through shared domain events.
- Do not provision OpenClaw runtimes directly; request workspace/runtime changes through contracts.

Current implementation:

- `createSubscriptionRouter()` is mounted at `/api/subscriptions`.
- Implemented route family includes subscription details, usage, plans, checkout, upgrade, mock callback, promo validation, auto-renewal toggle, payment-method management, cancel, VNPay checkout/return/IPN/saved-method binding, and Stripe setup/confirm/charge endpoints.
- Frontend billing UI exists under `apps/frontend/src/features/subscription-payment`.
- A renewal cron is started by the local development server composition.

Known documentation/spec gap:

- The active OpenSpec checklist still shows 0/15 tasks complete even though backend and frontend code exist.
- Treat the module as implemented-in-code but provisional until payment-provider assumptions, reconciliation behavior, tests, and task checkboxes are aligned.
- Dependency audit currently reports vulnerable payment/email-related dependencies; handle upgrades in a separate reviewed change.
