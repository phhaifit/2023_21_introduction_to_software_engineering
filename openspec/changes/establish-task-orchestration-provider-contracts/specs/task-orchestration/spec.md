# Task & Orchestration Provider Integration Delta Specification

## MODIFIED Requirements

### Requirement: Provider-Independent UI Behavior

The workspace UI SHALL derive all rendering from `TaskRuntimeEvent` payloads and canonical `TaskRecord` state. The UI SHALL NOT branch on the active provider type for any rendering path including status badges, timeline display, streaming output, processing detail modal, or cancellation dialog.

#### Scenario: Status badge is driven by canonical task status, not provider type

* **GIVEN** the active provider is `mock` or `http`
* **WHEN** a task card is rendered in the execution feed
* **THEN** the status badge SHALL display the canonical task status (Pending, In-Progress, Completed, Failed, or Canceled)
* **AND** the badge rendering path SHALL NOT inspect the active provider type

#### Scenario: Streaming display is driven by partial-output events, not provider type

* **GIVEN** the active provider is `mock` or `http`
* **WHEN** `partial-output` events are received for an In-Progress task
* **THEN** the execution feed SHALL append the chunk to the partial result
* **AND** the streaming update logic SHALL NOT inspect the active provider type

#### Scenario: Cancellation initiates via client contract regardless of provider

* **GIVEN** a task is Pending or In-Progress
* **WHEN** the user confirms cancellation
* **THEN** the UI SHALL call `cancelTask` on the active `TaskOrchestrationClient`
* **AND** the UI SHALL NOT call a provider-specific cancellation method directly

---

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
