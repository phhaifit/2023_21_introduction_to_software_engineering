## Context

`establish-task-orchestration-provider-contracts` defined the `TaskOrchestrationClient` interface, `TaskRuntimeEvent` contract, and `HttpTaskOrchestrationProvider` stub. This change specifies the Python FastAPI service that the `HttpTaskOrchestrationProvider` connects to, and the real frontend adapter that replaces the stub. The Python service uses a mock executor internally, making this a real HTTP transport with mock execution semantics — not a real AI or agent backend.

## Goals / Non-Goals

**Goals:**
- Define a production-quality HTTP API for the Python orchestration service (five endpoints, request/response schemas, status codes).
- Define SSE as the server-to-client transport for `TaskRuntimeEvent` streams.
- Define the Python mock executor that reproduces the `TaskRuntimeEvent` sequence from the frontend mock provider.
- Define concurrent, Task-ID-isolated execution within the Python service.
- Define deterministic failure via `FAIL_SIMULATION:` prompt trigger in the Python executor.
- Define the real `HttpTaskOrchestrationProvider` frontend adapter that calls the Python API.
- Preserve mock frontend provider availability when the Python service is not active.
- Define the health endpoint and service configuration.

**Non-Goals:**
- AI model inference or language model calls.
- AI routing logic (deferred to `enable-ai-assisted-task-routing`).
- Real agent or workflow execution.
- Database persistence (Prisma, SQLite, Redis, or any external store).
- Worker queues or job schedulers.
- Automatic retry on task failure.
- Agent Management or Workflow Management integration.
- Knowledge Base or RAG retrieval.
- Modifying `@vcp/shared` contracts.

## Decisions

### Decision 1: SSE for Server-to-Client Task Events
- **Rationale**: SSE is unidirectional (server → client), stateless from the HTTP perspective, easy to implement with Python ASGI generators, and supported natively in browsers via `EventSource`. Task events are purely server-initiated; WebSocket bidirectionality is unnecessary.
- **Alternatives Considered**: WebSocket. Considered because it supports full duplex. Rejected for this change because cancel and create operations are already served by HTTP POST endpoints; using WebSocket would add complexity without behavioral benefit at this stage.
- **Alternatives Considered**: Long polling. Rejected because it introduces higher latency and more complex client-side management than SSE for a streaming use case.

### Decision 2: In-Memory Task Repository Only
- **Rationale**: The scope of this change is the HTTP transport and mock execution layer, not persistence. An in-memory repository is sufficient for demonstrating concurrent tasks and correct event delivery. It is explicitly not represented as production-grade storage.
- **Alternatives Considered**: SQLite for lightweight persistence. Rejected because it adds a dependency and migration path that is out of scope for this change.

### Decision 3: Python FastAPI as the Service Framework
- **Rationale**: FastAPI provides ASGI-native async streaming (compatible with SSE via `StreamingResponse`), automatic OpenAPI documentation, and Pydantic schema validation aligned with the request/response contract spec. It is lightweight and requires no framework-specific infrastructure.
- **Alternatives Considered**: Flask. Rejected because its synchronous default model requires additional tooling (e.g., gevent or threading) for concurrent streaming.

### Decision 4: Mock Executor Produces Identical `TaskRuntimeEvent` Sequence
- **Rationale**: The Python mock executor must produce the same event sequence as the frontend `MockTaskOrchestrationProvider` so that frontend components render correctly regardless of which provider is selected.
- **Alternatives Considered**: Simplified Python executor producing fewer event kinds. Rejected because it would cause the frontend execution feed to display incomplete timeline steps when the HTTP provider is active.

### Decision 5: Frontend HttpTaskOrchestrationProvider Uses EventSource for SSE
- **Rationale**: `EventSource` is the browser-native SSE client. It reconnects automatically on network interruption, which is acceptable behavior for the demo scope. No additional library is needed.
- **Alternatives Considered**: `fetch` with `ReadableStream`. More flexible but requires more boilerplate. Acceptable as an implementation alternative for environments where `EventSource` headers are insufficient.

### Architecture & Data Flow

```text
Frontend (HttpTaskOrchestrationProvider)
   | POST /api/v1/tasks               → Create task, receive Task ID
   | GET  /api/v1/tasks/{id}/events   → SSE stream of TaskRuntimeEvents
   | POST /api/v1/tasks/{id}/cancel   → Cancel task
   | GET  /api/v1/tasks/{id}          → Read task snapshot
   | GET  /api/v1/health              → Service health
        |
        v
Python FastAPI Orchestration Service
   ├── TaskRouter (HTTP endpoint handlers)
   ├── InMemoryTaskRepository (task records, keyed by Task ID)
   ├── PythonMockExecutor
   │   ├── Reproduces 6-stage orchestration timeline
   │   ├── Emits TaskRuntimeEvent sequence via async generator
   │   ├── Handles FAIL_SIMULATION: prompt trigger
   │   └── Handles cancellation signal
   └── SSE Event Generator (converts TaskRuntimeEvent → SSE frames)
```

