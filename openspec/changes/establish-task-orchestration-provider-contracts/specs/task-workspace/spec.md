# Task Workspace Provider Integration Delta Specification

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
