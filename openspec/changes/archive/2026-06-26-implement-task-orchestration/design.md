## Context

The Task & Orchestration module represents the execution layer of the virtual company workspace. While the full production architecture includes task ingestion, lifecycle control, routing, agent registry lookup, collaboration, shared context, aggregation, streaming, cancellation, and failure handling, the PA5 prototype operates standalone. The implementation uses a frontend-first deterministic mock architecture while strictly preserving production responsibility boundaries. The prototype provides an interactive, demonstrable, and testable chatbot-style workspace showcasing the complete lifecycle of a task without depending on external AI, database, agent, orchestration, or streaming services.

## Goals / Non-Goals

**Goals:**
- Provide an interactive chatbot-style workspace aligned with the PA4 prototype.
- Support all required lifecycle states: Pending, In-Progress, Completed, Failed, and Canceled.
- Separate UI rendering from lifecycle and orchestration logic via an authoritative task store/reducer and mock orchestration service.
- Ensure deterministic, resettable demo behavior with centralized timing configuration.
- Support controlled cancellation without stale timer callbacks or memory leaks.
- Enforce strict state machine transitions, making invalid transitions impossible and preventing Failed/Canceled tasks from rendering as Completed.
- Keep task-scoped data isolated within sessions.
- Establish the production-facing Module Foundation defining aggregate ownership, tenant/submitter identity derivation, authoritative routing invariants, shared contracts (`@vcp/shared`), and Prisma persistence mapping (`TaskRun` to `TaskWork`) for future integration.
- Ensure automated testability using fake timers or configurable delays.

**Non-Goals:**
- Real external AI API integration or real LLM intent analysis.
- Real microservices, backend orchestration engine, or database persistence.
- Real Redis shared context, WebSocket, or Server-Sent Events streaming.
- Real file upload processing (retaining a non-functional/disabled attachment entry point for visual alignment).
- Production retry policies, distributed task queues, or cross-device persistence.
- Modifying shared public contracts beyond approved compatibility definitions.

## Decisions

### Decision 1: Frontend-First Deterministic Mock Architecture
- **Rationale**: PA5 must be stable, repeatable, independent of external APIs, and demonstrable offline in a classroom or test environment.
- **Alternatives Considered**: Using a local backend server with mock endpoints or an in-memory SQLite database. This was rejected because it increases setup complexity and breaks standalone frontend demo constraints.

### Decision 2: Strict Separation of Lifecycle Control from UI Presentation
- **Rationale**: Preserves the architectural distinction between lifecycle processing and UI rendering. UI components dispatch actions to an authoritative task store/reducer and never directly mutate task status.
- **Alternatives Considered**: Storing task state inside local React component state. Rejected because it leads to duplicated state, race conditions, and inconsistent status renderings across layout panels.

### Decision 3: Explicit Task ID and Work ID Separation
- **Rationale**: The domain model generates both `taskId` (to track submitted intent) and `workId` (to track specific execution attempts). This aligns with PA4 visual representation and supports future retry semantics where each attempt receives a new `workId` while retaining the same `taskId`.
- **Alternatives Considered**: Using a single task identifier. Rejected because it cannot cleanly represent multiple execution attempts of theامله task prompt.

### Decision 4: Centralized Timing and Abort-Signaled Cancellation
- **Rationale**: Prevents stale callbacks and memory leaks. Every asynchronous update in the mock orchestration pipeline checks if the task remains active and non-terminal. Timers are tracked and aborted upon cancellation or demo reset.
- **Alternatives Considered**: Implicit timeouts in UI components. Rejected because pending callbacks would continue firing after task cancellation or reset.

### Decision 5: Deterministic Failure Simulation via Trigger
- **Rationale**: Prompts beginning with `FAIL_SIMULATION:` trigger an explicit failure during the `aggregate-result` stage. This establishes a reliable mechanism to verify error handling, partial log preservation, and terminal state protections.
- **Alternatives Considered**: Random failure injection. Rejected because it violates the determinism required for automated functional testing.

