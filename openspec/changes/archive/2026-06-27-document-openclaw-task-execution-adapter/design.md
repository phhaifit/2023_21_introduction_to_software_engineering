## Context

The Task & Orchestration module serves as the central coordination hub for executing tasks within virtual company workspaces. A critical component of this architecture is the `TaskExecutionAdapter` port and its concrete implementations (`OpenClawTaskExecutionAdapter` and `MockTaskExecutionAdapter`), along with the `OpenClawExecutionOrchestrator`. Currently, while the code implementations and simulated transport tests are fully developed and robust, comprehensive technical documentation detailing these boundaries within the module's README and high-level API contracts is lacking. This document establishes the architectural design for formalizing this technical documentation without altering any underlying runtime behavior.

## Goals / Non-Goals

**Goals:**
- Create comprehensive technical documentation in `apps/backend/src/modules/task-orchestration/README.md`.
- Clearly define `TaskExecutionAdapter`, DTO contracts (`StartExecutionCommand`, `ExecutionBinding`, `NormalizedRuntimeEvent`), and the execution boundary.
- Document the `OpenClawExecutionOrchestrator` start flow, cancellation forwarding, and external dependency catalogs.
- Detail transport recovery mechanisms, stale-event protections, and duplicate-event handling.
- Delineate mock/simulated behavior versus production integration.
- Update high-level module API documentation in `docs/api/module-api-contracts.md`.

**Non-Goals:**
- No implementation or provisioning of OpenClaw runtimes or Docker containers.
- No hard-coding of runtime endpoints or creation of credentials.
- No introduction of actual HTTP/WebSocket/gRPC network transports.
- No modification of existing lifecycle, routing, or shared contract behaviors.
- No modification of production code or automated test suites.
- No archival of the change in this phase.

## Current Architecture

The current architecture implements a strict consumer-provider pattern where Task & Orchestration acts solely as a consumer of externally supplied runtime references:
- **`packages/shared/src/contracts/task-execution.ts`**: Defines provider-neutral DTOs (`StartExecutionCommand`, `ExecutionBinding`, `NormalizedRuntimeEvent`, `NormalizedRuntimeError`) and the `TaskExecutionAdapter` port interface.
- **`OpenClawTaskExecutionAdapter`**: Implements `TaskExecutionAdapter`, handling simulated event ingestion, transport connection state tracking, duplicate event filtering, and stale event protection.
- **`OpenClawExecutionOrchestrator`**: Coordinates the rigorous 10-step execution start flow, cancellation forwarding, and external catalog validations.
- **`MockTaskExecutionAdapter`**: Implements an in-memory mock execution environment for testing and development.
- **`apps/backend/src/shared/openclaw/runtime-adapter.ts`**: Owns the actual OpenClaw infrastructure provisioning, start/stop/delete, and resize operations (belonging to workers/shared infrastructure, completely outside Task & Orchestration).

## Adapter Boundary

The `TaskExecutionAdapter` acts as an architectural boundary designed to decouple the Task & Orchestration domain from specific execution runtimes and transport protocols. It ensures that the core domain operates entirely on normalized DTOs and canonical statuses (`pending`, `in-progress`, `completed`, `failed`, `canceled`). The adapter consumes an externally provided `WorkspaceExecutionRuntime` reference but is strictly prohibited from provisioning, starting, stopping, or administering that runtime.

## Responsibility Split

### Task & Orchestration
- **Owns**: Task and TaskWork domain models, task creation/validation, canonical task lifecycle, routing request representation, conversation/task history, mock execution for development/tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, task-scoped event isolation, and frontend rendering/interaction.
- **Does Not Own**: OpenClaw installation, container creation, start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS/networking, Gateway credential creation, platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base/RAG Management, custom orchestration engines, custom LLM routers, custom multi-agent collaboration engines, custom workflow runtimes, or OpenClaw internals.

### OpenClaw / Execution Provider
- **Owns**: Executing AI agent/workflow tasks, processing prompts, coordinating internal sub-agents, invoking tools, managing provider-side sessions, and emitting raw execution lifecycle updates and observability diagnostics.

