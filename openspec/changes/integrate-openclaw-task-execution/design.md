## Context

The Task & Orchestration module requires concrete consumer-side integration with an externally provided OpenClaw runtime. To maintain strict modularity and security, this integration must operate exclusively through provider-neutral adapter contracts, decoupling the application domain from infrastructure provisioning, container health management, and provider internals. The overarching architectural vision mandates a provider-neutral boundary:
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
- Specify only the Task & Orchestration consumer-side integration with an externally provided OpenClaw runtime.
- Consume `WorkspaceExecutionRuntimeResolver` to resolve runtime references without provisioning them.
- Implement Auto-routing by sending an Auto routing request to the configured OpenClaw entry point without implementing an LLM Router.
- Implement Specific Agent and Predefined Workflow routing by validating externally supplied workspace-scoped contracts and obtaining provider mappings.
- Define explicit runtime unavailable behavior returning a normalized execution-unavailable failure without provisioning a runtime or silently switching to mock execution.
- Formalize a rigorous 10-step execution start flow consuming authenticated principals and external authorization boundaries.
- Specify cancellation forwarding and state recovery (snapshot reconciliation, duplicate/stale event protection, reconnect behavior, background Task continuity).
- Reframe mock execution as a legitimate test and development adapter.

**Non-Goals:**
- Provisioning, infrastructure health orchestration, container restart, or Gateway management.
- Subscription enforcement implementation, credential creation, or secret ownership.
- Agent Management, Workflow Management, custom orchestration runtime, or custom LLM router implementation.

## Decisions

### Decision 1: External Runtime Resolution
Task & Orchestration asks `WorkspaceExecutionRuntimeResolver`, receives a runtime reference, validates that it is usable, and passes it to the OpenClaw adapter. The resolver implementation belongs outside this module.
* *Rationale*: Ensures Task & Orchestration remains completely decoupled from infrastructure provisioning and container orchestration.
* *Alternatives considered*: Task & Orchestration spawning Docker containers directly. Rejected because it violates module boundaries and duplicates workspace infrastructure logic.

### Decision 2: Auto-Routing Delegation
Auto-routing means Task & Orchestration sends an Auto routing request to the configured OpenClaw routing/coordinator entry point. Task & Orchestration must not implement an LLM Router.
* *Rationale*: Keeps the task domain focused on lifecycle management while delegating complex LLM routing decisions to the execution runtime.
* *Alternatives considered*: Building a custom LLM Router inside Task & Orchestration. Rejected because it duplicates OpenClaw core capabilities.

### Decision 3: Specific Agent and Workflow Mapping
For Specific Agent and Predefined Workflow modes, Task & Orchestration receives a platform ID, validates the externally supplied workspace-scoped contract, obtains the provider mapping, and sends the mapped target through the adapter. Agent creation, configuration, enable/disable, provider registration, workflow creation, editing, versioning, and execution definition remain outside scope.
* *Rationale*: Enforces clear module boundaries, ensuring Agent and Workflow Management remain the authoritative sources of truth for their respective domains.
* *Alternatives considered*: Storing raw provider agent definitions directly in the Task table. Rejected because it bypasses Agent Management governance.

### Decision 4: Runtime Unavailable Behavior & No Silent Fallback
GIVEN a valid Task is submitted for real execution AND no running execution runtime can be resolved for the workspace WHEN Task & Orchestration attempts to begin execution THEN it SHALL return a normalized execution-unavailable failure AND it SHALL NOT provision a runtime AND it SHALL NOT silently switch to mock execution.
* *Rationale*: Preserves predictability and transparency in production environments, preventing deceptive simulation fallbacks.
* *Alternatives considered*: Silently falling back to mock execution if OpenClaw is unreachable. Rejected because it misleads production operators.

### Decision 5: Rigorous 10-Step Start Flow
The execution start flow follows 10 explicit steps:
1. Receive authenticated and authorized request context.
2. Validate Task input.
3. Validate routing selection through external catalogs.
4. Create platform Task and TaskWork.
5. Resolve externally supplied execution runtime.
6. Start execution through the adapter.
7. Store the execution association.
8. consume normalized events.
9. update canonical lifecycle.
10. expose state through the platform API.
Task & Orchestration consumes an already authenticated principal and invokes or depends on authorization boundaries without implementing authentication or RBAC itself.
* *Rationale*: Establishes an auditable, secure, and robust execution lifecycle pipeline.
* *Alternatives considered*: Passing unauthenticated requests directly to OpenClaw. Rejected because it introduces severe security vulnerabilities.

### Decision 6: Cancellation Forwarding Boundary
Task & Orchestration owns validating Task cancellability, loading the execution association, forwarding cancellation, applying canonical cancellation after defined confirmation, and suppressing late updates. It does not own terminating the OpenClaw container, stopping the entire workspace runtime, or deleting the Gateway.
* *Rationale*: Prevents task cancellation from destabilizing shared workspace infrastructure.
* *Alternatives considered*: Shutting down the OpenClaw container upon task cancellation. Rejected because it destroys concurrent tasks running in the same workspace.

### Decision 7: Transport Recovery and State Reconciliation
The adapter specifies snapshot reconciliation, duplicate-event protection, stale-event handling, reconnect behavior, and background Task continuity. Provider connection state is strictly separated from Task lifecycle state.
* *Rationale*: Guarantees robust background processing and flawless state recovery during transient network interruptions.
* *Alternatives considered*: Transitioning tasks to Failed immediately upon WebSocket disconnection. Rejected because it destroys active work during minor network hiccups.

### Decision 8: External Dependency Contracts & Responsibility Boundaries
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
* *Alternatives considered*: Implementing concrete infrastructure provisioning controllers within Task & Orchestration. Rejected because it violates module ownership.

## Risks / Trade-offs

* **Risk: Real OpenClaw runtime prerequisites are unavailable during initial development** → Mitigation: The OpenSpec change defines contracts, adapter structure, fake transport tests, and identifies blocked integration tasks without claiming real end-to-end execution is complete.
* **Risk: External catalog validation introduces latency during task start** → Mitigation: Task & Orchestration utilizes conceptual consumer ports that can implement localized caching strategies supplied by external modules.

## Migration Plan

1. Implement `OpenClawTaskExecutionAdapter` and external runtime resolution flow.
2. Establish conceptual external dependency contracts for Agent, Workflow, Authentication, and Workspace Management.
3. Implement the 10-step start flow, cancellation forwarding, and transport recovery mechanics.
4. Verify strict validation of all OpenSpec artifacts and confirm no provisioning logic exists in Task & Orchestration.

## Open Questions

1. What exact transport protocol (e.g., gRPC, WebSockets, or HTTP/SSE) will be finalized for OpenClaw event subscription in the running workspace instance?
2. What specific authentication handshake or credential reference format will be required by the external OpenClaw Gateway endpoint?
