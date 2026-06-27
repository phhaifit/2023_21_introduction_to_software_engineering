## MODIFIED Requirements

### Requirement: HttpTaskOrchestrationProvider Boundary

The `HttpTaskOrchestrationProvider` SHALL declare the `TaskOrchestrationClient` interface, bind to an HTTP backend configuration, execute non-blocking execution start requests to prevent race conditions with SSE subscriptions, and enforce strict frontend processing lifecycle synchronization.

#### Scenario: HttpTaskOrchestrationProvider satisfies client interface at compile time

* **WHEN** the provider boundary definition is compiled
* **THEN** `HttpTaskOrchestrationProvider` SHALL satisfy the `TaskOrchestrationClient` type contract with no type errors

#### Scenario: HTTP provider configuration is validated at initialization

* **GIVEN** `ProviderConfig` specifies `type: "http"`
* **WHEN** the provider is initialized
* **THEN** the provider SHALL require a non-empty `baseUrl`
* **AND** an optional `timeoutMs` with a sensible default SHALL be accepted

#### Scenario: Execution start request is non-blocking to ensure SSE connection readiness

* **GIVEN** `createTask` is called on `HttpTaskOrchestrationProvider`
* **WHEN** the backend execution start API is invoked
* **THEN** the HTTP request SHALL be executed asynchronously without blocking the return of the created task record
* **AND** the frontend client SHALL be able to establish the SSE subscription before backend lifecycle events are broadcast

#### Scenario: Event-driven state bootstrapping and strict lifecycle alignment

* **GIVEN** an active SSE subscription in `HttpTaskOrchestrationProvider`
* **WHEN** runtime events are received from the backend stream
* **THEN** the provider SHALL ensure the local task status transitions from `queued` to `running` upon receiving active processing events
* **AND** incoming step events SHALL be aligned with the canonical frontend processing sequence to maintain strict state invariants
