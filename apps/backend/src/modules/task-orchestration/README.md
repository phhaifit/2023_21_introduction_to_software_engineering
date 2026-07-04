# Task & Orchestration Module

## Overview

The Task & Orchestration module serves as the coordination hub for task intent modeling, routing validation, conversation history, execution start/cancel/state APIs, and execution observation within virtual company workspaces.

This README describes the current code, not only the intended architecture. The active UI flow now uses two explicit steps:

- `POST /api/workspaces/:workspaceId/tasks` calls `CreateTaskService` to create `Task` and `TaskWork` records and publish `task.submitted`.
- `POST /api/workspaces/:workspaceId/executions/start` starts OpenClaw execution using the backend-generated Task/Work IDs through `OpenClawExecutionOrchestrator`, `OpenClawTaskExecutionAdapter`, and `OpenClawHttpSSETransport`. Execution binding/event state for this path is currently held in orchestrator/adapter memory; conversation history may use Prisma when `DATABASE_URL` is configured.

## Architectural Boundaries

The module strictly enforces architectural boundaries to decouple domain logic from specific infrastructure or execution engines.

```
+-------------------------------------------------------------------------+
|                        Task & Orchestration Module                      |
|                                                                         |
|  +-----------------------+                    +----------------------+  |
|  |     Task / TaskRun    |                    | ExecutionSnapshot /  |  |
|  |     Domain Models     |                    | Observability Proj.  |  |
|  +-----------+-----------+                    +----------^-----------+  |
|              |                                           |              |
|  +-----------v-----------+                    +----------+-----------+  |
|  | StartExecutionCommand |                    | NormalizedRuntime    |  |
|  | (Provider-Neutral)    |                    | Event / Error        |  |
|  +-----------+-----------+                    +----------^-----------+  |
|              |                                           |              |
|              |         +-----------------------+         |              |
|              +--------->  TaskExecutionAdapter +---------+              |
|                        +-----------^-----------+                        |
+------------------------------------|------------------------------------+
                                     | (Consumes Runtime Reference)
+------------------------------------|------------------------------------+
| Workspace / Infrastructure         |                                    |
| +----------------------------------+----------------------------------+ |
| | WorkspaceExecutionRuntimeResolver / WorkspaceExecutionRuntime       | |
| +----------------------------------+----------------------------------+ |
|                                    | (POST /v1/chat/completions)      |
| +----------------------------------v----------------------------------+ |
| | OpenClaw Execution Provider (apps/backend/src/shared/openclaw/*)    | |
| +---------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
```

### Responsibility Split

#### Task & Orchestration (This Module)
- **Owns in current code**: Task and TaskWork domain models, create-task application ports/service foundation, routing validation, conversation history repositories, execution API router, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to OpenClaw HTTP/SSE requests, mapping OpenClaw updates to normalized runtime events, cancellation request forwarding, in-memory execution association/state for the live `/executions/*` path, lifecycle projection, streaming/result/error/observability presentation, task-scoped event isolation, and frontend rendering/interaction.
- **Does Not Own**: OpenClaw installation, container creation, start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS/networking, Gateway credential creation, platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base/RAG Management, custom orchestration engines, custom LLM routers, custom multi-agent collaboration engines, custom workflow runtimes, or OpenClaw internals.

#### OpenClaw / Execution Provider
- **Owns**: Executing AI agent/workflow tasks, processing prompts, coordinating internal sub-agents, invoking tools, managing provider-side sessions, and emitting raw execution lifecycle updates and observability diagnostics.

#### Workspace / Infrastructure
- **Owns**: Providing a valid `WorkspaceExecutionRuntimeResolver` and `WorkspaceExecutionRuntime`. Managing the physical lifecycle of OpenClaw containers/VMs (provisioning, starting, stopping, deleting, resizing) via `apps/backend/src/shared/openclaw/runtime-adapter.ts`.

#### Agent Management
- **Owns**: Managing the catalog of workspace-scoped selectable agents, validating agent activity status, and providing platform-agent to provider-agent mappings (`ExternalAgentCatalog`).

#### Workflow Management
- **Owns**: Managing the catalog of workspace-scoped selectable workflows, validating workflow activity status, and providing platform-workflow to provider-workflow mappings (`ExternalWorkflowCatalog`).

## Core Contracts

All core execution contracts reside in `packages/shared/src/contracts/task-execution.ts`.

### `TaskExecutionAdapter`
The primary consumer port interface defining the lifecycle operations for execution adapters:
```ts
interface TaskExecutionAdapter {
  startExecution(command: StartExecutionCommand): Promise<ExecutionBinding>;
  cancelExecution(taskId: EntityId<"taskId">): Promise<void>;
  getExecutionSnapshot(taskId: EntityId<"taskId">): Promise<ExecutionSnapshot>;
  subscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void;
  unsubscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void;
  releaseResources(): Promise<void>;
}
```

### `StartExecutionCommand`
The DTO passed to initiate execution. It contains only platform-level identifiers, prompts, and routing selections, explicitly excluding raw credentials, API keys, or infrastructure configurations.

### `ExecutionBinding`
The binding record linking the platform task to the execution runtime and provider reference:
- `taskId`: The platform Task ID.
- `runtimeInstanceId`: The external runtime instance reference.
- `providerExecutionReference`: The unique reference returned by the provider upon successful start.
- `verifiedProviderFields`: Provider fields that have been verified and are safe to expose internally.

