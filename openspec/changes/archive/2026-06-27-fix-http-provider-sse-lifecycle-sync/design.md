## Context

The `HttpTaskOrchestrationProvider` currently exhibits a subtle race condition during task creation. When `createTask` is invoked, it awaits the execution start HTTP request (`fetch`) before returning the created task record. During this synchronous await, the backend immediately begins task processing and broadcasts the `execution-accepted` and `execution-started` Server-Sent Events (SSE). The frontend UI component (`TaskOrchestrationPage`) subscribes to the SSE stream via `subscribeToTaskEvents` only after `createTask` returns. Consequently, the frontend `EventSource` connects after the initial lifecycle events have passed, causing `task.status` to remain in `queued` (Pending). Due to strict invariants in `taskCreationReducer` and `task-completion.ts`, subsequent streaming fragments and completion events are rejected because the task is not in `running` status and the canonical processing steps have not progressed.

## Goals / Non-Goals

**Goals:**
- Eliminate the race condition by making the execution start HTTP request non-blocking in `createTask`, allowing the SSE connection to be established prior to backend event broadcast.
- Provide a robust self-healing mechanism (state bootstrapping) in `HttpTaskOrchestrationProvider` to automatically transition tasks from `queued` to `running` upon receiving any runtime event if initial lifecycle events were missed.
- Synchronize incoming OpenClaw step events with the frontend's strict processing lifecycle sequence (`validate-input`, `analyze-request`, `select-routing`, `execute-task`, `aggregate-result`, `finalize`) to fulfill `isTaskReadyForCompletion` invariants.

**Non-Goals:**
- Do not alter the core pure state machine logic (`task-processing.ts`, `task-streaming.ts`, `task-completion.ts`).
- Do not modify backend API boundaries or OpenClaw Gateway runtime behavior.

## Decisions

### 1. Non-Blocking Execution Start Request
- **Decision**: Wrap the `fetch` call inside `createTask` in a `setTimeout(() => { ... }, 50)` block and remove the `await`.
- **Rationale**: This allows `createTask` to immediately return the newly created task record to `TaskOrchestrationPage`, which instantly sets up the `EventSource` subscription. When the HTTP request executes 50ms later, the SSE connection is already active and receives all events in perfect sequence.
- **Alternatives Considered**: Modifying `TaskOrchestrationPage` to establish the subscription before calling `createTask`. This was rejected as it would require structural changes to `TaskOrchestrationClient` interface contracts and impact mock providers.

### 2. Event-Driven State Bootstrapping & Step Alignment
- **Decision**: In `HttpTaskOrchestrationProvider.subscribeToTaskEvents`, intercept incoming SSE events to verify and align local task state before invoking `handler`.
- **Rationale**: 
  - If a task is still `queued` when `step-started` or `partial-output-received` arrives, `applyAction({ type: "processing-started" })` will be dispatched automatically.
  - When `step-started` arrives, `applyAction` will be used to sequentially activate and complete `validate-input`, `analyze-request`, and `select-routing`, and activate `execute-task`.
  - When `execution-completed` arrives, `applyAction` will complete `execute-task`, activate and complete `aggregate-result`, activate `finalize`, ensure `streaming-exhausted` is called, and inject `finalizedAt` into the completion payload.
- **Alternatives Considered**: Loosening the invariant checks in `taskCreationReducer`. This was rejected because strict invariants ensure predictability and prevent invalid state transitions across the platform.

## Risks / Trade-offs

- **Risk**: A 50ms delay in starting execution might slightly increase perceived latency.
  - **Mitigation**: 50ms is imperceptible to users and provides an extremely reliable window for `EventSource` connection establishment across various browser environments.
