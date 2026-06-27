## Context

The Task & Orchestration module requires stable, provider-neutral consumer-side integration contracts to connect the platform Task domain to external execution runtimes. To maintain architectural integrity, these contracts must strictly enforce a consumer-side boundary, decoupling the application domain from runtime provisioning, container orchestration, and provider internals. The overarching architectural vision mandates a provider-neutral boundary:
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
- Establish provider-neutral consumer-side integration contracts owned by Task & Orchestration.
- Define `TaskExecutionAdapter` port interface (start execution, cancel execution, get execution snapshot, subscribe to normalized events, unsubscribe, release local adapter resources).
- Define `StartExecutionCommand` shape containing platform fields only.
- Define `ExecutionBinding` associating Platform Task ↔ external runtime reference ↔ provider session/run/execution reference.
- Establish `NormalizedRuntimeEvent` union covering all execution and optional activity phases.
- Formalize lifecycle status mapping table and ensure transport interruptions do not trigger task failures.
- Define a secure, normalized error contract safe for presentation.
- Reframe mock execution as a legitimate Task & Orchestration test and development adapter.

**Non-Goals:**
- Runtime provisioning, container management, secret ownership, or OpenClaw installation.
- Custom AI routing, custom orchestration, or custom multi-agent execution.
- Workspace administration or credential creation.

## Decisions

### Decision 1: Consumer-Side `TaskExecutionAdapter` Port
The `TaskExecutionAdapter` port defines six explicit consumer-side lifecycle operations: start execution, cancel execution, get execution snapshot, subscribe to normalized events, unsubscribe, and release local adapter resources.
* *Rationale*: Provides a complete, provider-neutral boundary for managing runtime interactions without leaking provider-specific transport mechanics into the platform domain.
* *Alternatives considered*: Direct RPC calls to OpenClaw within domain controllers. Rejected because it tightly couples the platform domain to a specific execution engine and transport protocol.

### Decision 2: `StartExecutionCommand` Platform Fields Only
The `StartExecutionCommand` contains strictly platform-owned fields: Task ID, Work ID, workspace ID, conversation ID, prompt, routing selection, and attachment references when supported. It explicitly excludes raw credentials, container configuration, infrastructure resource configuration, React state, and provider-specific unverified payloads.
* *Rationale*: Maintains strict separation of concerns, ensuring credentials and infrastructure parameters are managed by their owning modules rather than passed through the task domain.
* *Alternatives considered*: Including database connection strings and raw API keys in the command DTO. Rejected because it violates secret ownership and creates severe security risks.

### Decision 3: Execution-Runtime Reference & No Provisioning
The adapter receives or resolves an externally supplied runtime reference. The Task & Orchestration module SHALL NOT provision the referenced runtime. A usable execution-runtime reference must be supplied by Workspace Management or the responsible infrastructure module before real execution can begin.
* *Rationale*: Respects module ownership boundaries and prevents Task & Orchestration from absorbing infrastructure provisioning complexity.
* *Alternatives considered*: Task & Orchestration spawning Docker containers directly upon task start. Rejected because it violates module boundaries and duplicates workspace infrastructure logic.

### Decision 4: `ExecutionBinding` Association
The `ExecutionBinding` defines the association between Platform Task ↔ external runtime reference ↔ provider session/run/execution reference. It includes only provider fields that have been verified or keeps them abstract.
* *Rationale*: Provides a clear audit trail and correlation mechanism for asynchronous webhook or event delivery without coupling to unverified provider schema.
* *Alternatives considered*: Storing arbitrary, unverified provider JSON blobs directly on the Task table. Rejected because it pollutes the database schema with unstable third-party structures.

### Decision 5: `NormalizedRuntimeEvent` Discriminated Union
The `NormalizedRuntimeEvent` is a closed discriminated union covering: execution accepted, execution started, routing resolved, step started, step completed, partial output received, execution completed, execution failed, execution canceled, and optional tool/workflow/sub-agent activity.
* *Rationale*: Ensures the platform task domain can update lifecycle projections deterministically without parsing provider-specific raw event formats.
* *Alternatives considered*: Emitting raw provider webhook payloads directly to subscribers. Rejected because it forces every subscriber to implement provider-specific parsing logic.

### Decision 6: Canonical Lifecycle Mapping & Transport Resilience
The platform maps runtime observations to canonical statuses according to a strict mapping table:
| Observation | Canonical status |
| --- | --- |
| Platform Task accepted | Pending |
| Provider execution confirmed started | In-Progress |
| Partial or activity update | In-Progress |
| Final completion confirmed | Completed |
| Terminal provider failure confirmed | Failed |
| Cancellation confirmed | Canceled |
| Transport interruption | Status unchanged |
Transport interruption SHALL NOT by itself transition a Task to Failed.
* *Rationale*: Prevents transient network drops from prematurely failing long-running enterprise tasks, allowing seamless recovery upon reconnection.
* *Alternatives considered*: Immediately failing the task if the event stream disconnects. Rejected because it destroys active work during minor network hiccups.

### Decision 7: Normalized Error Contract
The adapter defines normalized errors including: execution runtime unavailable, execution runtime not running, routing target unavailable, provider authentication rejected, execution start rejected, execution failed, cancellation failed, and snapshot recovery failed. Errors must be safe for presentation and must not expose credentials or raw sensitive payloads.
* *Rationale*: Provides clear, actionable failure diagnostics to end users while safeguarding system secrets and raw stack traces.
* *Alternatives considered*: Passing raw provider exception strings directly to the frontend. Rejected because it exposes internal infrastructure paths and API keys.

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
* *Alternatives considered*: Defining concrete database repositories for OpenClaw instances within Task & Orchestration. Rejected because it violates module ownership.

## Risks / Trade-offs

* **Risk: External execution runtimes utilize incompatible event schemas** → Mitigation: The `TaskExecutionAdapter` acts as an anti-corruption layer, translating provider-specific updates into the canonical `NormalizedRuntimeEvent` union.
* **Risk: Transport interruptions leave tasks in an indefinite In-Progress state** → Mitigation: While transport drops do not fail tasks directly, the adapter provides a `get execution snapshot` operation to reconcile task state periodically or upon reconnection.

## Migration Plan

1. Define `TaskExecutionAdapter`, `StartExecutionCommand`, `NormalizedRuntimeEvent`, `ExecutionBinding`, and normalized error contracts in `packages/shared/src/contracts/task-execution`.
2. Implement `MockTaskExecutionAdapter` wrapping existing mock execution as a legitimate test and development adapter.
3. Establish conceptual consumer ports for `WorkspaceExecutionRuntimeResolver`.
4. Verify strict validation of all OpenSpec artifacts.

## Open Questions

1. What exact polling interval or retry backoff will be standardized for snapshot reconciliation when recovering from transport interruptions?
2. What specific format will be utilized for attachment references within `StartExecutionCommand` to ensure compatibility with Knowledge Base modules?
