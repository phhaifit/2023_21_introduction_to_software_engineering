# Task & Orchestration Provider Contracts — Tasks

## 1. TaskRuntimeEvent and ProviderConfig Contracts

**Objective**: Define the canonical `TaskRuntimeEvent` discriminated union and `ProviderConfig` type that all providers and UI components will depend on.

- [x] 1.1 Define `TaskRuntimeEvent` discriminated union covering all nine required event kinds (`task-accepted`, `task-started`, `routing-resolved`, `step-started`, `step-completed`, `partial-output`, `task-completed`, `task-failed`, `task-canceled`).
- [x] 1.2 Define payload shape for each event kind including Task ID, Work ID, timestamp, and event-specific fields, plus `TaskError` payload shape (code, message) embedded in `task-failed`.
- [x] 1.3 Define `ProviderConfig` discriminated union (`mock` | `http` with `baseUrl` and optional `timeoutMs`).
- [x] 1.4 Define mapping table from `TaskRuntimeEvent` kind to canonical `TaskStatus` transition.

**Acceptance Criteria**:
- Each event kind maps to exactly one entry in the mapping table.
- `TaskError` carried by `task-failed` includes at minimum `code` and `message`.
- `ProviderConfig` supports `mock` and `http` variants with documented field requirements.
- No references to provider-specific implementation details appear in the event or config types.

---

## 2. `TaskOrchestrationClient` Interface

**Objective**: Define the `TaskOrchestrationClient` interface as the single integration boundary between workspace UI and any execution runtime.

- [x] 2.1 Define `createTask(input)` → `Promise<CreatedTaskRecord>`: accepts prompt and routing selection; returns Task ID, Work ID, initial status, and creation timestamp.
- [x] 2.2 Define `getTask(taskId)` → `Promise<TaskRecord | null>`: returns the current snapshot of a task or `null`, and `cancelTask(taskId)` → `Promise<void>`: signals cancellation; does not wait for terminal event.
- [x] 2.3 Define `subscribeToTaskEvents(taskId, handler)` → `TaskEventSubscription`: registers a handler receiving `TaskRuntimeEvent`s scoped to the given Task ID, and `unsubscribeFromTaskEvents(subscription)` → `void`: removes the handler and frees any associated resources.
- [x] 2.4 Define `TaskEventSubscription` opaque handle shape.