### API Contract Summary

**POST /api/v1/tasks**
- Request: `{ prompt: string, routing: RoutingInput }`
- `RoutingInput`:
  - `{ mode: "auto" }`
  - `{ mode: "specific-agent", agentId: string }`
  - `{ mode: "predefined-workflow", workflowId: string }`
- Response 201: `{ taskId, workId, status: "pending", createdAt }`
- Response 400: invalid prompt or routing schema
- Response 422: validation error

**GET /api/v1/tasks/{taskId}**
- Response 200: `{ taskId, workId, status, prompt, routing, createdAt, updatedAt, result?, error? }`
- Response 404: task not found

**POST /api/v1/tasks/{taskId}/cancel**
- Response 200: `{ taskId, status: "canceling" }`
- Response 404: task not found
- Response 409: task already terminal

**GET /api/v1/tasks/{taskId}/events**
- Response: `text/event-stream` SSE stream of `TaskRuntimeEvent` JSON frames
- Stream closes after terminal event (`task-completed`, `task-failed`, `task-canceled`)
- Response 404: task not found

**GET /api/v1/health**
- Response 200: `{ status: "ok", version, executorType: "mock", activeTaskCount }`

### Canonical Task Status on the Service

| Service status | Frontend canonical status |
|---|---|
| `pending` | Pending |
| `running` | In-Progress |
| `completed` | Completed |
| `failed` | Failed |
| `canceled` | Canceled |

Status mapping on the service side uses the same production-to-presentation convention established in `task-orchestration` spec (queued→pending, running→in-progress, etc.), applied in reverse at the frontend adapter boundary.

### Concurrent Execution

- Multiple tasks may be created and execute concurrently.
- Each task's executor runs as an independent async task (Python `asyncio.Task`).
- Executor for Task A has no access to Task B's state.
- Cancel for Task A uses a per-task `asyncio.Event` or cancellation signal; it does not affect Task B.

### Error Handling

- Empty or whitespace-only prompt: 400 Bad Request, task not created.
- Invalid routing schema: 422 Unprocessable Entity, task not created.
- Executor error (FAIL_SIMULATION: or internal): `task-failed` SSE event with `TaskError` payload; task transitions to Failed.
- SSE client disconnects mid-stream: executor continues until terminal state; subsequent re-connects to `GET /api/v1/tasks/{id}/events` replay events from last confirmed position (or from start if no position is tracked; this change uses restart-from-start for simplicity).
- Terminal task cancel attempt: 409 Conflict.

### Configuration

The Python service SHALL support configuration via environment variables:
- `HOST` (default: `127.0.0.1`)
- `PORT` (default: `8000`)
- `STEP_DELAY_MS` (default: `1500`) — duration per mock processing step
- `CHUNK_DELAY_MS` (default: `100`) — delay between streaming chunks
- `LOG_LEVEL` (default: `info`)

The frontend `HttpTaskOrchestrationProvider` SHALL be configured by `ProviderConfig` `http` variant:
- `baseUrl` (required): base URL of the Python service
- `timeoutMs` (optional, default: `30000`)

### Migration Strategy

- The `HttpTaskOrchestrationProvider` stub from `establish-task-orchestration-provider-contracts` is replaced with the real implementation in this change.
- The Python service is added as a new directory (`services/task-orchestration/`) with its own `pyproject.toml` and `README.md`. No existing Node.js packages or backend code are modified.
- When the Python service is not running, the frontend falls back to the mock provider by changing `ProviderConfig`. No UI change is required.

## Risks / Trade-offs

- **Risk: SSE reconnect resets event stream position**
  - *Mitigation*: For initial scope, reconnect replays from the beginning for simplicity. Event replay from a position cursor is future work documented in `persist-task-orchestration-runtime`.
- **Risk: In-memory repository loses all tasks on service restart**
  - *Mitigation*: This is a documented, intentional limitation. The service `README.md` and health endpoint explicitly state in-memory scope.
- **Risk: asyncio Task leak if cancel signal is not propagated correctly**
  - *Mitigation*: Each executor task holds a reference to a per-task cancellation event. The cancel endpoint sets the event; the executor polls it at each step boundary.
- **Risk: CORS configuration blocks frontend EventSource connection**
  - *Mitigation*: CORS middleware is included in the service configuration with configurable allowed origins.
- **Risk: Python service is not started when HTTP provider is selected**
  - *Mitigation*: `GET /api/v1/health` is polled at frontend startup when HTTP provider is configured; if unreachable, the UI displays a clear error indicating the service is unavailable, with no silent fallback to mock behavior.
