## Context

The Task & Orchestration frontend currently drives the full mock execution lifecycle in-browser: the mock orchestration service generates processing steps, timeline events, streaming chunks, and terminal results directly, then dispatches state updates to the task store. This design served the initial prototype well, but it hardwires the UI to mock-only behavior. Replacing or augmenting the execution backend requires changing UI code rather than swapping a configuration-selected provider.

This design introduces a provider boundary that decouples the workspace UI from any specific runtime, while preserving every behavioral guarantee of the existing mock implementation.

## Goals / Non-Goals

**Goals:**
- Define a `TaskOrchestrationClient` interface as the exclusive integration point between workspace UI and any execution runtime.
- Define a `TaskRuntimeEvent` discriminated union as the canonical event vocabulary shared by all providers.
- Define `ProviderConfig` for selecting between `mock` and `http` providers without code changes.
- Define a `MockTaskOrchestrationProvider` adapter that satisfies `TaskOrchestrationClient` by wrapping the existing in-browser mock service.
- Define an `HttpTaskOrchestrationProvider` boundary (interface + config shape) without implementing real HTTP transport.
- Specify the mapping from `TaskRuntimeEvent` kinds to canonical `TaskStatus` transitions.
- Guarantee that the workspace UI never branches on provider identity.
- Guarantee that all existing mock-backed acceptance criteria continue to pass.

**Non-Goals:**
- Implementing real SSE or WebSocket transport.
- Implementing the Python orchestration service.
- Implementing model inference or AI routing.
- Adding Agent Management, Workflow Management, or RAG integration.
- Adding persistence, retry, or worker queue logic.
- Changing `@vcp/shared` public contracts or Prisma schema.

## Decisions

### Decision 1: `TaskOrchestrationClient` as the Single Integration Point
- **Rationale**: All UI-to-runtime coupling passes through one typed interface. Swapping providers requires only changing `ProviderConfig`; no UI component needs modification.
- **Alternatives Considered**: Passing provider-specific callbacks directly to UI components. Rejected because it distributes provider knowledge across the component tree and requires coordinated changes when adding a new provider.

### Decision 2: `TaskRuntimeEvent` as a Discriminated Union
- **Rationale**: A closed, typed union prevents the UI from needing a fallback handler for unknown event kinds. Each event kind maps deterministically to a UI action (timeline update, chunk append, status transition).
- **Alternatives Considered**: Generic key-value event objects. Rejected because they lose compile-time safety and force defensive runtime checks in every consumer.

### Decision 3: Mock Provider as an Adapter, Not a Replacement
- **Rationale**: The existing mock service already satisfies all lifecycle and streaming requirements. The `MockTaskOrchestrationProvider` adapter wraps it without modifying its internal logic, ensuring zero behavioral regression.
- **Alternatives Considered**: Rewriting the mock service to match the new interface from scratch. Rejected because it introduces regression risk with no behavioral benefit.

### Decision 4: `HttpTaskOrchestrationProvider` as Boundary Only
- **Rationale**: Defining the interface and config shape now allows `add-python-task-orchestration-service` to be planned against a stable contract without coupling this change's scope to actual HTTP implementation.
- **Alternatives Considered**: Deferring the HTTP boundary to the next change. Rejected because the `HttpTaskOrchestrationProvider` interface must be validated as satisfying `TaskOrchestrationClient` before the Python service spec can be written against it.

### Decision 5: Provider Identity Is Invisible to UI Components
- **Rationale**: If UI components branch on provider type, every new provider requires UI changes. Keeping provider identity invisible to UI enforces the provider boundary contract.
- **Alternatives Considered**: Allowing UI to query `activeProvider.type`. Rejected because it couples UI rendering paths to provider implementation details.

### Decision 6: Runtime Ownership Is Task-ID-Scoped, Not Conversation-Scoped
- **Rationale**: A task begins executing when created and continues until terminal, regardless of which conversation is active. Keying event delivery by Task ID prevents background tasks from being orphaned when the user switches conversations.
- **Alternatives Considered**: Delivering events to the active conversation only. Rejected because it silently halts background processing for all non-active tasks.

### Architecture & Data Flow

