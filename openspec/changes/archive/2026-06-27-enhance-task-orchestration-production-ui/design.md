## Context

The Task & Orchestration module requires a production-quality conversation workspace, clear information architecture, a polished composer, an execution feed, a processing inspector, and robust history navigation. The overarching architectural vision mandates a provider-neutral boundary:
```text
Frontend
    ↓
Task & Orchestration application boundary
    ↓
TaskExecutionAdapter
    ↓
Externally supplied execution runtime reference
    ↓
OpenClaw instance managed by another module/team
```
Workspace Management or the responsible infrastructure module provides a resolvable execution-runtime reference. Task & Orchestration consumes that reference to submit and monitor work.

**Task & Orchestration owns:** Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle (Pending, In-Progress, Completed, Failed, Canceled), routing request representation (Auto, Specific Agent, Predefined Workflow), conversation and Task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform Task requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, frontend rendering and user interaction.

**Task & Orchestration does not own:** OpenClaw installation, OpenClaw container creation, OpenClaw start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS or networking, Gateway credential creation or platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base or RAG Management, custom orchestration engine, custom LLM router, custom multi-agent collaboration engine, custom workflow runtime, OpenClaw internals.

## Goals / Non-Goals

**Goals:**
- Upgrade the user interface to a premium production-style workspace.
- Support conversation sessions containing multiple Tasks with multi-turn feeds.
- Maintain background Task continuity across conversation navigation by immutable Task ID.
- Display canonical Task lifecycle states accurately.
- Ensure provider-neutral rendering using normalized Task state.
- Retain deterministic mock execution as a legitimate Task & Orchestration test and development adapter.
- Prepare the UI to receive real runtime updates from the platform backend in the future.
- Clearly separate presentation state, canonical Task state, and execution-provider state.

**Non-Goals:**
- OpenClaw transport implementation or OpenClaw Gateway connection.
- Runtime provisioning, container management, or credential management.
- Backend adapter implementation, Agent Management, or Workflow Management implementation.
- Custom orchestration-engine implementation.

## Decisions

### Decision 1: Provider-Neutral Presentation
The user interface renders canonical Task state without knowing whether updates originate from a mock runtime, an external execution provider, or a restored Task snapshot. The UI submits Task requests through the platform Task boundary, does not connect directly to OpenClaw, does not receive or store OpenClaw credentials, does not create or manage OpenClaw instances, does not infer production completion or failure, and does not silently fall back from production execution to mock execution.
* *Rationale*: Ensures the UI component tree remains perfectly decoupled from underlying execution engines, preventing the need for UI changes when adding or changing providers.
* *Alternatives considered*: Branching inside React components based on `provider.type`. Rejected because it introduces provider-specific logic into presentation components and breaks encapsulation.

### Decision 2: Conversation Architecture & State Ownership
The state structure is organized around conversations referencing canonical Task records:
```text
TaskCreationState
├── tasks
├── conversations
├── activeConversationId
├── activeTaskId
└── presentation state
```
Frontend-owned state includes: composer draft, selector state, modal state, search query, filter state, submitting, loading, reconnecting. Canonical Task state includes: status, timeline, partial output, final result, error, cancellation, timestamps.
* *Rationale*: Ensures Task records remain the canonical source of truth while supporting multi-turn chat sessions cleanly.
* *Alternatives considered*: Storing full Task objects directly inside conversation objects. Rejected because it duplicates authoritative data and risks state desynchronization.

### Decision 3: Conversation Switching is Presentation-Only
Switching the active conversation is strictly a presentation action. It must not cancel, restart, pause, duplicate, reset, or alter the lifecycle of any Task, nor clear the runtime or transfer runtime callbacks to the active Task. Background Task execution is preserved by immutable Task ID.
* *Rationale*: Allows background Tasks in inactive conversations to continue executing and receiving updates under their immutable Task IDs without interruption.
* *Alternatives considered*: Pausing background tasks when switching conversations. Rejected because users expect long-running tasks to progress asynchronously while they view other chats.