### Workspace / Infrastructure
- **Owns**: Providing a valid `WorkspaceExecutionRuntimeResolver` and `WorkspaceExecutionRuntime`. Managing the physical lifecycle of OpenClaw containers/VMs (provisioning, starting, stopping, deleting, resizing) via `apps/backend/src/shared/openclaw/runtime-adapter.ts`.

### Agent Management
- **Owns**: Managing the catalog of workspace-scoped selectable agents, validating agent activity status, and providing platform-agent to provider-agent mappings (`ExternalAgentCatalog`).

### Workflow Management
- **Owns**: Managing the catalog of workspace-scoped selectable workflows, validating workflow activity status, and providing platform-workflow to provider-workflow mappings (`ExternalWorkflowCatalog`).

## Request Flow

The execution start flow operates via the `OpenClawExecutionOrchestrator` following exactly 10 explicit sequential steps:
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

## Event Normalization

Incoming raw execution updates and optional observability payloads (routing, workflow, tool, sub-agent activity, handoff, review, aggregation, completion, provider diagnostics) are ingested by the adapter and mapped to a closed discriminated union: `NormalizedRuntimeEvent`. 
- **Security Redaction**: The adapter implements automated security redaction filters (`sanitizeObservabilityPayload`, `sanitizeNormalizedRuntimeError`), scrubbing raw credentials, API keys, system paths, and sensitive provider payloads before presentation.
- **Event-Scoping Isolation**: Every event is strictly scoped to the matching workspace ID, Task ID, Work ID, and execution reference to ensure multi-tenant conversation isolation.

## Cancellation and Failure Handling

- **Cancellation Forwarding**: When a cancellation request is received, Task & Orchestration validates task cancellability, loads the `ExecutionBinding`, forwards the cancellation request to `TaskExecutionAdapter.cancelExecution`, applies canonical cancellation after defined confirmation, and suppresses late updates. It strictly does not terminate the OpenClaw container, stop the workspace runtime, or delete the Gateway.
- **Failure Handling**: If an execution runtime is unavailable or stopped during start, the orchestrator immediately throws a normalized error (`execution-runtime-unavailable` or `execution-runtime-not-running`) without attempting to provision a runtime and without silently falling back to mock execution.

## Mock vs Production Behavior

- **`MockTaskExecutionAdapter`**: Operates entirely in-memory as a legitimate test and development adapter satisfying `TaskExecutionAdapter`. It resolves runtime references without provisioning them and simulates execution milestones directly.
- **`OpenClawTaskExecutionAdapter`**: Operates as a production integration skeleton. It contains complete production logic for the 10-step start flow, RBAC authorization, external catalog checks, snapshot reconciliation, and security redaction. However, the physical network transport layer currently utilizes simulated event ingestion (`simulateIncomingProviderEvent`) for contract and integration verification rather than actual HTTP/WebSocket/gRPC network calls.

## Current Limitations

- **Simulated Transport**: The physical network transport connecting `OpenClawTaskExecutionAdapter` to a live OpenClaw container is currently simulated. Implementing an actual network transport requires injecting a concrete HTTP/WebSocket client into the adapter.
- **File Placement**: `OpenClawTaskExecutionAdapter` resides in `apps/backend/src/features/task-execution/adapters/` while `MockTaskExecutionAdapter` resides in `apps/backend/src/modules/task-orchestration/application/`. The documentation will clarify both locations to prevent maintainer confusion.

## Testing Notes

- Verification relies on existing contract and integration test suites (`mock-task-execution-adapter.test.ts` and `openclaw-task-execution-adapter.test.ts`).
- No modifications are made to test files; execution of `npm test`, `npm run build`, `git diff --check`, and `openspec validate` ensures zero regression.

## Risks / Trade-offs

- **Risk**: Maintainers might confuse the production integration skeleton with a fully active network client.
  **Mitigation**: The documentation explicitly highlights the simulated transport mechanism and defines the exact prerequisites required to attach a real network transport in the future.
- **Risk**: Documentation drift between shared contracts and module README.
  **Mitigation**: Detailed DTO structures and exact port interfaces are directly cited and cross-linked between `apps/backend/src/modules/task-orchestration/README.md` and `docs/api/module-api-contracts.md`.
