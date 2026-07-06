## MODIFIED Requirements

### Requirement: Provider-Independent UI Behavior

The workspace UI SHALL derive all rendering from `TaskRuntimeEvent` payloads and canonical `TaskRecord` state. The UI SHALL NOT branch on the active provider type for any rendering path including status badges, timeline display, streaming output, processing detail modal, or cancellation dialog. Runtime text chunks received from a provider SHALL be visible in the assistant response while the Task is In-Progress without depending on mock-only processing step identifiers.

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

#### Scenario: Runtime progress is transient until output streaming begins

* **GIVEN** the active provider is `mock` or `http`
* **AND** an In-Progress task has displayable runtime activity but no assistant output text yet
* **WHEN** the assistant response is rendered
* **THEN** the UI SHALL display only the latest displayable runtime activity as plain assistant message text
* **AND** newer runtime activity SHALL replace the previous runtime activity text
* **AND** visible logs, progress feeds, chips, tags, boxes, and step counters SHALL NOT be rendered in the assistant response
* **WHEN** provider partial output text becomes available
* **THEN** the UI SHALL replace the transient runtime activity with the streaming assistant output

#### Scenario: Cancellation initiates via client contract regardless of provider

* **GIVEN** a task is Pending or In-Progress
* **WHEN** the user confirms cancellation
* **THEN** the UI SHALL call `cancelTask` on the active `TaskOrchestrationClient`
* **AND** the UI SHALL NOT call a provider-specific cancellation method directly

#### Scenario: HTTP provider partial output is visible without mock step IDs

* **GIVEN** the active provider is `http`
* **AND** a task is In-Progress with accumulated partial output
* **AND** the active processing step was created from OpenClaw provider activity rather than mock step identifiers
* **WHEN** the assistant response is rendered
* **THEN** the accumulated partial output SHALL be visible in the assistant response
* **AND** the UI SHALL NOT require `execute-task`, `aggregate-result`, or `finalize` step IDs to display provider output
