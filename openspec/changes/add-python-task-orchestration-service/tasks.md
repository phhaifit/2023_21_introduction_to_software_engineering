# Python Task Orchestration Service — Tasks

## 1. Service API Contract and Schema Definitions

**Objective**: Define and validate all request/response schemas, canonical status values, and SSE event frame format for the Python orchestration service API.

**Scope**:
- Pydantic models for `CreateTaskRequest` (prompt, routing input discriminated union).
- Pydantic models for `TaskRecord` response (Task ID, Work ID, status, prompt, routing, timestamps, result, error).
- `RoutingInput` discriminated union: `auto`, `specific-agent` with `agentId`, `predefined-workflow` with `workflowId`.
- `TaskRuntimeEvent` Pydantic models for each of the nine event kinds matching the frontend contract.
- `TaskError` model (code, message) embedded in `task-failed` event.
- Canonical service-side task status enum: `pending`, `running`, `completed`, `failed`, `canceled`.
- HTTP status code table for all five endpoints (including 400, 404, 409, 422).
- SSE frame format: `data: <JSON>` lines, one event per frame, stream closed after terminal event.

**Acceptance Criteria**:
- All nine `TaskRuntimeEvent` kinds are represented as Pydantic models.
- `RoutingInput` validation rejects a request with `mode: "specific-agent"` and no `agentId`.
- `RoutingInput` validation rejects a request with `mode: "predefined-workflow"` and no `workflowId`.
- `TaskError` includes at minimum `code` (string) and `message` (string).
- Schema models are compatible with the `TaskRuntimeEvent` union defined in `task-orchestration-provider` spec.

---

## 2. Python Service Infrastructure and In-Memory Repository

**Objective**: Set up the Python FastAPI service project structure, configuration, CORS, and in-memory task repository.

**Scope**:
- New `services/task-orchestration/` directory with `pyproject.toml`, `README.md`, and basic FastAPI application entry point.
- Configuration via environment variables: `HOST`, `PORT`, `STEP_DELAY_MS`, `CHUNK_DELAY_MS`, `LOG_LEVEL`.
- CORS middleware with configurable allowed origins.
- `InMemoryTaskRepository`: dictionary keyed by Task ID storing `TaskRecord` and per-task cancellation signal.
- Thread/async-safe access pattern for the in-memory repository.
- `GET /api/v1/health` endpoint returning service status, version, executor type (`mock`), and active task count.
- Service `README.md` explicitly stating in-memory scope and restart behavior.

**Acceptance Criteria**:
- `uvicorn services/task-orchestration/main:app` starts the service without errors.
- `GET /api/v1/health` returns 200 with `{ status: "ok", executorType: "mock" }`.
- Repository stores and retrieves task records by Task ID without race conditions under concurrent async access.
- CORS allows requests from configurable frontend origins.
- Service `README.md` states that all tasks are lost on service restart.

**Dependencies**: Task 1.

---

## 3. Task Lifecycle Endpoints: Create, Read, Cancel

**Objective**: Implement `POST /api/v1/tasks`, `GET /api/v1/tasks/{taskId}`, and `POST /api/v1/tasks/{taskId}/cancel`.

**Scope**:
- `POST /api/v1/tasks`: validates request, generates Task ID and Work ID, stores initial `pending` record, starts mock executor as an async task, returns 201.
- Prompt validation: reject empty or whitespace-only prompts with 400.
- Routing validation: reject missing `agentId` or `workflowId` for their respective modes with 422.
- `GET /api/v1/tasks/{taskId}`: returns current `TaskRecord` or 404 if not found.
- `POST /api/v1/tasks/{taskId}/cancel`: sets per-task cancellation signal; returns 200 if task is non-terminal, 404 if not found, 409 if already terminal.
- Task ID and Work ID generation: unique strings (e.g., UUID4 or prefixed nanoid).

**Acceptance Criteria**:
- Empty prompt returns 400; no task is created.
- `specific-agent` without `agentId` returns 422; no task is created.
- Valid create request returns 201 with `taskId`, `workId`, `status: "pending"`, `createdAt`.
- `GET` for existing task returns 200 with current status.
- `GET` for unknown task returns 404.
- `POST cancel` for Pending task returns 200 and sets cancellation signal.
- `POST cancel` for terminal task returns 409.
- Two concurrent `POST /api/v1/tasks` calls produce two independent tasks with different IDs.

**Dependencies**: Task 2.

---

## 4. Python Mock Executor with SSE Streaming

**Objective**: Implement the async Python mock executor and `GET /api/v1/tasks/{taskId}/events` SSE endpoint.

