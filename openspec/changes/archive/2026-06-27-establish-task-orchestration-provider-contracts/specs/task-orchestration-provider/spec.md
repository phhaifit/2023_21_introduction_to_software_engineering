# Task Orchestration Provider Boundary Specification

## ADDED Requirements

### Requirement: TaskOrchestrationClient Contract

The system SHALL define a `TaskOrchestrationClient` interface as the exclusive integration boundary between workspace UI and any task execution runtime.

The interface SHALL support creating a task, reading a task, canceling a task, subscribing to runtime events for a task, and unsubscribing from those events.

#### Scenario: Create a task through the client contract

* **GIVEN** a valid task input (prompt and routing selection)
* **WHEN** `createTask` is called on the active `TaskOrchestrationClient`
* **THEN** the client SHALL return a `CreatedTaskRecord` containing Task ID, Work ID, initial status, and creation timestamp
* **AND** the Task ID SHALL be unique and immutable for the lifetime of the task
* **AND** no provider-specific type SHALL appear in the return value

#### Scenario: Subscribe to runtime events scoped to a Task ID

* **GIVEN** a Task ID for an active task
* **WHEN** `subscribeToTaskEvents` is called with that Task ID and a handler function
* **THEN** the client SHALL deliver `TaskRuntimeEvent` instances to the handler
* **AND** events for a different Task ID SHALL NOT be delivered to this subscription
* **AND** the subscription SHALL return a `TaskEventSubscription` handle

#### Scenario: Unsubscribe from runtime events

* **GIVEN** an active `TaskEventSubscription`
* **WHEN** `unsubscribeFromTaskEvents` is called with that subscription handle
* **THEN** the handler SHALL stop receiving events
* **AND** no further events for that Task ID SHALL be delivered to the removed handler

#### Scenario: Cancel a task through the client contract

* **GIVEN** a Task ID for a Pending or In-Progress task
* **WHEN** `cancelTask` is called
* **THEN** the provider SHALL initiate cancellation
* **AND** the provider SHALL subsequently emit a `task-canceled` event for that Task ID

#### Scenario: Read the current task state

* **GIVEN** a Task ID for an existing task
* **WHEN** `getTask` is called
* **THEN** the client SHALL return the current `TaskRecord` snapshot for that Task ID
* **AND** if the Task ID is not found the client SHALL return `null`

---

### Requirement: TaskRuntimeEvent Contract

The system SHALL define a `TaskRuntimeEvent` discriminated union covering all runtime event kinds that any provider may emit.

The closed event union SHALL cover exactly: `task-accepted`, `task-started`, `routing-resolved`, `step-started`, `step-completed`, `partial-output`, `task-completed`, `task-failed`, and `task-canceled`.

Every event SHALL carry at minimum the Task ID, Work ID, and an ISO-8601 occurrence timestamp.

#### Scenario: Emit task-accepted event

* **WHEN** a task is confirmed by the execution runtime
* **THEN** a `task-accepted` event SHALL be emitted carrying Task ID, Work ID, and timestamp

#### Scenario: Emit task-started event

* **WHEN** the runtime begins executing a task
* **THEN** a `task-started` event SHALL be emitted
* **AND** no further `task-accepted` event SHALL be emitted for the same Task ID

#### Scenario: Emit routing-resolved event

* **WHEN** the runtime determines the routing target for a task
* **THEN** a `routing-resolved` event SHALL be emitted carrying the resolved routing mode and target identifier when applicable

#### Scenario: Emit step-started and step-completed events

* **WHEN** a processing step begins
* **THEN** a `step-started` event SHALL be emitted carrying the step name and index
* **WHEN** that processing step finishes successfully
* **THEN** a `step-completed` event SHALL be emitted carrying the same step name and index

#### Scenario: Emit partial-output event

* **WHEN** a streaming result chunk is available
* **THEN** a `partial-output` event SHALL be emitted carrying the chunk text
* **AND** partial-output events SHALL NOT be emitted after a terminal event for the same Task ID

#### Scenario: Emit task-completed event

* **WHEN** all processing steps finish successfully
* **THEN** a `task-completed` event SHALL be emitted carrying the final result
* **AND** no further events SHALL be emitted for that Task ID

#### Scenario: Emit task-failed event with error payload

* **WHEN** a processing step encounters an unrecoverable error
* **THEN** a `task-failed` event SHALL be emitted
* **AND** the event SHALL carry a `TaskError` payload with at minimum an error code and message
* **AND** no further events SHALL be emitted for that Task ID

#### Scenario: Emit task-canceled event