### Decision 4: New Chat Behavior
The New Chat action creates a new empty conversation and selects it as active. It preserves all existing conversations and Tasks, does not stop background Tasks, does not display stale Tasks in the empty conversation, and does not open processing details or cancellation dialogs for prior Tasks.
* *Rationale*: Provides a clean slate for new work while safeguarding active background processing in prior chats.
* *Alternatives considered*: Overwriting the current conversation state upon clicking New Chat. Rejected because it destroys active session history and orphans running tasks.

### Decision 5: Runtime Ownership Keyed by Task ID
In mock mode, the runtime utilizes a Task-keyed registry. All timers, schedulers, streaming controllers, cancellation handles, completion callbacks, and failure callbacks are keyed by immutable Task ID, independent of the active Task or active conversation. Mock execution is retained as a legitimate Task & Orchestration test and development adapter.
* *Rationale*: Guarantees robust background progression and ensures terminal cleanup only disposes of the runtime resources belonging to that specific Task.
* *Alternatives considered*: Keying runtime controllers by `activeTaskId`. Rejected because it breaks background execution whenever the user navigates away.

### Decision 6: Canonical Lifecycle vs. UI State Separation
The workspace maintains a strict visual and semantic distinction between temporary UI states (loading, submitting, reconnecting, provider unavailable) and canonical lifecycle statuses (Pending, In-Progress, Failed).
* *Rationale*: Submitting is a UI state before/during request transmission; Pending appears only after a canonical Task is created; reconnecting does not transition a Task to Failed; provider unavailable before Task creation is not a Failed Task; and only canonical failures display Failed.
* *Alternatives considered*: Using the Pending status badge during initial form submission. Rejected because it conflates network latency with canonical Task existence.

### Decision 7: Composer and Routing Design
The composer creates provider-neutral Task requests supporting Auto, Specific Agent, and Predefined Workflow routing modes. The UI does not analyze prompts to select agents, does not self-execute Auto-routing, does not contain provider credentials, and does not call execution providers directly; it submits routing selections via the platform Task client.
* *Rationale*: Delegates all routing intelligence to the backend/provider while keeping the frontend clean and secure. Switching routing modes clears incompatible targets, and Specific Agent/Workflow modes require valid targets before submission.
* *Alternatives considered*: Directly invoking OpenClaw endpoints from the composer submit handler. Rejected because it violates provider-neutral boundaries and leaks credentials.

### Decision 8: Feed Rendering
The execution feed strictly separates partial output from finalized results. Partial output is never displayed as a finalized result; Completed tasks display only finalized results; Failed tasks display errors without treating incomplete output as Completed; Canceled tasks stop receiving UI updates; delayed updates do not transition terminal Tasks back to active; each update applies to the correct Task; and inactive conversations never receive data from active Tasks.
* *Rationale*: Assures absolute clarity and correctness in the multi-turn execution feed.
* *Alternatives considered*: Merging partial output and finalized results into a single state field. Rejected because it prevents the UI from distinguishing active streaming from completion.

### Decision 9: Processing Inspector
The processing details modal is strictly scoped by Task ID, reading canonical steps and logs to separate technical details from the main result. Advanced Details are closed by default, raw credentials and sensitive provider payloads are excluded, and the view degrades gracefully when only lifecycle data is available without detailed execution activity.
* *Rationale*: Provides powerful debugging capabilities without cluttering the primary UI or exposing sensitive credentials.
* *Alternatives considered*: Displaying raw provider JSON logs directly in the main feed. Rejected because it overwhelms users and exposes sensitive data.

