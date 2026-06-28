## Why

### Problem
The Task & Orchestration module requires stable, provider-neutral integration contracts to connect the platform Task domain to external execution runtimes. To maintain architectural integrity, these contracts must strictly enforce a consumer-side boundary, decoupling the application domain from runtime provisioning, container orchestration, and provider internals.

### Goals
This change must:
- Establish provider-neutral consumer-side integration contracts owned by Task & Orchestration.
- Define the `TaskExecutionAdapter` interface (start, cancel, snapshot, subscribe, unsubscribe, release local resources).
- Define the `StartExecutionCommand` shape including platform fields only and excluding raw credentials or infrastructure config.
- Define the execution binding associating Platform Task ↔ external runtime reference ↔ provider session/run/execution reference.
- Establish a canonical `NormalizedRuntimeEvent` union covering all execution and optional activity phases.
- Formalize lifecycle status mapping and ensure transport interruptions do not trigger task failures.
- Define a secure, normalized error contract safe for presentation.
- Reframe mock execution as a legitimate Task & Orchestration test and development adapter.

## What Changes

### Scope of Changes
- Define `TaskExecutionAdapter` port interface for managing runtime interaction lifecycle.
- Define `StartExecutionCommand` containing Task ID, Work ID, workspace ID, conversation ID, prompt, routing selection, and attachment references when supported. It explicitly excludes raw credentials, container configuration, infrastructure resource configuration, React state, and provider-specific unverified payloads.
- Define `ExecutionBinding` associating Platform Task ↔ external runtime reference ↔ provider session/run/execution reference.
- Establish `NormalizedRuntimeEvent` covering: execution accepted, execution started, routing resolved, step started, step completed, partial output received, execution completed, execution failed, execution canceled, and optional tool/workflow/sub-agent activity.
- Establish canonical lifecycle mapping table and explicit rule: `Transport interruption SHALL NOT by itself transition a Task to Failed.`
- Define normalized error contract covering: execution runtime unavailable, execution runtime not running, routing target unavailable, provider authentication rejected, execution start rejected, execution failed, cancellation failed, and snapshot recovery failed.
- Establish `MockTaskExecutionAdapter` wrapping existing in-memory mock execution as a legitimate test and development adapter.

### Responsibility Boundary & Prerequisites
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

**External Prerequisite:** A usable execution-runtime reference must be supplied by Workspace Management or the responsible infrastructure module before real execution can begin.

**Task & Orchestration owns:** Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle (Pending, In-Progress, Completed, Failed, Canceled), routing request representation (Auto, Specific Agent, Predefined Workflow), conversation/Task history, mock execution used for development/tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform Task requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, frontend rendering and user interaction.

**Task & Orchestration does not own:** OpenClaw installation, OpenClaw container creation, OpenClaw start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS or networking, Gateway credential creation or platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base or RAG Management, custom orchestration engine, custom LLM router, custom multi-agent collaboration engine, custom workflow runtime, OpenClaw internals.

### Explicit Out of Scope
This change explicitly does not implement:
- Runtime provisioning or container management;
- Secret ownership or credential creation;
- OpenClaw installation or infrastructure deployment;
- Custom AI routing, custom orchestration, or custom multi-agent execution;
- Workspace administration.

## Capabilities

### New Capabilities
- `task-execution-adapter`: Establishes the provider-neutral consumer-side integration contract (`TaskExecutionAdapter`) and DTO definitions (`StartExecutionCommand`, `NormalizedRuntimeEvent`, `ExecutionBinding`, normalized errors) to decouple the platform Task lifecycle from external execution runtimes without provisioning runtimes or managing infrastructure.

### Modified Capabilities
- `task-execution-lifecycle`: Adapts the platform task domain to consume the `TaskExecutionAdapter` port, formalizes lifecycle status mapping rules, and enforces transport disconnection resilience.
- `task-orchestration-core`: Defines `MockTaskExecutionAdapter` as a legitimate test and development adapter, and establishes responsibility boundaries, external dependency contracts, and cross-change dependency order.

## Impact

### Architectural Impact
- **Backend Domain Contracts**: Introduces `packages/shared/src/contracts/task-execution` defining `TaskExecutionAdapter`, `StartExecutionCommand`, `NormalizedRuntimeEvent`, `ExecutionBinding`, and normalized error unions.
- **Runtime Decoupling**: Ensures `StartExecutionCommand` passes strictly platform-owned fields, excluding credentials or container config.

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
