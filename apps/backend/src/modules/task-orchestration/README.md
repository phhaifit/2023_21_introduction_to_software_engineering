# Task & Orchestration Module

## Overview

The Task & Orchestration module serves as the central coordination hub for task creation, routing validation, lifecycle state tracking, and execution observation within virtual company workspaces. It operates under a strict consumer-provider architectural model, where it consumes externally provided execution runtimes while maintaining independence from infrastructure provisioning, credential management, and internal orchestration engine administration.

## Architectural Boundaries

The module strictly enforces architectural boundaries to decouple domain logic from specific infrastructure or execution engines.

```
+-------------------------------------------------------------------------+
|                        Task & Orchestration Module                      |
|                                                                         |
|  +-----------------------+                    +----------------------+  |
|  |     Task / TaskWork   |                    | ExecutionSnapshot /  |  |
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
|                                    | (Actual Execution / Physical VMs)  |
| +----------------------------------v----------------------------------+ |
| | OpenClaw Execution Provider (apps/backend/src/shared/openclaw/*)    | |
| +---------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
```

### Responsibility Split

#### Task & Orchestration (This Module)
- **Owns**: Task and TaskWork domain models, task creation/validation, canonical task lifecycle, routing request representation, conversation/task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, task-scoped event isolation, and frontend rendering/interaction.
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
  startExecution(command: StartExecutionCommand, runtime: WorkspaceExecutionRuntime): Promise<ExecutionBinding>;
  cancelExecution(binding: ExecutionBinding, runtime: WorkspaceExecutionRuntime): Promise<void>;
  getSnapshot(binding: ExecutionBinding, runtime: WorkspaceExecutionRuntime): Promise<ExecutionSnapshot>;
  subscribeToEvents(binding: ExecutionBinding, runtime: WorkspaceExecutionRuntime, onEvent: (event: NormalizedRuntimeEvent) => void): Promise<{ unsubscribe: () => void }>;
}
```

### `StartExecutionCommand`
The DTO passed to initiate execution. It contains only platform-level identifiers, prompts, and routing selections, explicitly excluding raw credentials, API keys, or infrastructure configurations.

### `ExecutionBinding`
The binding record linking the platform task to the execution runtime and provider reference:
- `taskId`: The platform Task ID.
- `workId`: The platform Work ID.
- `workspaceId`: The workspace context.
- `runtimeReference`: The external runtime reference provided by Workspace Management.
- `providerExecutionReference`: The unique reference returned by the provider upon successful start.

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
4. **Create platform Task and TaskWork**: Initializes canonical persistence state in `pending`.
5. **Resolve externally supplied execution runtime**: Invokes `WorkspaceExecutionRuntimeResolver` to obtain a verified, running runtime instance reference.
6. **Start execution through the adapter**: Invokes `TaskExecutionAdapter.startExecution` to map the request and dispatch it.
7. **Store the execution association**: Records the `ExecutionBinding` linking Platform Task ↔ external runtime reference ↔ provider execution reference.
8. **Consume normalized events**: Subscribes to incoming `NormalizedRuntimeEvent` union objects emitted by the adapter.
9. **Update canonical lifecycle**: Maps runtime observations to canonical task statuses (`in-progress`, `completed`, `failed`, `canceled`).
10. **Expose state through the platform API**: Exposes the updated snapshot and event log to consumers.

## Cancellation Forwarding

Cancellation follows a strict forwarding boundary:
- When a cancellation request is received, Task & Orchestration validates task cancellability, loads the `ExecutionBinding`, forwards the cancellation request to `TaskExecutionAdapter.cancelExecution`, applies canonical cancellation after defined confirmation, and suppresses late updates.
- It strictly **does not** terminate the OpenClaw container, stop the workspace runtime, or delete the Gateway.

## Transport Recovery & Event Protections

To maintain resilience against network disconnects and unstable transport layers, the adapter implements three vital mechanisms:
- **Snapshot Reconciliation**: Upon transport reconnection, the adapter fetches a fresh `ExecutionSnapshot` and reconciles any missed lifecycle transitions before resuming event consumption.
- **Duplicate Event Protection**: The adapter maintains a registry of seen event IDs within the active session, silently dropping duplicate events to prevent duplicate lifecycle transitions or state corruption.
- **Stale Event Protection**: The adapter verifies event timestamps and monotonic sequence numbers, ignoring delayed or out-of-order events that arrive after a more recent state transition has already occurred.

## Mock vs Production Behavior

### `MockTaskExecutionAdapter`
- **Location**: `apps/backend/src/modules/task-orchestration/application/mock-task-execution-adapter.ts`
- **Behavior**: Operates entirely in-memory as a legitimate test and development adapter satisfying `TaskExecutionAdapter`. It resolves runtime references without provisioning them and simulates execution milestones directly.

### `OpenClawTaskExecutionAdapter`
- **Location**: `apps/backend/src/features/task-execution/adapters/openclaw-task-execution-adapter.ts`
- **Behavior**: Operates as a production integration skeleton. It contains complete production logic for the 10-step start flow, RBAC authorization, external catalog checks, snapshot reconciliation, and security redaction. However, the physical network transport layer currently utilizes simulated event ingestion (`simulateIncomingProviderEvent`) for contract and integration verification rather than actual HTTP/WebSocket/gRPC network calls.
- **Prerequisites for Actual Network Transport**: Attaching a real network transport in the future requires injecting a concrete HTTP/WebSocket client into the adapter to replace the simulated event ingestion mechanism.
