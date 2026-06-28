# task-orchestration-core Specification

## Purpose
Covers Task and Work identity, ownership boundaries, shared orchestration contracts, foundational domain rules, and persistence expectations.

## Requirements

### Requirement: Task and Work Ownership Boundary

The Task & Orchestration module SHALL own Task and TaskWork execution-attempt
records and SHALL only reference Workspace, User, Agent, and Workflow
aggregates.

A Task SHALL support one or more TaskWork attempts, and initial creation SHALL
create exactly one TaskWork.

#### Scenario: Preserve module ownership

* **WHEN** the module foundation is reviewed
* **THEN** Task and TaskWork SHALL be identified as owned entities
* **AND** Workspace, User, Agent, and Workflow SHALL be identified as referenced entities
* **AND** the design SHALL NOT create Workspace, User, Agent, or Workflow tables
* **AND** Agent and Workflow references SHALL be scalar typed IDs rather than Prisma relations

---

### Requirement: Authenticated Workspace Ownership

The system SHALL derive workspace and submitter identity from authenticated
request context rather than accepting those values from the create-task body.

#### Scenario: Build an authenticated create-task command

* **GIVEN** an authenticated request has user and workspace membership context
* **WHEN** `POST /api/workspaces/:workspaceId/tasks` receives a valid request
* **THEN** the route workspace SHALL match the context workspace
* **AND** the internal command SHALL use `context.workspace.workspaceId`
* **AND** the internal command SHALL use `context.user.userId`
* **AND** the request body SHALL NOT provide workspace ID or submitter user ID

#### Scenario: Reject a workspace mismatch

* **GIVEN** the route workspace differs from the authenticated workspace context
* **WHEN** the user attempts to create a task
* **THEN** the system SHALL reject the request as forbidden
* **AND** the system SHALL NOT create a Task or TaskWork

---

### Requirement: Production Domain and Persistence Design

The foundation SHALL define Task and TaskWork domain fields, initial statuses,
Prisma ownership, indexes, timestamp conventions, and deletion behavior before
Task 6 begins.

#### Scenario: Review the Prisma plan

* **WHEN** the foundation architecture is reviewed
* **THEN** Task and TaskWork SHALL use the shared production TaskStatus enum
* **AND** Task and TaskWork SHALL start with production status `queued`
* **AND** TaskWork SHALL remain the domain execution-attempt model
* **AND** TaskRun SHALL remain the backward-compatible Prisma persistence representation
* **AND** the physical `task_runs` table SHALL be preserved
* **AND** `TaskRun.taskRunId` SHALL map to domain `TaskWork.workId`
* **AND** `TaskRun.jobId` SHALL remain worker-handoff persistence metadata
* **AND** no duplicate Prisma `TaskWork` model or `task_works` table SHALL be introduced
* **AND** the future repository adapter SHALL own TaskWork-to-TaskRun mapping
* **AND** the initial TaskWork SHALL use attempt number 1
* **AND** each retry SHALL create a new TaskWork and Work ID for the same Task
* **AND** attempt number SHALL be unique within a Task
* **AND** models SHALL use string application IDs
* **AND** Prisma timestamp fields SHALL be strings containing application-supplied ISO-8601 values
* **AND** Task and TaskRun persistence records SHALL contain required workspace ID
* **AND** tenant, status, creation-time, Task ID, Work ID, and attempt uniqueness indexes SHALL be specified
* **AND** TaskRun-to-Task ownership SHALL be strengthened additively with workspace-safe tenant checks
* **AND** this compatibility decision SHALL NOT change public shared contracts
* **AND** no deletion API or soft-delete field SHALL be introduced by this foundation

---

### Requirement: Public and Private Contract Separation

The foundation SHALL define the public create-task route, request, response,
shared contracts, and internal command without exposing Prisma-generated types.

#### Scenario: Review create-task contracts

* **WHEN** the public contract is reviewed
* **THEN** it SHALL define `POST /api/workspaces/:workspaceId/tasks`
* **AND** the request SHALL contain only prompt and routing input
* **AND** missing authentication SHALL return HTTP 401
* **AND** missing membership, permission failure, or route/context mismatch SHALL return HTTP 403
* **AND** successful creation SHALL return HTTP 201
* **AND** authorization failure SHALL create no records or events
* **AND** the response SHALL use the shared API response envelope
* **AND** the response SHALL expose Task ID, Work ID, initial status, routing summary, and creation timestamp
* **AND** Prisma models and private persistence fields SHALL remain internal

---

### Requirement: Task Events and Application Boundaries

The foundation SHALL define task events, the proposed versioning extension, and
private repository, catalog, publisher, and service interfaces.

#### Scenario: Review the event and service catalog

