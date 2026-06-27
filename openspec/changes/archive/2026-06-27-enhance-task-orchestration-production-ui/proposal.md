## Why

### Problem
The Task & Orchestration module requires a production-quality conversation workspace, clear information architecture, a polished composer, an execution feed, a processing inspector, and robust history navigation. The user interface must maintain strict architectural decoupling from execution engines, operating within a clear responsibility boundary where it acts exclusively as a presentation client.

### Goals
This change must:
- Upgrade the user interface to a premium production-style workspace.
- Support conversation sessions containing multiple Tasks with multi-turn feeds.
- Maintain background Task continuity during UI navigation.
- Display the canonical Task lifecycle accurately (Pending, In-Progress, Completed, Failed, Canceled).
- Use normalized Task state rather than depending on any specific execution provider.
- Retain deterministic mock execution as a legitimate Task & Orchestration test and development adapter.
- Prepare the UI to receive real runtime updates from the platform backend in the future.
- Clearly separate presentation state, canonical Task state, and execution-provider state.

## What Changes

### Scope of Changes
- Establish a premium production UI foundation and visual design system (typography, spacing, semantic color tokens, elevation) supporting five canonical statuses without proprietary branding.
- Implement a conversation workspace shell supporting multi-turn Task feeds, active conversation selection, and New Chat actions.
- Enforce provider-neutral presentation where the UI submits Tasks and displays canonical Task state without branching on provider identity.
- Establish a clear responsibility boundary between frontend presentation state and canonical Task state.
- Implement Task-keyed background runtime isolation ensuring inactive Tasks progress to terminal states without state leakage or interruption.
- Polish task composer input ergonomics, active/focus states, double-submit prevention, and explicit visual validation feedback for empty or whitespace-only prompts.
- Upgrade the routing mode selector (Auto, Specific Agent, Predefined Workflow) with clear descriptions, requiring valid targets for specific modes, and clearing incompatible targets upon mode switching.
- Upgrade execution feed rendering to ensure partial output is clearly distinguished from finalized results, Completed tasks display finalized results, Failed tasks display errors without treating incomplete output as Completed, and Canceled tasks stop receiving updates.
- Implement a task-scoped processing inspector (details modal) displaying canonical steps, logs, and error details, with Advanced Details closed by default and excluding raw credentials or sensitive provider payloads.
- Implement conversation-oriented history navigation in the sidebar with search (by title, prompt, Task ID, Work ID) and status filtering (where a conversation matches a filter if its latest Task has the selected canonical status).
- Enforce strict semantic and visual separation between temporary UI states (loading, submitting, reconnecting, provider unavailable) and canonical lifecycle statuses (Pending, In-Progress, Failed).
- Achieve comprehensive accessibility and responsive design polish across desktop, tablet, and mobile layouts, including keyboard navigation, focus trapping in modals, accessible status labels, and ARIA live regions.

### Responsibility Boundary
The specifications consistently reflect the following architecture:
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

**Task & Orchestration owns:** Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle, routing request representation (Auto, Specific Agent, Predefined Workflow), conversation and Task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform Task requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, frontend rendering and user interaction.

**Task & Orchestration does not own:** OpenClaw installation, OpenClaw container creation, OpenClaw start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS or networking, Gateway credential creation or platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base or RAG Management, custom orchestration engine, custom LLM router, custom multi-agent collaboration engine, custom workflow runtime, OpenClaw internals.

### Explicit Non-Goals
This change explicitly does not implement:
- OpenClaw transport implementation or OpenClaw Gateway connection;
- Runtime provisioning or container management;
- Credential management or secret ownership;
- Backend adapter implementation;
- Agent Management or Workflow Management implementation;
- Orchestration-engine implementation.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-workspace`: Enhances the production user interface to establish a provider-neutral workspace shell, polished composer ergonomics, execution feed clarity, task-scoped processing inspection, distinct UI loading/reconnecting states, mock execution transparency, and comprehensive accessibility compliance.
- `task-history`: Establishes a multi-turn conversation workspace with active session navigation, conversation-oriented history search and status filtering, and preserves background Task execution by immutable Task ID.
- `task-execution-lifecycle`: Enforces terminal-state protection ensuring a terminal Task does not return to an active lifecycle state due to delayed or stale updates.
- `task-orchestration-core`: Consistently reflects responsibility boundaries, architectural ownership, external dependency contracts, and cross-change dependency order.

## Impact

### Architectural Impact
- **Frontend Workspace & Layout**: Refines the component tree in `apps/frontend/src/features/task-orchestration/components` including `TaskOrchestrationPage`, sidebar history navigation, workspace top bar, execution feed, composer area, processing detail modal, and cancel confirmation dialog. The UI submits Task requests through the platform Task boundary, does not connect directly to OpenClaw, does not receive or store OpenClaw credentials, does not create or manage OpenClaw instances, renders canonical Task state, remains provider-neutral, treats conversation switching as presentation-only, preserves background Task execution by immutable Task ID, distinguishes temporary UI states from Task lifecycle states, does not infer production completion or failure, and does not silently fall back from production execution to mock execution.
- **State Management & Runtime Isolation**: Enhances the in-memory task store (`TaskCreationState`) to maintain the conversation-oriented architecture:
  ```text
  TaskCreationState
  ├── tasks
  ├── conversations
  ├── activeConversationId
  ├── activeTaskId
  └── presentation state
  ```
  Frontend-owned state includes: composer draft, selector state, modal state, search query, filter state, submitting, loading, reconnecting. Canonical Task state includes: status, timeline, partial output, final result, error, cancellation, timestamps.

### External Dependencies and Cross-Change Boundaries
The Task & Orchestration module defines consumer-facing ports conceptually but does not claim ownership of their implementations:
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