* **WHEN** a cancellation request is applied to a Pending or In-Progress task
* **THEN** a `task-canceled` event SHALL be emitted
* **AND** no further events SHALL be emitted for that Task ID

#### Scenario: No events after terminal event

* **GIVEN** a `task-completed`, `task-failed`, or `task-canceled` event has been emitted for a Task ID
* **WHEN** any subsequent runtime callback attempts to emit an event for that same Task ID
* **THEN** the provider SHALL suppress the event
* **AND** the subscription handler SHALL NOT receive it

---

### Requirement: ProviderConfig Selection

The system SHALL select the active task orchestration provider through configuration without requiring any UI code change.

#### Scenario: Select mock provider via configuration

* **GIVEN** the provider configuration specifies `type: "mock"`
* **WHEN** the application initializes
* **THEN** the `MockTaskOrchestrationProvider` adapter SHALL be used as the active `TaskOrchestrationClient`
* **AND** all existing mock lifecycle behaviors SHALL remain available

#### Scenario: Select HTTP provider via configuration

* **GIVEN** the provider configuration specifies `type: "http"` with a `baseUrl`
* **WHEN** the application initializes
* **THEN** the `HttpTaskOrchestrationProvider` SHALL be used as the active `TaskOrchestrationClient`
* **AND** the UI SHALL require no code change to switch from the mock provider

#### Scenario: Provider identity is invisible to UI components

* **WHEN** any workspace UI component renders a task status badge, timeline, streaming result, or cancellation dialog
* **THEN** the component SHALL NOT inspect the active provider type
* **AND** rendering SHALL be driven solely by `TaskRuntimeEvent` payloads and `TaskRecord` state

---

### Requirement: MockTaskOrchestrationProvider Adapter Fidelity

The `MockTaskOrchestrationProvider` SHALL wrap the existing in-browser mock orchestration service and expose it through `TaskOrchestrationClient` without altering internal mock behavior.

#### Scenario: Mock adapter produces required event sequence for a successful task

* **WHEN** a task is created and executed via `MockTaskOrchestrationProvider`
* **THEN** the adapter SHALL emit `task-accepted`, `task-started`, one or more `step-started` / `step-completed` pairs, zero or more `partial-output` events, and `task-completed` in that relative order

#### Scenario: Mock adapter produces correct event sequence for a failed task

* **GIVEN** the prompt begins with `FAIL_SIMULATION:`
* **WHEN** the mock execution reaches the configured failure stage
* **THEN** the adapter SHALL emit `task-failed` with a `TaskError` payload
* **AND** no `task-completed` event SHALL be emitted for that Task ID

#### Scenario: Mock adapter produces correct event sequence for a canceled task

* **GIVEN** `cancelTask` is called for a Pending or In-Progress task
* **WHEN** cancellation is applied
* **THEN** the adapter SHALL emit `task-canceled`
* **AND** no further events SHALL be emitted for that Task ID

#### Scenario: Mock adapter respects existing timing configuration

* **WHEN** timing configuration overrides are applied for test environments
* **THEN** the mock adapter SHALL honor those overrides without code changes

---

### Requirement: HttpTaskOrchestrationProvider Boundary

The `HttpTaskOrchestrationProvider` SHALL declare the `TaskOrchestrationClient` interface and bind to an HTTP backend configuration, without implementing real transport in this change.

#### Scenario: HttpTaskOrchestrationProvider satisfies client interface at compile time

* **WHEN** the provider boundary definition is compiled
* **THEN** `HttpTaskOrchestrationProvider` SHALL satisfy the `TaskOrchestrationClient` type contract with no type errors

#### Scenario: HTTP provider configuration is validated at initialization

* **GIVEN** `ProviderConfig` specifies `type: "http"`
* **WHEN** the provider is initialized
* **THEN** the provider SHALL require a non-empty `baseUrl`
* **AND** an optional `timeoutMs` with a sensible default SHALL be accepted

---

### Requirement: Runtime Ownership Anchored to Task ID

Runtime event delivery SHALL be anchored to immutable Task ID and SHALL NOT be affected by conversation selection.

#### Scenario: Background task continues receiving events when conversation switches

* **GIVEN** Task A is running and belongs to Conversation 1
* **WHEN** the user switches to Conversation 2 and Task A continues execution
* **THEN** Task A's subscription handler SHALL continue to receive events
* **AND** no event for Task A SHALL be suppressed due to Conversation 2 being active

#### Scenario: Unsubscribing does not affect other Task subscriptions

* **GIVEN** subscriptions exist for Task A and Task B
* **WHEN** the subscription for Task A is unsubscribed
* **THEN** Task B's subscription SHALL continue to receive events normally