### `NormalizedRuntimeEvent`
A closed discriminated union representing the full range of execution lifecycle and observability events:
- `execution-accepted`: Execution successfully queued by the provider.
- `step-started`: A new step in the execution began.
- `partial-output-received`: Incremental streaming text received.
- `sub-activity`: Sub-agent or tool invocation details.
- `execution-completed`: Normal completion with final result payload.
- `execution-failed`: Execution terminated with a `NormalizedRuntimeError`.
- `execution-cancelled`: Execution successfully cancelled by the provider.

## `OpenClawExecutionOrchestrator` Start Flow

The `OpenClawExecutionOrchestrator` coordinates the initiation of execution through exactly 10 sequential steps:
1. **Receive authenticated and authorized request context**: Derives principal identity and verifies authorization via external authentication services.
2. **Validate Task input**: Ensures `StartExecutionCommand` contains only platform fields and explicitly excludes raw credentials or container configurations.
3. **Validate routing selection through external catalogs**: Verifies the active status and mappings of specific agents or workflows via `ExternalAgentCatalog` or `ExternalWorkflowCatalog`.
4. **Create platform Task and TaskWork**: The current UI first calls `/tasks`, which persists through `CreateTaskService` repository ports. The later `/executions/*` path initializes execution state in memory for live OpenClaw streaming.
5. **Resolve externally supplied execution runtime**: Invokes `WorkspaceExecutionRuntimeResolver` to obtain a verified, running runtime instance reference.
6. **Start execution through the adapter**: Invokes `TaskExecutionAdapter.startExecution` to map the request and dispatch it via non-blocking initialization.
7. **Store the execution association**: Records the `ExecutionBinding` linking Platform Task ↔ external runtime reference ↔ provider execution reference.
8. **Consume normalized events**: Subscribes to incoming `NormalizedRuntimeEvent` union objects emitted by the adapter via Server-Sent Events (`chat.completion.chunk`).
9. **Update canonical lifecycle**: Maps runtime observations to canonical task statuses (`in-progress`, `completed`, `failed`, `canceled`).
10. **Expose state through the platform API**: Exposes the updated snapshot and event log to consumers.

## Cancellation Forwarding

Cancellation follows a strict forwarding boundary:
- When a cancellation request is received, Task & Orchestration validates task cancellability, loads the `ExecutionBinding`, forwards the cancellation request to `TaskExecutionAdapter.cancelExecution`, applies canonical cancellation after defined confirmation, and suppresses late updates.
- It strictly **does not** terminate the OpenClaw container, stop the workspace runtime, or delete the Gateway. Stream cancellation is governed entirely at the local transport level via `AbortController.abort()`.

## Transport Recovery & Event Protections

To maintain resilience against network disconnects and unstable transport layers, the adapter implements three vital mechanisms:
- **Snapshot Reconciliation**: Upon transport reconnection, the adapter fetches a fresh `ExecutionSnapshot` and reconciles any missed lifecycle transitions before resuming event consumption.
- **Duplicate Event Protection**: The adapter maintains a registry of seen event IDs within the active session, silently dropping duplicate events to prevent duplicate lifecycle transitions or state corruption.
- **Stale Event Protection**: The adapter verifies event timestamps and monotonic sequence numbers, ignoring delayed or out-of-order events that arrive after a more recent state transition has already occurred.

## Current Execution Behavior

### `OpenClawTaskExecutionAdapter`
- **Location**: `apps/backend/src/features/task-execution/adapters/openclaw-task-execution-adapter.ts`
- **Behavior**: Connects to the OpenClaw Gateway through `OpenClawHttpSSETransport`, validates routing through injected agent/workflow catalogs, maps gateway chunks to `NormalizedRuntimeEvent`, keeps adapter snapshots/event history in memory, and exposes task-scoped subscriptions to the API router.

### Live API Path
- The local server mounts `createTaskOrchestrationRouter` under `/api/workspaces/:workspaceId`.
- The current frontend provider calls `/tasks` first, then `/executions/start`, `/executions/:taskId/stream`, `/executions/:taskId/state`, and `/executions/:taskId/cancel`.
- `POST /api/workspaces/:workspaceId/tasks` is the backend identity source for Task ID and Work ID.

### Local-demo KB/RAG chat path

When Task chat uses `specific-agent` routing, the HTTP frontend provider creates
the task normally and calls
`POST /api/workspaces/:workspaceId/tasks/agent-knowledge/ask` instead of
starting OpenClaw execution. The Task router delegates through the
`AgentKnowledgeAskPort`; the local composition connects that port to the
KB/RAG-owned `AgentKnowledgeOrchestrationUseCase`, which invokes
`knowledge.retrieve`.

Active document-level grants constrain retrieval. An answered response is
projected into the existing completed assistant turn and includes bounded safe
citations. No assigned evidence produces the existing
`insufficient_evidence` answer. Auto and Workflow modes continue through the
current OpenClaw execution path.

This is a local-demo bridge, not production OpenClaw tool registration.
Runtime retrieval still uses the configured KB/RAG embedding and pgvector
adapters; deterministic tests inject fake adapters or ports.