```text
TaskOrchestrationPage / UI Components
        | (calls)
        v
TaskOrchestrationClient (interface)
        |
   [ProviderConfig selects]
        |
   +----+----+
   |         |
   v         v
MockTask-    HttpTask-
Orchestration Orchestration
Provider      Provider (boundary only)
   |
   v
Existing In-Browser Mock Service
(TaskProcessingController, streaming, cancellation)
        |
        v
TaskRuntimeEvent stream
        |
        v
Task Store / Reducer (updates by Task ID)
        |
        v
Workspace UI (status badge, timeline, streaming, modal)
```

### `TaskOrchestrationClient` Contract Shape

```text
interface TaskOrchestrationClient {
  createTask(input: CreateTaskInput): Promise<CreatedTaskRecord>
  getTask(taskId: string): Promise<TaskRecord | null>
  cancelTask(taskId: string): Promise<void>
  subscribeToTaskEvents(taskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription
  unsubscribeFromTaskEvents(subscription: TaskEventSubscription): void
}
```

### `TaskRuntimeEvent` Discriminated Union (required event kinds)

| Kind | Trigger | UI Effect |
|---|---|---|
| `task-accepted` | Task creation confirmed | Assign Task ID, set Pending |
| `task-started` | Runtime begins execution | Transition to In-Progress |
| `routing-resolved` | Routing target determined | Update routing metadata |
| `step-started` | Processing step begins | Advance timeline |
| `step-completed` | Processing step finishes | Mark step Completed |
| `partial-output` | Streaming chunk available | Append to partial result |
| `task-completed` | All steps done | Transition to Completed, display final result |
| `task-failed` | Runtime error | Transition to Failed, display error |
| `task-canceled` | Cancellation applied | Transition to Canceled, stop streams |

### `ProviderConfig` Shape

```text
type ProviderConfig =
  | { type: "mock" }
  | { type: "http"; baseUrl: string; timeoutMs?: number }
```

### Status Mapping from `TaskRuntimeEvent` to Canonical `TaskStatus`

| Event Kind | Resulting Canonical Status |
|---|---|
| `task-accepted` | Pending |
| `task-started` | In-Progress |
| `task-completed` | Completed |
| `task-failed` | Failed |
| `task-canceled` | Canceled |
| `routing-resolved`, `step-started`, `step-completed`, `partial-output` | No status change; metadata update only |

### Error Handling

- If the mock provider throws during `createTask`, the error is surfaced to the UI as a pre-creation failure; no Task ID is assigned.
- `TaskRuntimeEvent` of kind `task-failed` carries a `TaskError` payload (code, message) that the UI displays in the failed state view.
- After a terminal event is delivered, the provider MUST NOT deliver further events for that Task ID. The UI MAY additionally guard against late events using its existing `isTerminalStatus` check.

### Configuration

- `ProviderConfig` is resolved at application initialization from an environment variable or build-time constant. No runtime UI control is provided in this change.
- The mock provider requires no additional configuration.
- The HTTP provider config requires `baseUrl`; `timeoutMs` is optional with a sensible default.

### Migration Strategy

- The existing mock orchestration service is wrapped by `MockTaskOrchestrationProvider`. Its internal scheduling, timing configuration, and abort-signal mechanics are unchanged.
- UI components that currently call the mock service directly are refactored to call `TaskOrchestrationClient` methods. This is a pure internal restructure; no external API or shared contract changes.
- The `HttpTaskOrchestrationProvider` is defined as an interface stub in this change; it emits no real HTTP calls. Real implementation is deferred to `add-python-task-orchestration-service`.

## Risks / Trade-offs

- **Risk: Mock provider adapter introduces behavioral drift**
  - *Mitigation*: The adapter is a thin wrapper. All existing mock acceptance criteria are re-run against the adapter-wrapped service. No internal mock logic is changed.
- **Risk: `TaskRuntimeEvent` union is too narrow for future provider needs**
  - *Mitigation*: The union is explicitly closed in this change. Future event kinds require a spec change, which is intentional — it prevents providers from silently adding event kinds the UI does not handle.
- **Risk: HTTP provider boundary is defined before the server API is finalized**
  - *Mitigation*: The `HttpTaskOrchestrationProvider` boundary is defined against the `TaskRuntimeEvent` contract, not against a specific HTTP wire format. The wire-format binding is specified in `add-python-task-orchestration-service`.
- **Risk: Provider selection via config variable is not sufficient for some demo scenarios**
  - *Mitigation*: A developer-facing toggle (e.g., query parameter) is a future option. For the initial integration this is explicitly out of scope.
