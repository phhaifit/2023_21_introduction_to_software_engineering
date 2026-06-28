# Task Execution Adapter Contract Specification

## ADDED Requirements

### Requirement: Task Execution Adapter Port Contract
The Task & Orchestration module SHALL define the `TaskExecutionAdapter` port interface as the provider-neutral consumer-side boundary for managing runtime execution lifecycle operations. The interface SHALL support start execution, cancel execution, get execution snapshot, subscribe to normalized events, unsubscribe, and release local adapter resources.

#### Scenario: Execute adapter lifecycle operations
* **GIVEN** a concrete adapter implementing `TaskExecutionAdapter` is instantiated
* **WHEN** the platform task domain invokes runtime operations
* **THEN** the adapter SHALL execute start, cancel, snapshot, subscribe, unsubscribe, and release local adapter resources
* **AND** the adapter SHALL decouple the domain from underlying transport protocols

---

### Requirement: Start Execution Command Platform Fields Only
The `StartExecutionCommand` SHALL contain strictly platform-owned fields: Task ID, Work ID, workspace ID, conversation ID, prompt, routing selection, and attachment references when supported. It SHALL explicitly exclude raw credentials, container configuration, infrastructure resource configuration, React state, and provider-specific unverified payloads.

#### Scenario: Construct StartExecutionCommand DTO
* **GIVEN** a task is prepared for execution
* **WHEN** the `StartExecutionCommand` is constructed
* **THEN** it SHALL include Task ID, Work ID, workspace ID, conversation ID, prompt, routing selection, and attachment references
* **AND** it SHALL NOT include raw credentials, container config, infrastructure config, React state, or unverified provider payloads

---

### Requirement: Execution-Runtime Reference & No Provisioning
The adapter SHALL receive or resolve an externally supplied runtime reference. The Task & Orchestration module SHALL NOT provision the referenced runtime. A usable execution-runtime reference must be supplied by Workspace Management or the responsible infrastructure module before real execution can begin.

#### Scenario: Receive external runtime reference
* **GIVEN** the `TaskExecutionAdapter` is invoked for a workspace
* **WHEN** it requires a connection to an execution runtime
* **THEN** it SHALL receive or resolve an externally supplied runtime reference
* **AND** the Task & Orchestration module SHALL NOT provision the referenced runtime.

---

### Requirement: Execution Binding Association
The system SHALL define `ExecutionBinding` associating Platform Task ↔ external runtime reference ↔ provider session/run/execution reference. It SHALL include only provider fields that have been verified or keep them abstract.

#### Scenario: Establish ExecutionBinding
* **GIVEN** an execution runtime successfully starts a task
* **WHEN** the execution binding is recorded
* **THEN** it SHALL associate the Platform Task with the external runtime reference and provider execution reference
* **AND** it SHALL NOT include unverified provider schema fields

---

### Requirement: Normalized Runtime Events
The `NormalizedRuntimeEvent` SHALL be a closed discriminated union covering execution accepted, execution started, routing resolved, step started, step completed, partial output received, execution completed, execution failed, execution canceled, and optional tool/workflow/sub-agent activity.

#### Scenario: Emit normalized runtime events
* **GIVEN** an external runtime is executing a task
* **WHEN** execution milestones occur
* **THEN** the adapter SHALL emit corresponding `NormalizedRuntimeEvent` union objects
* **AND** subscribers SHALL NOT be required to parse raw provider webhook formats

---

### Requirement: Normalized Error Contract & Security
The adapter SHALL define normalized errors including execution runtime unavailable, execution runtime not running, routing target unavailable, provider authentication rejected, execution start rejected, execution failed, cancellation failed, and snapshot recovery failed. Errors SHALL be safe for presentation and SHALL NOT expose credentials or raw sensitive payloads.

#### Scenario: Handle runtime failures securely
* **GIVEN** an execution runtime encounters a failure
* **WHEN** the adapter maps the error
* **THEN** it SHALL return a normalized error union object safe for presentation
* **AND** it SHALL NOT expose raw credentials, system secrets, or sensitive provider payloads

---

### Requirement: Mock Execution Adapter
The system SHALL establish `MockTaskExecutionAdapter` wrapping existing in-memory mock execution as a legitimate Task & Orchestration test and development adapter satisfying `TaskExecutionAdapter`.

#### Scenario: Execute mock runtime
* **GIVEN** the system is running in development or testing mode
* **WHEN** `MockTaskExecutionAdapter` is invoked
* **THEN** it SHALL satisfy the `TaskExecutionAdapter` port contract
* **AND** it SHALL function as a legitimate test and development adapter without silent fallback from production execution

---

### Requirement: Responsibility Boundary & Architectural Ownership
Workspace Management or the responsible infrastructure module provides a resolvable execution-runtime reference. Task & Orchestration consumes that reference to submit and monitor work. The Task & Orchestration module SHALL own Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle, routing request representation, conversation/Task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, and frontend rendering/interaction. The Task & Orchestration module SHALL NOT own OpenClaw installation, container creation, start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS/networking, Gateway credential creation, platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base/RAG Management, custom orchestration engines, custom LLM routers, custom multi-agent collaboration engines, custom workflow runtimes, or OpenClaw internals.

#### Scenario: Verify architectural ownership boundaries
* **GIVEN** the Task & Orchestration module is initialized
* **WHEN** the system interacts with external dependencies or execution runtimes
* **THEN** it SHALL consume externally supplied runtime references provided by Workspace Management or infrastructure modules
* **AND** it SHALL NOT provision OpenClaw instances, manage containers, or administer external module domains

---

### Requirement: External Dependency Contracts
The Task & Orchestration specifications SHALL define consumer-facing ports conceptually without claiming ownership of their implementations:
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
External dependencies SHALL be defined conceptually for Agent Management (workspace-scoped selectable agents, platform-agent to provider-agent mapping), Workflow Management (workspace-scoped selectable workflows, platform-workflow to provider-workflow mapping), Workspace User Management / Authentication (authorized principal and operation permission), and Workspace Management (resolvable execution-runtime reference).

#### Scenario: Consume external dependency contracts
* **GIVEN** a task execution or routing selection is initiated
* **WHEN** Task & Orchestration interacts with external modules
* **THEN** it SHALL consume conceptual ports for Agent Management, Workflow Management, Authentication, and Workspace Management
* **AND** it SHALL NOT implement or administer those external modules

---

### Requirement: Cross-Change Dependency Order
The cross-change dependency order SHALL be documented and adhered to as follows:
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

#### Scenario: Enforce cross-change dependency order
* **GIVEN** the multi-change implementation roadmap
* **WHEN** changes are implemented or validated
* **THEN** `establish-openclaw-task-integration-contracts` SHALL define consumer-side contracts
* **AND** subsequent changes SHALL respect the defined contract and runtime prerequisite hierarchy