* **WHEN** the module foundation is reviewed
* **THEN** it SHALL preserve the current event envelope of name, event ID, occurrence timestamp, and payload
* **AND** `task.submitted` SHALL remain the canonical submission event
* **AND** top-level version 1 SHALL be identified as a proposed reviewed shared-contract extension
* **AND** it SHALL distinguish TaskWork attempt events from aggregate Task terminal events
* **AND** a failed attempt alone SHALL NOT emit terminal `task.failed`
* **AND** event payloads SHALL include workspace and aggregate identifiers
* **AND** event payloads SHALL exclude prompts, result bodies, logs, and stack traces
* **AND** repository operations SHALL require workspace scope
* **AND** cross-module agent and workflow checks SHALL use public catalog ports

---

### Requirement: Production and Presentation Status Separation

The foundation SHALL use `@vcp/shared` TaskStatus as the authoritative
production model and SHALL treat PA5 statuses as presentation-only values.

#### Scenario: Translate production status for PA5

* **WHEN** production status is adapted for PA5 presentation
* **THEN** `queued` SHALL map to `pending`
* **AND** `running` SHALL map to `in-progress`
* **AND** `succeeded` SHALL map to `completed`
* **AND** `failed` SHALL map to `failed`
* **AND** `cancelled` SHALL map to `canceled`
* **AND** `requires_action` SHALL NOT be produced by the PA5 prototype
* **AND** translation SHALL occur only at the frontend API-adapter or view-model boundary
* **AND** the frontend presentation type SHALL be renamed in a later implementation phase

---

### Requirement: External Identity Ownership

The module SHALL consume existing workspace, user, agent, workflow, and task
identity kinds from `@vcp/shared` and SHALL NOT redefine or re-export them.

#### Scenario: Plan Work identity

* **GIVEN** Work identity is not yet present in the shared EntityId catalog
* **WHEN** the foundation is approved
* **THEN** `EntityId<"workId">` SHALL be treated as a proposed reviewed shared-contract extension
* **AND** PR F0 SHALL NOT implement that extension
* **AND** the approved production design SHALL NOT use an untyped raw-string fallback

---

### Requirement: Module Foundation Gate

Task 5A SHALL define architecture and contract tests and SHALL be completed
before Task 6 implementation begins.

#### Scenario: Gate Task 6

* **GIVEN** Task 5A is incomplete
* **WHEN** Task 6 is selected for implementation
* **THEN** implementation SHALL stop until ownership, tenancy, routing, persistence, API, shared contract, event, service, and testing decisions are complete

---

### Requirement: Task Identity

Every accepted task SHALL receive one unique Task ID and one unique Work ID.

Task IDs and Work IDs SHALL remain stable for the lifetime of the task.

#### Scenario: Generate identifiers for an accepted task

* **GIVEN** a valid task submission
* **WHEN** the task is created
* **THEN** the system SHALL generate a Task ID
* **AND** the system SHALL generate a Work ID
* **AND** both identifiers SHALL be associated with the same task

#### Scenario: Generate different identifiers for different tasks

* **GIVEN** one task has already been created
* **WHEN** the user creates another valid task
* **THEN** the second task SHALL receive a different Task ID
* **AND** the second task SHALL receive a different Work ID

#### Scenario: Preserve task identifiers during processing

* **GIVEN** a task has transitioned through one or more lifecycle states
* **WHEN** the task details are displayed
* **THEN** the original Task ID SHALL remain unchanged
* **AND** the original Work ID SHALL remain unchanged

---

### Requirement: External Service Independence

The PA5 prototype SHALL operate without external APIs, external databases, external AI services, or external orchestration services.

#### Scenario: Run prototype offline after dependencies are installed

* **GIVEN** project dependencies have already been installed
* **WHEN** the user runs the PA5 Task & Orchestration prototype without network access
* **THEN** task submission SHALL work
* **AND** routing simulation SHALL work
* **AND** processing simulation SHALL work
* **AND** streaming simulation SHALL work
* **AND** success, cancellation, and failure demos SHALL work

---

### Requirement: Responsibility Boundary & Architectural Ownership
Workspace Management or the responsible infrastructure module provides a resolvable execution-runtime reference. Task & Orchestration consumes that reference to submit and monitor work. The Task & Orchestration module SHALL own Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle, routing request representation, conversation/Task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, and frontend rendering/interaction. The Task & Orchestration module SHALL NOT own OpenClaw installation, container creation, start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS/networking, Gateway credential creation, platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base/RAG Management, custom orchestration engines, custom LLM routers, custom multi-agent collaboration engines, custom workflow runtimes, or OpenClaw internals.

#### Scenario: Verify architectural ownership boundaries
* **GIVEN** the Task & Orchestration module is initialized
* **WHEN** the system interacts with external dependencies or execution runtimes
* **THEN** it SHALL consume externally supplied runtime references provided by Workspace Management or infrastructure modules
* **AND** it SHALL NOT provision OpenClaw instances, manage containers, or administer external module domains

---

### Requirement: External Dependency Contracts & Prerequisites
A usable execution-runtime reference must be supplied by Workspace Management or the responsible infrastructure module before real execution can begin. The Task & Orchestration specifications SHALL define consumer-facing ports conceptually without claiming ownership of their implementations:
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

