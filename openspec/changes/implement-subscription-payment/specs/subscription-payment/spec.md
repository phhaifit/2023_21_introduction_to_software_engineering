## ADDED Requirements

### Requirement: Subscription Plan Selection
The system SHALL allow users to select a Standard or Premium workspace subscription plan.

#### Scenario: Plan selected
- **WHEN** a user selects a subscription plan
- **THEN** the system records the selected plan and prepares the correct payment flow for that plan

### Requirement: Payment Initiation
The system SHALL initiate a payment or mock payment flow for new purchases and renewals.

#### Scenario: Checkout created
- **WHEN** a user starts checkout for a valid plan
- **THEN** the system creates a payment intent or mock checkout session and returns the next action to the frontend

#### Scenario: Invalid checkout rejected
- **WHEN** a user starts checkout for an unsupported plan or invalid workspace
- **THEN** the system rejects the request with a shared API error response

### Requirement: Payment Callback Reconciliation
The system SHALL reconcile payment callbacks asynchronously.

#### Scenario: Successful payment callback
- **WHEN** the payment adapter reports a successful payment
- **THEN** the worker records the transaction and activates or renews the subscription

#### Scenario: Failed payment callback
- **WHEN** the payment adapter reports a failed payment
- **THEN** the worker records the failed transaction and leaves the subscription inactive or unchanged

### Requirement: Subscription Upgrade
The system SHALL support upgrading a workspace subscription from Standard to Premium.

#### Scenario: Upgrade paid successfully
- **WHEN** a Standard subscription upgrade payment succeeds
- **THEN** the system updates the subscription to Premium and emits an event for runtime resource adjustment

### Requirement: Subscription Status and Transactions
The system SHALL expose subscription status, expiration, and transaction history.

#### Scenario: Subscription details viewed
- **WHEN** an authenticated user views subscription details
- **THEN** the system returns the active plan, status, expiration time, and related transactions
