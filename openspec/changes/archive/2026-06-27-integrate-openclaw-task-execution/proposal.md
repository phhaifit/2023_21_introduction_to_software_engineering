## Why

### Problem
The Task & Orchestration module requires concrete consumer-side integration with an externally provided OpenClaw runtime. To maintain strict modularity and security, this integration must operate exclusively through provider-neutral adapter contracts, decoupling the application domain from infrastructure provisioning, container health management, and provider internals.

### Goals
This change must:
- Specify the Task & Orchestration consumer-side integration with an externally provided OpenClaw runtime.
- Ensure Task & Orchestration asks `WorkspaceExecutionRuntimeResolver` for a runtime reference, validates it is usable, and passes it to the adapter without implementing the resolver or provisioning the runtime.
- Implement Auto-routing by sending an Auto routing request to the configured OpenClaw entry point without implementing an LLM Router.
- Implement Specific Agent and Predefined Workflow routing by validating externally supplied workspace-scoped contracts and obtaining provider mappings.
- Define explicit runtime unavailable behavior returning a normalized execution-unavailable failure without provisioning a runtime or silently switching to mock execution.
- Formalize a rigorous 10-step execution start flow consuming authenticated principals and external authorization boundaries.
- Specify cancellation forwarding and state recovery (snapshot reconciliation, duplicate/stale event protection, reconnect behavior, background Task continuity).
- Reframe mock execution as a legitimate test and development adapter.

## What Changes

### Scope of Changes
- Implement `OpenClawTaskExecutionAdapter` satisfying `TaskExecutionAdapter` for runtime interaction.
- Consume `WorkspaceExecutionRuntimeResolver` to resolve external runtime references.
- Implement Auto-routing delegation to OpenClaw routing/coordinator entry points.
- Implement Specific Agent and Predefined Workflow mapping via external module catalogs.
- Enforce strict runtime unavailable behavior: `GIVEN a valid Task is submitted for real execution AND no running execution runtime can be resolved for the workspace WHEN Task & Orchestration attempts to begin execution THEN it SHALL return a normalized execution-unavailable failure AND it SHALL NOT provision a runtime AND it SHALL NOT silently switch to mock execution`.
- Formalize the 10-step start flow:
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
- Implement cancellation forwarding (validating cancellability, loading association, forwarding cancellation, applying canonical cancellation after defined confirmation, suppressing late updates).
- Implement transport recovery mechanisms (snapshot reconciliation, duplicate-event protection, stale-event handling, reconnect behavior, background Task continuity).

### Responsibility Boundary & Preconditions
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

**Real-Integration Preconditions:** Real integration requires externally supplied: a running OpenClaw development or workspace instance, a verified endpoint, a credential reference, an approved connection method, verified request and event contracts, and a workspace-to-runtime association. If these are unavailable, the OpenSpec change may define contracts, adapter structure, fake transport tests, and blocked integration tasks, but must not claim that real end-to-end execution is complete.

**Task & Orchestration owns:** Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle (Pending, In-Progress, Completed, Failed, Canceled), routing request representation (Auto, Specific Agent, Predefined Workflow), conversation/Task history, mock execution used for development/tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform Task requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, frontend rendering and user interaction.

**Task & Orchestration does not own:** OpenClaw installation, OpenClaw container creation, OpenClaw start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS or networking, Gateway credential creation or platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base or RAG Management, custom orchestration engine, custom LLM router, custom multi-agent collaboration engine, custom workflow runtime, OpenClaw internals.

### Explicit Out of Scope
This change explicitly does not implement:
- Provisioning or infrastructure health orchestration;
- Container restart or Gateway management;
- Subscription enforcement implementation;
- Credential creation or secret ownership;
- Agent Management or Workflow Management implementation;
- Custom orchestration runtime or custom LLM router.

## Capabilities

### New Capabilities
- `openclaw-task-execution`: Implements the concrete consumer-side adapter (`OpenClawTaskExecutionAdapter`), external runtime resolution flow, 10-step start execution sequence, cancellation forwarding, and transport recovery mechanisms without provisioning runtimes or managing infrastructure.

### Modified Capabilities
- `task-execution-adapter`: Extends the adapter contracts to support concrete OpenClaw request/event mapping, external catalog validation for agents/workflows, explicit runtime-unavailable failure rules, and state reconciliation mechanics.

## Impact

### Architectural Impact
- **Backend Task Execution Adapter**: Introduces `OpenClawTaskExecutionAdapter` in `apps/backend/src/features/task-execution/adapters` consuming external runtime references and mapping platform commands to verified OpenClaw requests.
- **System Decoupling**: Delegates runtime resolution to external `WorkspaceExecutionRuntimeResolver`, guaranteeing Task & Orchestration does not provision containers or manage credentials.

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