### Decision 6: Production Module Foundation & Prisma Compatibility
- **Rationale**: Defines `Task` and `TaskWork` as module-owned aggregates while treating `Workspace`, `User`, `Agent`, and `Workflow` as referenced entities via scalar IDs. Connects domain `TaskWork` to the existing Prisma `TaskRun` (`task_runs` table) model via a future repository adapter, avoiding duplicate tables or destructive schema changes.
- **Alternatives Considered**: Creating a new `task_works` table in Prisma immediately. Rejected because it creates unnecessary migration risks and breaks backward compatibility with existing repository conventions.

### Architecture & Data Flow
```text
Task Workspace UI
        | (dispatches actions)
        v
Task Store / Reducer <--- [Authoritative State]
        | (notifies)
        v
Mock Task Orchestration Service
        +--> Task Factory & ID Generator (generates taskId & workId)
        +--> Routing Resolver (Auto / Specific Agent / Predefined Workflow)
        +--> Lifecycle State Machine (enforces valid transitions)
        +--> Timeline & Log Generator (tracks 6 orchestration stages)
        +--> Streaming Simulator (appends stable result chunks)
        +--> Cancellation Controller (aborts timers & execution)
        +--> Failure Simulator (intercepts FAIL_SIMULATION: trigger)
        |
        v
Deterministic Seed Data (Mock Agents, Workflows, Prompts, Timings)
```

### State Transitions
- **Valid Transitions**: `New -> Pending`, `Pending -> In-Progress`, `Pending -> Canceled`, `In-Progress -> Completed`, `In-Progress -> Failed`, `In-Progress -> Canceled`.
- **Terminal States**: `Completed`, `Failed`, `Canceled`. Once in a terminal state, transitions to any other state are strictly rejected, and all incoming streaming chunks, timeline updates, or logs are ignored.

### Error Handling
- Failed tasks transition to `Failed`, store a deterministic `TaskError` object, halt streaming/timers, preserve logs up to the point of failure, and display explicit error details in the processing detail modal without rendering a `Completed` result view.

### Migration & Compatibility Plan
- Domain `TaskWork.workId` maps to Prisma `TaskRun.taskRunId`. Timestamps are stored as ISO-8601 strings. Shared contracts (`@vcp/shared`) retain `workId`, routing modes, create-task DTOs, and the production `TaskStatus` enum. Mapping from production statuses (`queued`, `running`, `succeeded`, `failed`, `cancelled`) to PA5 presentation statuses (`pending`, `in-progress`, `completed`, `failed`, `canceled`) occurs strictly at the frontend API-adapter/view-model boundary.

### Testing Strategy
- **Unit Tests**: Verify prompt validation, ID generation, state machine transition guards (`canTransition`, `isTerminalStatus`), routing normalization, failure trigger detection, and timer cleanup.
- **Component Tests**: Verify empty/loading states, composer interactions, routing selector, status badges, timeline rendering, completed result views, cancel confirmation dialog, and processing detail modal.
- **Lifecycle Tests**: Utilize fake timers or zero-delay configuration to verify end-to-end task lifecycles, cancellation abortion, failure handling, and terminal state protection without waiting for real-time demo durations.

## Risks / Trade-offs

- **Risk: Timer leakage after cancellation or reset**
  - *Mitigation*: Centralize all orchestration delays in the mock service, track active timer handles, utilize abort signals, and verify non-terminal task status before applying any asynchronous updates.
- **Risk: Inconsistent task status rendering across UI panels**
  - *Mitigation*: Maintain a single authoritative task store/reducer and derive all badges, action buttons, timelines, and result views directly from the central state.
- **Risk: Incomplete or failed output displayed as a successful result**
  - *Mitigation*: The Completed result view strictly requires `status === "completed"` and a finalized result object. It is never rendered based solely on the presence of partial text.
- **Risk: Automated tests run too slowly due to demo delays**
  - *Mitigation*: Provide a centralized timing configuration (`DEMO_TIMINGS`) allowing test environments to override delays to zero or utilize fake timers.
- **Risk: Pull requests exceed the 500-line review recommendation**
  - *Mitigation*: Decompose implementation and testing sub-issues into multiple focused review units (e.g., separating layout, shared types, composer, routing, lifecycle states, streaming, cancellation, and failure logic).