**Acceptance Criteria**:
- The interface is decoupled from any specific provider implementation type.
- `subscribeToTaskEvents` guarantees Task-ID-scoped event delivery (events for Task A are not delivered to Task B's subscription).
- The interface does not expose any method parameterized on provider type.
- All five methods are covered by interface-level documentation.

**Dependencies**: Task 1 (event and config contracts).

---

## 3. `MockTaskOrchestrationProvider` Adapter

**Objective**: Wrap the existing in-browser mock orchestration service in a `MockTaskOrchestrationProvider` that satisfies `TaskOrchestrationClient` without modifying internal mock logic.

- [x] 3.1 Implement `MockTaskOrchestrationProvider` class or module implementing `TaskOrchestrationClient`.
- [x] 3.2 Implement translation of existing mock service lifecycle callbacks into `TaskRuntimeEvent` emissions in the correct sequence, preserving all existing timing configuration (`DEMO_TIMINGS`), abort-signal mechanics, and reset behavior.
- [x] 3.3 Implement `subscribeToTaskEvents` backed by an in-process event emitter keyed by Task ID, and `unsubscribeFromTaskEvents` removing the handler and preventing further delivery after unsubscription.
- [x] 3.4 Ensure all terminal-state guards (`isTerminalStatus`) remain operative inside the adapter.

**Acceptance Criteria**:
- Every existing mock lifecycle scenario (Pending → In-Progress → Completed, Pending → Canceled, In-Progress → Failed, FAIL_SIMULATION: trigger, streaming stop after terminal) produces the corresponding `TaskRuntimeEvent` sequence.
- No `TaskRuntimeEvent` is delivered after `task-completed`, `task-failed`, or `task-canceled` for the same Task ID.
- The adapter satisfies `TaskOrchestrationClient` without type casts on the return type.
- Internal mock timing configuration is unchanged.

**Dependencies**: Task 1, Task 2.

---

## 4. `HttpTaskOrchestrationProvider` Boundary

**Objective**: Define the `HttpTaskOrchestrationProvider` interface stub and its configuration contract, without implementing real HTTP transport.

- [x] 4.1 Implement `HttpTaskOrchestrationProvider` class or module declaring `TaskOrchestrationClient` as its implemented interface, with configuration binding to `ProviderConfig` `http` variant (`baseUrl`, `timeoutMs`).
- [x] 4.2 Declare all five `TaskOrchestrationClient` methods; method bodies may throw `NotImplementedError` or equivalent in this change.
- [x] 4.3 Document the expected wire-format binding point (SSE event stream URL pattern) without implementing it.

**Acceptance Criteria**:
- `HttpTaskOrchestrationProvider` satisfies the `TaskOrchestrationClient` type contract at compile time (no type errors).
- The class is parameterized on `ProviderConfig & { type: "http" }`.
- No real HTTP fetch, EventSource, or WebSocket call is made in this change.
- The stub includes inline documentation pointing to `add-python-task-orchestration-service` for the real implementation.

**Dependencies**: Task 1, Task 2.

---

## 5. Provider-Independent UI Refactor and Integration

**Objective**: Refactor workspace UI components to consume `TaskOrchestrationClient` exclusively; remove all direct references to the mock service from UI component code.

- [x] 5.1 Implement provider resolution at application initialization from `ProviderConfig` (environment variable or build-time constant); selected provider is injected into the UI context.
- [x] 5.2 Refactor workspace UI to receive `TaskOrchestrationClient` via dependency injection; no UI component imports the mock service directly.
- [x] 5.3 Ensure all status badge rendering, timeline updates, streaming display, and cancellation dialogs derive from `TaskRuntimeEvent` payloads stored in the task store, not from provider-type checks.
- [x] 5.4 Ensure conversation selection does not affect which Task IDs receive runtime events, and demo reset clears subscriptions via `unsubscribeFromTaskEvents` before clearing the task store.

**Acceptance Criteria**:
- No UI component file contains a direct import of `MockTaskOrchestrationProvider` or the underlying mock service.
- A static search for `provider.type` or equivalent provider-type branch in UI component files returns zero results.
- All existing automated tests for task lifecycle, streaming, failure, and cancellation pass using the mock provider adapter.
- The active provider can be changed from `mock` to `http` by modifying only `ProviderConfig`; no UI file change is required.
- Demo reset unsubscribes all active Task subscriptions before clearing state.

**Dependencies**: Task 3, Task 4.

---

## 6. Spec, Validation, and Acceptance Verification

**Objective**: Verify the provider contract spec, run full OpenSpec validation, and confirm zero regression on existing task orchestration acceptance criteria.

- [x] 6.1 Complete delta spec for `task-orchestration-provider` capability and ensure it passes strict validation.
- [x] 6.2 Complete delta spec for `task-workspace` and `task-history` (modified requirements) and ensure they pass strict validation.
- [x] 6.3 Run full OpenSpec strict validation (`openspec validate --all --strict`).
- [x] 6.4 Run full automated test suite (`npm test`) and build (`npm run build`), confirming no existing task orchestration acceptance scenario regresses.

**Acceptance Criteria**:
- `openspec validate "establish-task-orchestration-provider-contracts" --strict` exits 0.
- `openspec validate --all --strict` exits 0.
- `npm test` exits 0.
- `npm run build` exits 0.
- All scenarios in `openspec/specs/task-orchestration/spec.md` remain satisfied.

**Dependencies**: Task 5.