**Scope**:
- `PythonMockExecutor`: async generator that emits nine `TaskRuntimeEvent` kinds in the required sequence for a successful task.
- Six-stage orchestration timeline: Validate input → Analyze request → Select agent or workflow → Execute task → Aggregate result → Finalize.
- `STEP_DELAY_MS` controls inter-step delay.
- `CHUNK_DELAY_MS` controls inter-chunk delay for partial output streaming.
- `FAIL_SIMULATION:` prefix in prompt causes executor to emit `task-failed` at the Aggregate result stage.
- Per-task cancellation signal: executor checks the signal at each step boundary; if set, emits `task-canceled` and stops.
- `GET /api/v1/tasks/{taskId}/events`: streams executor output as SSE frames; closes stream after terminal event; returns 404 if task not found.
- SSE frame format: `data: <JSON>\n\n` per event.
- Service updates the `InMemoryTaskRepository` as each terminal event is emitted.

**Acceptance Criteria**:
- Successful task produces SSE events: `task-accepted`, `task-started`, six pairs of `step-started`/`step-completed`, one or more `partial-output`, `task-completed`.
- `FAIL_SIMULATION:` task produces events up to the failure stage, then `task-failed` with `TaskError` payload; stream closes.
- Canceled task produces `task-canceled`; stream closes; no further events.
- `partial-output` events are NOT emitted after terminal event for the same task.
- Two concurrent tasks run independently; canceling Task A does not affect Task B.
- Executor respects `STEP_DELAY_MS` and `CHUNK_DELAY_MS` configuration.
- Stream closes after terminal event without requiring client disconnect.

**Dependencies**: Task 3.

---

## 5. Frontend HttpTaskOrchestrationProvider Real Implementation

**Objective**: Replace the `HttpTaskOrchestrationProvider` stub with a real frontend adapter that connects to the Python service and translates SSE events into `TaskRuntimeEvent` instances.

**Scope**:
- Real `createTask` implementation: `POST /api/v1/tasks` with prompt and routing payload; returns `CreatedTaskRecord`.
- Real `getTask` implementation: `GET /api/v1/tasks/{taskId}`; returns `TaskRecord` snapshot.
- Real `cancelTask` implementation: `POST /api/v1/tasks/{taskId}/cancel`.
- Real `subscribeToTaskEvents` implementation: opens SSE connection to `GET /api/v1/tasks/{taskId}/events`; parses each frame as `TaskRuntimeEvent`; delivers to handler; closes connection on terminal event or unsubscription.
- Real `unsubscribeFromTaskEvents`: closes the underlying SSE connection.
- Health check on provider initialization: if `GET /api/v1/health` is unreachable, surface a clear error; no silent fallback to mock.
- Configurable `baseUrl` and `timeoutMs` from `ProviderConfig` `http` variant.
- Mock frontend provider continues to satisfy `TaskOrchestrationClient` and remains selectable.

**Acceptance Criteria**:
- Creating a task via `HttpTaskOrchestrationProvider` calls `POST /api/v1/tasks` and returns a `CreatedTaskRecord` with correct Task ID and Work ID.
- Subscribing to task events opens an SSE connection; each received event is passed to the handler as a typed `TaskRuntimeEvent`.
- Unsubscribing closes the SSE connection.
- No `TaskRuntimeEvent` is delivered after unsubscription.
- The frontend displays the correct task lifecycle states (Pending → In-Progress → Completed/Failed/Canceled) when driven by the Python service.
- Selecting `ProviderConfig: { type: "mock" }` continues to use the mock adapter with full behavioral parity.
- No UI component file is modified to accommodate the HTTP provider.

**Dependencies**: Task 4.

---

## 6. Integration, Spec, and Validation

**Objective**: Verify end-to-end integration between the frontend HTTP adapter and the Python service, validate OpenSpec documents, and confirm zero regression.

**Scope**:
- Manual or automated integration test: start Python service, set `ProviderConfig` to `http`, submit a task from the frontend, observe correct event sequence in the execution feed.
- Verify `FAIL_SIMULATION:` task fails correctly through the HTTP path.
- Verify cancellation stops execution in the Python service.
- `openspec validate "add-python-task-orchestration-service" --strict` exits 0.
- `openspec validate --all --strict` exits 0.
- `npm test` exits 0.
- `npm run build` exits 0.
- Existing mock-provider frontend test suite passes without modification.

**Acceptance Criteria**:
- End-to-end task lifecycle (submit → in-progress → completed) works via HTTP provider.
- `FAIL_SIMULATION:` produces Failed state in the frontend via HTTP provider.
- Cancel via HTTP provider transitions task to Canceled in both service and frontend.
- All OpenSpec validations pass.
- No existing frontend test regresses.

**Dependencies**: Task 5.
