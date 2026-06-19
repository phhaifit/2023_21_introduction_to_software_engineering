## 1. Subscription Domain

- [ ] 1.1 Define subscription, plan, payment intent, and transaction models or repository interfaces
- [ ] 1.2 Implement Standard and Premium plan lookup using shared plan contracts
- [ ] 1.3 Implement subscription status and expiration calculation

## 2. Payment Flow

- [ ] 2.1 Implement mock/sandbox payment adapter for checkout and callbacks
- [ ] 2.2 Implement checkout initiation for purchases, renewals, and upgrades
- [ ] 2.3 Implement payment callback handler that enqueues reconciliation work
- [ ] 2.4 Implement payment webhook worker reconciliation for success and failure outcomes
- [ ] 2.5 Emit subscription lifecycle events for activation, renewal, and upgrade

## 3. Frontend Experience

- [ ] 3.1 Build plan selection UI for Standard and Premium
- [ ] 3.2 Build checkout status, subscription detail, and transaction history views
- [ ] 3.3 Build upgrade flow from Standard to Premium

## 4. Verification and Handoff

- [ ] 4.1 Add tests for plan selection, checkout initiation, callback reconciliation, and upgrade
- [ ] 4.2 Add tests that payment failures do not activate or upgrade subscriptions
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with mock payment assumptions and event contracts
