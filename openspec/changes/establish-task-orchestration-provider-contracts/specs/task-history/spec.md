# Task History Provider Integration Delta Specification

## MODIFIED Requirements

### Requirement: Runtime Ownership by Task ID

Runtime event subscriptions SHALL be keyed by Task ID. Conversation selection SHALL NOT suppress, redirect, or cancel runtime events for any task.

#### Scenario: Conversation switch does not cancel runtime event delivery

* **GIVEN** a task subscription is active for Task A in Conversation 1
* **WHEN** the user switches to Conversation 2
* **THEN** the subscription for Task A SHALL remain active
* **AND** events for Task A SHALL continue to be delivered to its handler

#### Scenario: Demo reset unsubscribes all active task subscriptions

* **WHEN** the demo reset action is invoked
* **THEN** `unsubscribeFromTaskEvents` SHALL be called for every active subscription before the task store is cleared
* **AND** no stale event SHALL update the cleared store
