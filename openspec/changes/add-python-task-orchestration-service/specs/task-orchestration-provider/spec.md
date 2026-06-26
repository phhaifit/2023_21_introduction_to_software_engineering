# Task Orchestration Provider — Python Service Integration Delta Specification

## MODIFIED Requirements

### Requirement: HttpTaskOrchestrationProvider Real Implementation

The `HttpTaskOrchestrationProvider` SHALL implement all five `TaskOrchestrationClient` methods using real HTTP calls to the Python orchestration service, and SHALL translate SSE frames into typed `TaskRuntimeEvent` instances.

#### Scenario: Create task calls Python service POST endpoint

* **GIVEN** `ProviderConfig` specifies `type: "http"` and a valid `baseUrl`
* **WHEN** `createTask` is called on `HttpTaskOrchestrationProvider`
* **THEN** the adapter SHALL call `POST {baseUrl}/api/v1/tasks` with the prompt and routing payload
* **AND** on HTTP 201 the adapter SHALL return a `CreatedTaskRecord` with Task ID, Work ID, initial status, and creation timestamp
* **AND** on HTTP 400 or 422 the adapter SHALL surface a creation failure to the caller

#### Scenario: Subscribe opens SSE connection and delivers events

* **GIVEN** a Task ID for a task running on the Python service
* **WHEN** `subscribeToTaskEvents` is called
* **THEN** the adapter SHALL open an SSE connection to `GET {baseUrl}/api/v1/tasks/{taskId}/events`
* **AND** each received SSE data frame SHALL be parsed as a `TaskRuntimeEvent` and delivered to the handler
* **AND** the connection SHALL be closed after the terminal event is received

#### Scenario: Unsubscribe closes the SSE connection

* **GIVEN** an active SSE subscription via `HttpTaskOrchestrationProvider`
* **WHEN** `unsubscribeFromTaskEvents` is called
* **THEN** the adapter SHALL close the underlying SSE connection
* **AND** no further events SHALL be delivered to the handler

#### Scenario: Cancel task calls Python service cancel endpoint

* **GIVEN** a Task ID for a non-terminal task
* **WHEN** `cancelTask` is called
* **THEN** the adapter SHALL call `POST {baseUrl}/api/v1/tasks/{taskId}/cancel`
* **AND** on HTTP 200 the adapter SHALL resolve without error
* **AND** on HTTP 409 the adapter SHALL resolve without error (task already terminal)
* **AND** on HTTP 404 the adapter SHALL surface a not-found error

#### Scenario: HTTP provider does not silently fall back to mock on health failure

* **GIVEN** `ProviderConfig` specifies `type: "http"`
* **WHEN** `GET {baseUrl}/api/v1/health` is unreachable at initialization
* **THEN** the adapter SHALL surface a clear service-unavailable error
* **AND** the adapter SHALL NOT redirect calls to the mock provider
