# Task Orchestration Service Specification

## ADDED Requirements

### Requirement: Service API Endpoint Contract

The Python orchestration service SHALL expose five HTTP endpoints conforming to the contract defined below.

#### Scenario: Create a task via POST /api/v1/tasks

* **GIVEN** a valid `CreateTaskRequest` with a non-empty prompt and a valid routing selection
* **WHEN** `POST /api/v1/tasks` is called
* **THEN** the service SHALL create a new task record with a unique Task ID and Work ID
* **AND** the service SHALL return HTTP 201 with `taskId`, `workId`, `status: "pending"`, and `createdAt`
* **AND** the service SHALL begin mock execution asynchronously

#### Scenario: Reject empty prompt on create

* **GIVEN** a `CreateTaskRequest` with an empty or whitespace-only prompt
* **WHEN** `POST /api/v1/tasks` is called
* **THEN** the service SHALL return HTTP 400
* **AND** no task record SHALL be created
* **AND** no executor SHALL be started

#### Scenario: Reject invalid routing selection on create

* **GIVEN** a `CreateTaskRequest` with `mode: "specific-agent"` and no `agentId`
* **OR** `mode: "predefined-workflow"` and no `workflowId`
* **WHEN** `POST /api/v1/tasks` is called
* **THEN** the service SHALL return HTTP 422
* **AND** no task record SHALL be created

#### Scenario: Read a task via GET /api/v1/tasks/{taskId}

* **GIVEN** a task with the specified `taskId` exists
* **WHEN** `GET /api/v1/tasks/{taskId}` is called
* **THEN** the service SHALL return HTTP 200 with the current `TaskRecord` snapshot

#### Scenario: Task not found returns 404

* **GIVEN** no task with the specified `taskId` exists
* **WHEN** `GET /api/v1/tasks/{taskId}` or `GET /api/v1/tasks/{taskId}/events` is called
* **THEN** the service SHALL return HTTP 404

#### Scenario: Cancel a non-terminal task via POST /api/v1/tasks/{taskId}/cancel

* **GIVEN** a task with the specified `taskId` is Pending or Running
* **WHEN** `POST /api/v1/tasks/{taskId}/cancel` is called
* **THEN** the service SHALL return HTTP 200
* **AND** the service SHALL apply the cancellation signal to the task executor

#### Scenario: Cancel a terminal task returns 409

* **GIVEN** a task with the specified `taskId` is Completed, Failed, or Canceled
* **WHEN** `POST /api/v1/tasks/{taskId}/cancel` is called
* **THEN** the service SHALL return HTTP 409

#### Scenario: Health endpoint reports service status

* **WHEN** `GET /api/v1/health` is called
* **THEN** the service SHALL return HTTP 200 with `{ status: "ok", executorType: "mock", activeTaskCount }`

---

### Requirement: In-Memory Task Repository

The Python orchestration service SHALL maintain all task records in an in-memory repository for the scope of this change.

The in-memory repository SHALL NOT be represented as a production persistence solution.

#### Scenario: Tasks are lost on service restart

* **WHEN** the service process is restarted
* **THEN** all previously created task records SHALL be absent
* **AND** the service documentation SHALL explicitly state this behavior

#### Scenario: Concurrent tasks are isolated by Task ID

* **GIVEN** two tasks with different Task IDs are running concurrently
* **WHEN** either task transitions to a terminal state or receives a cancellation signal
* **THEN** only that task SHALL be affected
* **AND** the other task SHALL continue execution unaffected

---

### Requirement: Python Mock Executor Behavior

The Python mock executor SHALL produce a `TaskRuntimeEvent` sequence consistent with the event contract defined in `task-orchestration-provider`.

The mock executor SHALL reproduce the six-stage orchestration timeline.

#### Scenario: Successful task produces correct event sequence

* **GIVEN** a task is created with a normal prompt
* **WHEN** the mock executor runs to completion
* **THEN** the service SHALL emit `task-accepted`, `task-started`, `routing-resolved`, one `step-started` and `step-completed` pair per stage, one or more `partial-output` events, and `task-completed` in that relative order

#### Scenario: Deterministic failure via FAIL_SIMULATION: trigger

* **GIVEN** the task prompt begins with `FAIL_SIMULATION:`
* **WHEN** the mock executor reaches the configured failure stage
* **THEN** the service SHALL emit `task-failed` with a `TaskError` payload
* **AND** no `task-completed` event SHALL be emitted for that task

#### Scenario: Cancellation stops executor and emits task-canceled

* **GIVEN** a cancellation signal is set for a Running task
* **WHEN** the mock executor checks the signal at the next step boundary
* **THEN** the executor SHALL stop processing
* **AND** the service SHALL emit `task-canceled`
* **AND** no further events SHALL be emitted for that task

#### Scenario: No events emitted after terminal event

* **GIVEN** a terminal event (`task-completed`, `task-failed`, or `task-canceled`) has been emitted for a task
* **WHEN** any subsequent executor callback attempts to emit another event
* **THEN** the service SHALL suppress the event
* **AND** the task status SHALL remain at its terminal value

---

### Requirement: SSE Task Event Stream

The service SHALL stream `TaskRuntimeEvent` instances to the frontend via Server-Sent Events over `GET /api/v1/tasks/{taskId}/events`.

#### Scenario: SSE stream delivers events in order

* **GIVEN** a task is running and an SSE connection is established
* **WHEN** the mock executor emits events
* **THEN** the SSE stream SHALL deliver each event as a `data: <JSON>\n\n` frame
* **AND** events SHALL be delivered in emission order

#### Scenario: SSE stream closes after terminal event

* **WHEN** a terminal `TaskRuntimeEvent` (`task-completed`, `task-failed`, or `task-canceled`) is emitted
* **THEN** the SSE stream SHALL close after delivering that event
* **AND** no further frames SHALL be sent on that connection

#### Scenario: Partial output stops before terminal event closes stream

* **GIVEN** a task is in the streaming stage
* **WHEN** the task reaches its terminal state
* **THEN** all `partial-output` frames SHALL be delivered before the terminal event frame
* **AND** the stream SHALL close after the terminal event

---

### Requirement: Service Configuration

The Python orchestration service SHALL be configurable via environment variables without code changes.

#### Scenario: Configure timing via environment variables

* **GIVEN** `STEP_DELAY_MS` and `CHUNK_DELAY_MS` are set as environment variables
* **WHEN** the service starts
* **THEN** the mock executor SHALL use those delay values for step advancement and streaming chunk delivery

#### Scenario: Service starts on configured host and port

* **GIVEN** `HOST` and `PORT` environment variables are set
* **WHEN** the service starts
* **THEN** the service SHALL bind to the specified host and port

---

### Requirement: Frontend Availability When Service Is Unavailable

The mock frontend provider SHALL remain fully selectable and functional when the Python orchestration service is not running.

#### Scenario: Mock provider operates without Python service

* **GIVEN** `ProviderConfig` specifies `type: "mock"`
* **WHEN** the Python orchestration service is not running
* **THEN** the mock frontend provider SHALL handle all task operations locally
* **AND** no error related to the Python service SHALL be surfaced

#### Scenario: HTTP provider reports service unavailability explicitly

* **GIVEN** `ProviderConfig` specifies `type: "http"`
* **WHEN** `GET /api/v1/health` is unreachable at frontend initialization
* **THEN** the frontend SHALL display a clear error indicating the service is unavailable
* **AND** the frontend SHALL NOT silently fall back to the mock provider