### Decision 10: History Model
The sidebar history is conversation-oriented rather than a flat Task list. Each item displays conversation title, updated time, latest Task status, latest prompt preview, and matching search context. Search supports conversation title, prompt, Task ID, and Work ID. Status filtering enforces a single clear rule: a conversation matches a status filter when its latest Task has the selected canonical status. Empty conversations do not match status filters.
* *Rationale*: Organizes complex multi-task sessions intelligibly for enterprise users.
* *Alternatives considered*: A flat list of every Task attempt in the sidebar. Rejected because it clutters navigation and loses conversation context.

### Decision 11: External Dependency Contracts & Responsibility Boundaries
The Task & Orchestration specifications define consumer-facing ports conceptually but must not claim ownership of their implementations:
```ts
interface WorkspaceExecutionRuntimeResolver {
  resolve(workspaceId: WorkspaceId): Promise<WorkspaceExecutionRuntime>;
}

interface WorkspaceExecutionRuntime {
  provider: "openclaw";
  instanceId: string;
  endpointReference: string;
  credentialReference: string;
  status: "running" | "stopped" | "unavailable";
}
```
External dependencies are defined conceptually for:
- Agent Management → workspace-scoped selectable agents, platform-agent to provider-agent mapping
- Workflow Management → workspace-scoped selectable workflows, platform-workflow to provider-workflow mapping
- Workspace User Management / Authentication → authorized principal and operation permission
- Workspace Management → resolvable execution-runtime reference

The cross-change dependency order is documented as follows:
```text
enhance-task-orchestration-production-ui
    independent presentation alignment

establish-openclaw-task-integration-contracts
    defines consumer-side contracts

integrate-openclaw-task-execution
    depends on integration contracts
    and on an externally supplied runtime prerequisite

extend-openclaw-execution-observability
    depends on task execution integration
```
* *Rationale*: Prevents scope creep and enforces strict architectural boundaries across project modules.
* *Alternatives considered*: Task & Orchestration managing container provisioning and RBAC directly. Rejected because it violates module ownership and creates unmaintainable coupling.

### Decision 12: Accessibility and Responsive Design
The design comprehensively covers desktop, tablet, and mobile dimensions, pinned composers, scrollable feeds, long results, focus-visible styling, keyboard navigation (`Tab`/`Shift+Tab`), dialog focus management, accessible status labels, status indicators not reliant on color alone, reduced-motion compatibility, empty states, loading states, reconnecting states, and search no-result states.
* *Rationale*: Ensures full compliance with enterprise accessibility standards and provides superior usability across all devices.
* *Alternatives considered*: Relying solely on color-coded dots for task statuses. Rejected because it fails WCAG accessibility guidelines for colorblind users.

## Risks / Trade-offs

* **Risk: UI navigation interrupts active background task processing** → Mitigation: Runtime controllers and callbacks are keyed strictly by immutable Task ID rather than active conversation ID.
* **Risk: Confusion between temporary UI states and canonical lifecycle statuses** → Mitigation: Strict semantic separation ensures temporary states (submitting, loading, reconnecting) use dedicated UI indicators (`aria-busy="true"`, skeleton screens) rather than canonical status badges.
* **Risk: Large UI pull requests exceed the 500-line review recommendation** → Mitigation: Implementation is decomposed into focused review units (e.g., separating foundation styling from component markup), each accompanied by automated tests.

## Migration Plan

1. Define centralized visual system tokens and foundation styling classes.
2. Implement in-memory conversation state structure (`TaskCreationState.conversations`, `activeConversationId`) and Task-keyed runtime registry.
3. Update composer, routing selector, execution feed, and processing inspector components to consume normalized Task state.
4. Implement conversation-oriented sidebar history navigation with search and latest-Task status filtering.
5. Verify comprehensive accessibility compliance, responsive adaptations, and zero regression on core lifecycle semantics.

## Open Questions

1. What specific layout breaking points (in pixels) will be standardized across desktop, tablet, and mobile viewports for the workspace shell?
2. How will the simulation mode indicator be visually styled to ensure clear differentiation without clashing with the primary workspace header?
