## Why

The Task & Orchestration workspace currently runs all execution logic in the browser using a mock service. To demonstrate real client-server separation and prepare for AI-assisted routing, a Python FastAPI orchestration service is needed that exposes a real HTTP API while using mock execution internally. This service implements the `HttpTaskOrchestrationProvider` boundary defined in `establish-task-orchestration-provider-contracts`, enabling the frontend to hand off task execution to an actual backend process without changing any UI code.

## What Changes

- Define the Python FastAPI orchestration service API with five endpoints: `POST /api/v1/tasks`, `GET /api/v1/tasks/{taskId}`, `POST /api/v1/tasks/{taskId}/cancel`, `GET /api/v1/tasks/{taskId}/events`, `GET /api/v1/health`.
- Define request and response schemas for all endpoints including canonical task status, routing selection payload, `TaskRuntimeEvent` over SSE, and `TaskError`.
- Define an in-memory task repository owned by the Python service for the initial implementation scope.
- Define a Python mock executor that reproduces the same `TaskRuntimeEvent` sequence as the existing frontend mock provider.
- Define concurrent task execution semantics: multiple tasks run independently by Task ID.
- Define cancellation semantics: cancel affects exactly the identified task and stops its execution.
- Define deterministic failure via `FAIL_SIMULATION:` trigger in the prompt, consistent with the existing frontend convention.
- Define partial output streaming over SSE.
- Define the frontend `HttpTaskOrchestrationProvider` real implementation: it calls the Python service API and translates SSE events into `TaskRuntimeEvent` instances.
- Specify that the mock frontend provider remains selectable and fully functional when the Python service is not active.
- Define health and provider information endpoint semantics.

## Capabilities

### New Capabilities

- `task-orchestration-service`: Covers the Python FastAPI orchestration service API contract, request/response schemas, in-memory task repository, mock executor behavior, concurrent execution, cancellation, deterministic failure, partial output streaming over SSE, and health endpoint.

### Modified Capabilities

- `task-orchestration-provider`: The `HttpTaskOrchestrationProvider` transitions from a boundary stub to a real frontend adapter implementation connected to the Python service. Mock frontend provider continues to satisfy `TaskOrchestrationClient`.

## Impact

- **New service — Python FastAPI**: A new standalone process in the repository (e.g., `services/task-orchestration/`) exposing the HTTP API. No existing backend code is modified.
- **Frontend — HttpTaskOrchestrationProvider**: The stub from `establish-task-orchestration-provider-contracts` is replaced with a real implementation that uses `fetch` and `EventSource` (or equivalent SSE client) to connect to the Python service.
- **No shared contract changes**: `@vcp/shared` is unchanged. The service API is internal to the Task & Orchestration integration path.
- **No database**: The Python service uses in-memory storage only. This is explicitly scoped and not represented as a production persistence solution.
- **No AI model**: The Python mock executor uses deterministic local data, not a model API.
- **Dependency**: This change requires `establish-task-orchestration-provider-contracts` to be complete before implementation begins.
