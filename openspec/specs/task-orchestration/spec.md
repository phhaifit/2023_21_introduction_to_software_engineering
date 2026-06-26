# task-orchestration Specification

## Purpose
TBD - created by archiving change implement-task-orchestration. Update Purpose after archive.
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

### Requirement: Authoritative Routing Contract

The create-task contract SHALL represent routing as a discriminated union and
the application layer SHALL enforce exactly one valid routing policy.

#### Scenario: Validate authoritative routing invariants

* **WHEN** Auto-routing is requested
* **THEN** agent ID and workflow ID SHALL both be absent
* **WHEN** Specific Agent routing is requested
* **THEN** exactly one same-workspace selectable agent ID SHALL be present
* **WHEN** Predefined Workflow routing is requested
* **THEN** exactly one same-workspace executable workflow ID SHALL be present
* **AND** incompatible target combinations SHALL be rejected before persistence

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

### Requirement: Task Workspace Initial States

The system SHALL provide a Task & Orchestration workspace that supports an empty state and a loading state before a task is active.

The loading state SHALL be treated as a user-interface state and SHALL NOT be stored as a task lifecycle status.

#### Scenario: Display empty task workspace

* **GIVEN** no task has been created in the current demo session
* **WHEN** the user opens the Task & Orchestration workspace
* **THEN** the system SHALL display the empty workspace state
* **AND** the system SHALL display the task composer
* **AND** the system SHALL display the routing entry point
* **AND** the system SHALL NOT display a Task ID or Work ID
* **AND** the system SHALL NOT display an active processing timeline

#### Scenario: Display module loading state

* **GIVEN** the local Task & Orchestration module data is being initialized
* **WHEN** the workspace is rendered
* **THEN** the system SHALL display a loading indication
* **AND** the system SHALL NOT display the loading indication as Pending
* **AND** the system SHALL NOT create a task

---

### Requirement: Task Submission Validation

The system SHALL allow a user to submit a natural-language task prompt.

The system SHALL reject a prompt that is empty or contains only whitespace.

A rejected submission SHALL NOT create a Task ID or Work ID.

#### Scenario: Submit a valid prompt

* **GIVEN** the task composer is available
* **AND** the user has entered a non-empty prompt
* **WHEN** the user submits the prompt
* **THEN** the system SHALL accept the submission
* **AND** the system SHALL create a new task
* **AND** the system SHALL assign a unique Task ID
* **AND** the system SHALL assign a unique Work ID
* **AND** the system SHALL set the initial task status to Pending

#### Scenario: Reject an empty prompt

* **GIVEN** the task composer is available
* **AND** the prompt is empty
* **WHEN** the user attempts to submit
* **THEN** the system SHALL reject the submission
* **AND** the system SHALL display a validation message
* **AND** the system SHALL NOT create a task
* **AND** the system SHALL NOT create a Task ID
* **AND** the system SHALL NOT create a Work ID

#### Scenario: Reject a whitespace-only prompt

* **GIVEN** the task composer is available
* **AND** the prompt contains only whitespace characters
* **WHEN** the user attempts to submit
* **THEN** the system SHALL reject the submission
* **AND** the system SHALL display a validation message
* **AND** the system SHALL NOT create a task identifier

#### Scenario: Clear validation after correction

* **GIVEN** a validation message is displayed for an invalid prompt
* **WHEN** the user enters a valid prompt
* **THEN** the system SHALL clear or update the validation message
* **AND** the user SHALL be able to submit the corrected prompt

---

### Requirement: Routing Mode Selection

The system SHALL support Auto-routing, Specific Agent, and Predefined Workflow routing modes.

Auto-routing SHALL be available without selecting a target.

Specific Agent routing SHALL require a valid agent selection.

Predefined Workflow routing SHALL require a valid workflow selection.

#### Scenario: Use Auto-routing

* **GIVEN** the user is composing a task
* **WHEN** the user selects Auto-routing and submits a valid prompt
* **THEN** the task SHALL store Auto-routing as its routing mode
* **AND** the task SHALL NOT require an explicit agent ID
* **AND** the task SHALL NOT require an explicit workflow ID

#### Scenario: Select a specific agent

* **GIVEN** the mock agent registry is available
* **WHEN** the user selects Specific Agent
* **AND** the user selects an available agent
* **AND** the user submits a valid prompt
* **THEN** the task SHALL store Specific Agent as its routing mode
* **AND** the task SHALL store the selected agent ID
* **AND** the selected agent SHALL override Auto-routing

#### Scenario: Select a predefined workflow

* **GIVEN** the mock workflow registry is available
* **WHEN** the user selects Predefined Workflow
* **AND** the user selects an available workflow
* **AND** the user submits a valid prompt
* **THEN** the task SHALL store Predefined Workflow as its routing mode
* **AND** the task SHALL store the selected workflow ID

#### Scenario: Change routing mode before submission

* **GIVEN** the user has selected a routing mode and target
* **WHEN** the user changes to another routing mode before submission
* **THEN** the latest routing mode SHALL replace the previous mode
* **AND** incompatible target values SHALL be cleared
* **AND** only the latest valid routing selection SHALL be attached to the task

#### Scenario: Prevent submission without required target

* **GIVEN** the user selected Specific Agent or Predefined Workflow
* **AND** no corresponding target was selected
* **WHEN** the user attempts to submit the task
* **THEN** the system SHALL reject the routing selection
* **AND** the system SHALL request a valid target
* **AND** the system SHALL NOT create the task

---

### Requirement: Mock Agent and Workflow Registry

The PA5 implementation SHALL provide deterministic local agent and workflow seed data.

The seed registry SHALL include the required agents and workflows.

#### Scenario: Load required mock agents

* **WHEN** the Task & Orchestration module initializes
* **THEN** the mock agent registry SHALL include `AGT-CODE`
* **AND** the mock agent registry SHALL include `AGT-REVIEW`
* **AND** the mock agent registry SHALL include `AGT-RESEARCH`
* **AND** the mock agent registry SHALL include `AGT-SYNTHESIS`

#### Scenario: Load required mock workflows

* **WHEN** the Task & Orchestration module initializes
* **THEN** the mock workflow registry SHALL include `WFL-CODE-REVIEW`
* **AND** the mock workflow registry SHALL include `WFL-RESEARCH-SYNTHESIS`

#### Scenario: Reset mock registries

* **GIVEN** the demo data has been used or modified in memory
* **WHEN** the user resets the demo
* **THEN** the system SHALL restore the original mock agents
* **AND** the system SHALL restore the original mock workflows

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

### Requirement: Task Lifecycle State Machine

The system SHALL maintain a consistent task lifecycle.

The only supported task statuses SHALL be Pending, In-Progress, Completed, Failed, and Canceled.

The only valid lifecycle transitions SHALL be:

* New to Pending
* Pending to In-Progress
* Pending to Canceled
* In-Progress to Completed
* In-Progress to Failed
* In-Progress to Canceled

Completed, Failed, and Canceled SHALL be terminal states.

#### Scenario: Create a Pending task

* **GIVEN** the user submits a valid task
* **WHEN** the system creates the task
* **THEN** the task status SHALL be Pending

#### Scenario: Start processing a Pending task

* **GIVEN** a task is Pending
* **WHEN** the mock processing service starts the task
* **THEN** the task status SHALL transition to In-Progress

#### Scenario: Complete an active task

* **GIVEN** a task is In-Progress
* **AND** all required processing stages succeed
* **WHEN** the system finalizes the result
* **THEN** the task status SHALL transition to Completed

#### Scenario: Fail an active task

* **GIVEN** a task is In-Progress
* **AND** a processing stage reports an error
* **WHEN** the lifecycle controller handles the error
* **THEN** the task status SHALL transition to Failed

#### Scenario: Cancel a Pending task

* **GIVEN** a task is Pending
* **WHEN** the user confirms cancellation
* **THEN** the task status SHALL transition to Canceled
* **AND** processing SHALL NOT start

#### Scenario: Cancel an In-Progress task

* **GIVEN** a task is In-Progress
* **WHEN** the user confirms cancellation
* **THEN** the task status SHALL transition to Canceled
* **AND** subsequent processing SHALL stop

#### Scenario: Reject an invalid transition from Completed

* **GIVEN** a task is Completed
* **WHEN** an operation attempts to change the task to Failed, Canceled, or In-Progress
* **THEN** the system SHALL reject the transition
* **AND** the task SHALL remain Completed

#### Scenario: Reject an invalid transition from Failed

* **GIVEN** a task is Failed
* **WHEN** an operation attempts to change the task to Completed, Canceled, or In-Progress
* **THEN** the system SHALL reject the transition
* **AND** the task SHALL remain Failed

#### Scenario: Reject an invalid transition from Canceled

* **GIVEN** a task is Canceled
* **WHEN** an operation attempts to change the task to Completed, Failed, or In-Progress
* **THEN** the system SHALL reject the transition
* **AND** the task SHALL remain Canceled

---

### Requirement: Pending Task Presentation

A newly accepted task SHALL display its Pending status, submitted prompt, Work ID, routing summary, and initial processing timeline.

A Pending task SHALL NOT display a completed result.

#### Scenario: Display a Pending task

* **GIVEN** a valid task has been created
* **AND** processing has not started
* **WHEN** the task is displayed
* **THEN** the system SHALL display the Pending status
* **AND** the system SHALL display the submitted prompt
* **AND** the system SHALL display the Work ID
* **AND** the system SHALL display the selected routing mode
* **AND** the system SHALL display the initial timeline
* **AND** the system SHALL NOT display a completed result

#### Scenario: Offer cancellation for Pending task

* **GIVEN** a task is Pending
* **WHEN** the task actions are displayed
* **THEN** the system SHALL provide a cancellation action

---

### Requirement: Processing Timeline and Logs

An In-Progress task SHALL display the mock orchestration stages, the current active stage, completed stages, waiting stages, and processing logs.

The mock orchestration stages SHALL represent:

1. Validate input
2. Analyze request
3. Select agent or workflow
4. Execute task
5. Aggregate result
6. Finalize

Only one processing stage SHALL be active at a time.

#### Scenario: Display In-Progress timeline

* **GIVEN** a task is In-Progress
* **WHEN** the processing view is displayed
* **THEN** the system SHALL display completed processing stages
* **AND** the system SHALL display the current active stage
* **AND** the system SHALL display future stages as waiting
* **AND** no more than one stage SHALL be active

#### Scenario: Append ordered processing logs

* **GIVEN** a task is In-Progress
* **WHEN** the mock orchestration service advances to another stage
* **THEN** the system SHALL append a log for the stage
* **AND** the logs SHALL preserve processing order
* **AND** every log SHALL be associated with the task

#### Scenario: Preserve completed timeline stages

* **GIVEN** one or more processing stages have completed
* **WHEN** a later stage becomes active
* **THEN** the completed stages SHALL remain marked Completed
* **AND** the active stage SHALL be visually distinct
* **AND** later stages SHALL remain Waiting

---

### Requirement: Simulated Partial Result Streaming

The system SHALL simulate partial result delivery while a task is In-Progress.

Partial output SHALL be generated from stable local mock content.

Partial output SHALL stop when the task reaches a terminal state.

#### Scenario: Display partial output during processing

* **GIVEN** a task is In-Progress
* **AND** the mock execution has reached the configured streaming stage
* **WHEN** result chunks become available
* **THEN** the system SHALL append the chunks to the partial result
* **AND** the system SHALL display a processing indication

#### Scenario: Do not stream for Pending task

* **GIVEN** a task is Pending
* **WHEN** the task view is displayed
* **THEN** the system SHALL NOT append result chunks

#### Scenario: Stop streaming after completion

* **GIVEN** a task has transitioned to Completed
* **WHEN** an old streaming callback attempts to append another chunk
* **THEN** the system SHALL ignore the callback
* **AND** the completed result SHALL remain unchanged

#### Scenario: Stop streaming after failure

* **GIVEN** a task has transitioned to Failed
* **WHEN** an old streaming callback attempts to append another chunk
* **THEN** the system SHALL ignore the callback
* **AND** the Failed status SHALL remain unchanged

#### Scenario: Stop streaming after cancellation

* **GIVEN** a task has transitioned to Canceled
* **WHEN** an old streaming callback attempts to append another chunk
* **THEN** the system SHALL ignore the callback
* **AND** the Canceled status SHALL remain unchanged

---

### Requirement: Completed Result

A task SHALL display a completed result only when its authoritative status is Completed and a finalized result is available.

A Completed task SHALL NOT continue processing.

#### Scenario: Display a completed result

* **GIVEN** a task has completed every required stage successfully
* **WHEN** the lifecycle controller transitions the task to Completed
* **THEN** the system SHALL display the Completed status
* **AND** the system SHALL display the final result
* **AND** the system SHALL stop all task processing
* **AND** the system SHALL stop partial-result streaming

#### Scenario: Do not display incomplete output as Completed

* **GIVEN** a task has partial output
* **AND** the task status is Pending, In-Progress, Failed, or Canceled
* **WHEN** the task result area is rendered
* **THEN** the system SHALL NOT display the Completed result view

#### Scenario: Prevent cancellation of Completed task

* **GIVEN** a task is Completed
* **WHEN** the task actions are displayed
* **THEN** the system SHALL NOT allow the task to be canceled

---

### Requirement: Processing Detail Modal

The system SHALL provide a processing detail modal for active and terminal tasks.

The modal SHALL display data from the authoritative task record.

#### Scenario: Open Completed task details

* **GIVEN** a task is Completed
* **WHEN** the user opens processing details
* **THEN** the modal SHALL display the Task ID
* **AND** the modal SHALL display the Work ID
* **AND** the modal SHALL display Completed
* **AND** the modal SHALL display the routing mode
* **AND** the modal SHALL display the completed timeline
* **AND** the modal SHALL display processing logs
* **AND** the modal SHALL display processing time when available

#### Scenario: Open In-Progress task details

* **GIVEN** a task is In-Progress
* **WHEN** the user opens processing details
* **THEN** the modal SHALL display In-Progress
* **AND** the modal SHALL display the active step
* **AND** the modal SHALL display current logs
* **AND** the modal SHALL NOT describe waiting steps as completed

#### Scenario: Open Canceled task details

* **GIVEN** a task is Canceled
* **WHEN** the user opens processing details
* **THEN** the modal SHALL display Canceled
* **AND** the modal SHALL identify the canceled step
* **AND** completed steps SHALL remain completed
* **AND** later steps SHALL NOT be displayed as completed

#### Scenario: Open Failed task details

* **GIVEN** a task is Failed
* **WHEN** the user opens processing details
* **THEN** the modal SHALL display Failed
* **AND** the modal SHALL display the failed step
* **AND** the modal SHALL display the error code and message
* **AND** later steps SHALL remain incomplete

---

### Requirement: Controlled Task Cancellation

The system SHALL require confirmation before canceling a Pending or In-Progress task.

A successful cancellation SHALL stop future processing and streaming.

#### Scenario: Open cancellation confirmation

* **GIVEN** a task is Pending or In-Progress
* **WHEN** the user selects Cancel
* **THEN** the system SHALL display a confirmation dialog
* **AND** the dialog SHALL display the Work ID
* **AND** the dialog SHALL display the current status
* **AND** the dialog SHALL display the current processing step when available
* **AND** the dialog SHALL warn that future processing will stop

#### Scenario: Continue processing from confirmation dialog

* **GIVEN** the cancellation confirmation dialog is open
* **WHEN** the user chooses to continue processing
* **THEN** the dialog SHALL close
* **AND** the task status SHALL remain unchanged
* **AND** processing SHALL continue

#### Scenario: Confirm cancellation of Pending task

* **GIVEN** a task is Pending
* **AND** the confirmation dialog is open
* **WHEN** the user confirms cancellation
* **THEN** the task SHALL transition to Canceled
* **AND** processing SHALL NOT begin
* **AND** no partial result SHALL be produced

#### Scenario: Confirm cancellation of In-Progress task

* **GIVEN** a task is In-Progress
* **AND** the confirmation dialog is open
* **WHEN** the user confirms cancellation
* **THEN** the task SHALL transition to Canceled
* **AND** active timers SHALL be stopped
* **AND** active streaming SHALL be stopped
* **AND** subsequent processing stages SHALL NOT start
* **AND** the current step SHALL be recorded as canceled

#### Scenario: Preserve existing terminal status

* **GIVEN** a task is Completed, Failed, or Canceled
* **WHEN** a cancellation request is attempted
* **THEN** the system SHALL keep the existing terminal status unchanged

---

### Requirement: Failed Task State

The system SHALL provide a deterministic failure simulation.

A prompt beginning with `FAIL_SIMULATION:` SHALL cause the configured mock processing stage to fail.

A failed task SHALL display explicit error details and SHALL NOT display a Completed result.

#### Scenario: Trigger deterministic failure

* **GIVEN** the user submits a prompt beginning with `FAIL_SIMULATION:`
* **WHEN** the task reaches the configured failure stage
* **THEN** the system SHALL mark that processing stage Failed
* **AND** the task SHALL transition from In-Progress to Failed
* **AND** the system SHALL stop processing
* **AND** the system SHALL stop result streaming

#### Scenario: Display Failed task summary

* **GIVEN** a task is Failed
* **WHEN** the task view is displayed
* **THEN** the system SHALL display the Failed status
* **AND** the system SHALL display a clear error summary
* **AND** the system SHALL provide access to error details
* **AND** the system SHALL NOT display the task as Completed

#### Scenario: Preserve error traceability

* **GIVEN** a task has failed
* **WHEN** processing details are opened
* **THEN** the system SHALL display the failed step
* **AND** the system SHALL display the error reason
* **AND** the system SHALL display logs up to the failure
* **AND** subsequent steps SHALL remain incomplete

#### Scenario: Prevent Failed task from completing later

* **GIVEN** a task is Failed
* **WHEN** an old processing callback attempts to complete the task
* **THEN** the system SHALL ignore the callback
* **AND** the task SHALL remain Failed
* **AND** no Completed result SHALL be created

---

### Requirement: Terminal State Processing Guard

Completed, Failed, and Canceled SHALL be terminal states.

After entering a terminal state, a task SHALL NOT accept processing updates.

#### Scenario: Ignore logs after terminal state

* **GIVEN** a task is Completed, Failed, or Canceled
* **WHEN** an old callback attempts to append a processing log
* **THEN** the system SHALL ignore the update

#### Scenario: Ignore timeline updates after terminal state

* **GIVEN** a task is Completed, Failed, or Canceled
* **WHEN** an old callback attempts to activate or complete another step
* **THEN** the system SHALL ignore the update

#### Scenario: Ignore partial output after terminal state

* **GIVEN** a task is Completed, Failed, or Canceled
* **WHEN** an old callback attempts to append partial output
* **THEN** the system SHALL ignore the update

#### Scenario: Preserve exactly one final status

* **GIVEN** a task has reached a terminal state
* **WHEN** any later completion, failure, or cancellation callback runs
* **THEN** the system SHALL preserve the first terminal state
* **AND** the task SHALL NOT transition to another terminal state

---

### Requirement: Deterministic Demo Reset

The system SHALL provide a deterministic reset mechanism for the PA5 demonstration.

Reset SHALL remove active task execution and restore the initial demo state.

#### Scenario: Reset an active demo

* **GIVEN** a task is Pending or In-Progress
* **WHEN** the demo is reset
* **THEN** the system SHALL abort active processing
* **AND** the system SHALL clear active timers
* **AND** the system SHALL clear partial output
* **AND** the system SHALL return to the empty state

#### Scenario: Reset a terminal demo

* **GIVEN** a task is Completed, Failed, or Canceled
* **WHEN** the demo is reset
* **THEN** the system SHALL clear the current task
* **AND** the system SHALL clear final or error data
* **AND** the system SHALL restore the initial mock registry data

#### Scenario: Prevent callbacks from previous demo run

* **GIVEN** the demo has been reset
* **WHEN** a callback from the previous run executes
* **THEN** the system SHALL ignore the callback
* **AND** the new demo state SHALL remain unchanged

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

### Requirement: Pull Request Code Size

The module SHALL apply the following code-size review guideline. Implementation and automated test code SHOULD generally remain within 500 added lines per reviewable pull request or sub-issue. Larger changes SHOULD be decomposed into multiple focused review units. Exceeding this guideline is not, by itself, a functional acceptance failure when the scope is justified, the work is reviewable, and all required verification passes.

Code-line accounting SHALL include implementation and automated test code.

A sub-issue that may exceed the recommendation SHOULD be decomposed into multiple focused review units.

The guideline MUST NOT be interpreted as a requirement to remove useful tests or reduce coverage merely to satisfy a line count.

#### Scenario: Implementation follows the review guideline

* **GIVEN** a sub-issue implementation is ready for review
* **WHEN** added code lines are counted
* **THEN** the count SHOULD generally remain within 500 lines per reviewable pull request or sub-issue
* **OR** the work SHOULD be decomposed into multiple focused review units

#### Scenario: Planned work may exceed the recommendation

* **GIVEN** the developer or coding agent estimates that a sub-issue may exceed the 500-line recommendation
* **WHEN** implementation planning is reviewed
* **THEN** the sub-issue SHOULD be decomposed into multiple focused review units before or during coding
* **AND** unrelated major concerns MUST NOT be combined in the same pull request

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
* **THEN** `enhance-task-orchestration-production-ui` SHALL operate as independent presentation alignment
* **AND** subsequent changes SHALL respect the defined contract and runtime prerequisite hierarchy

---

### Requirement: Production UI Visual System
The Task & Orchestration workspace SHALL utilize a centralized, premium visual design system consisting of semantic color tokens, typography scales, standardized spacing, and elevation layers, while strictly avoiding proprietary branding or assets from other commercial products.

#### Scenario: Apply centralized visual tokens
* **GIVEN** the Task & Orchestration workspace is active
* **WHEN** the workspace components are rendered
* **THEN** all components SHALL consume centralized CSS tokens for typography, spacing, color, and elevation
* **AND** the visual system SHALL support distinct semantic presentations for Pending, In-Progress, Completed, Failed, and Canceled statuses
* **AND** the design SHALL NOT include proprietary logos, branding, or color schemes of third-party products

---

### Requirement: Workspace Shell Information Architecture
The workspace shell SHALL establish a clear information architecture separating the sidebar navigation, workspace header, main execution feed, and pinned composer area.

#### Scenario: Render structured workspace shell
* **GIVEN** the user navigates to the Task & Orchestration workspace
* **WHEN** the workspace shell initializes
* **THEN** the system SHALL render distinct container boundaries for the sidebar, header, execution feed, and composer
* **AND** the layout SHALL maintain stable container slots during task lifecycle transitions

---

### Requirement: Provider-independent Task presentation
The Task & Orchestration workspace SHALL render canonical Task state without requiring knowledge of the execution provider. The UI submits Task requests through the platform Task boundary, does not connect directly to OpenClaw, does not receive or store OpenClaw credentials, does not create or manage OpenClaw instances, does not infer production completion or failure, and does not silently fall back from production execution to mock execution.

#### Scenario: Render normalized runtime state
* **GIVEN** a normalized update is applied to a canonical Task record
* **WHEN** the workspace renders that Task
* **THEN** it displays the corresponding lifecycle state and output
* **AND** the rendering does not depend on whether execution originated from mock execution or an external execution provider.

---

### Requirement: Conversation-based Task workspace
The workspace SHALL organize related Task records into conversation sessions without duplicating the canonical Task records. The state structure SHALL enforce:
```text
TaskCreationState
├── tasks
├── conversations
├── activeConversationId
├── activeTaskId
└── presentation state
```
Frontend-owned state includes composer draft, selector state, modal state, search query, filter state, submitting, loading, and reconnecting. Canonical Task state includes status, timeline, partial output, final result, error, cancellation, and timestamps.

#### Scenario: Render multiple Tasks in one conversation
* **GIVEN** a conversation contains multiple ordered Task IDs
* **WHEN** the user selects that conversation
* **THEN** the execution feed renders the corresponding Task turns in order
* **AND** every turn reads data from the canonical Task record.

---

### Requirement: Conversation selection is presentation-only
Selecting a conversation SHALL affect presentation only and SHALL NOT modify Task execution. Background Task execution is preserved by immutable Task ID.

#### Scenario: Switch away from a running Task
* **GIVEN** Task A is In-Progress in Conversation A
* **WHEN** the user selects Conversation B
* **THEN** Task A remains eligible to receive runtime updates
* **AND** Task A is not stopped, restarted, canceled, reset, or duplicated.

---

### Requirement: New Chat preserves existing execution
Creating a new conversation SHALL preserve existing conversations, Tasks, and background execution.

#### Scenario: Create an empty conversation while another Task runs
* **GIVEN** Task A is In-Progress in an existing conversation
* **WHEN** the user creates a new chat
* **THEN** a new empty conversation becomes active
* **AND** Task A continues processing under its immutable Task ID
* **AND** the new conversation does not display Task A as its own content.

---

### Requirement: Provider-neutral Task submission
The composer SHALL submit Task requests through the platform Task boundary without directly invoking an execution provider.

#### Scenario: Submit Auto-routing
* **GIVEN** Auto-routing is selected and the prompt is valid
* **WHEN** the user submits the request
* **THEN** the composer sends an Auto routing selection through the Task client
* **AND** the frontend does not choose an agent itself.

#### Scenario: Submit explicit agent
* **GIVEN** Specific Agent mode is selected
* **WHEN** the user selects a valid agent and submits the request
* **THEN** the request contains the selected platform agent ID
* **AND** the frontend does not contain provider credentials or provider transport payloads.

---

### Requirement: UI state is distinct from Task lifecycle
The workspace SHALL distinguish temporary UI state from canonical Task lifecycle state.

#### Scenario: Submission is in progress
* **GIVEN** the user has submitted a valid request
* **WHEN** the client is waiting for canonical Task creation
* **THEN** the composer may display a submitting state
* **AND** the workspace does not represent that temporary UI state as Pending unless a canonical Task exists.

#### Scenario: Runtime updates are temporarily unavailable
* **GIVEN** a Task is In-Progress
* **WHEN** its runtime-update connection is temporarily unavailable
* **THEN** the workspace may display a reconnecting indicator
* **AND** the Task remains In-Progress
* **AND** the Task is not shown as Failed without a canonical failure.

---

### Requirement: Partial and finalized output separation
The workspace SHALL distinguish partial output from finalized Task results.

#### Scenario: Render partial output
* **GIVEN** a Task is In-Progress and contains partial output
* **WHEN** the execution feed renders that Task
* **THEN** the output is presented as incomplete processing output
* **AND** it is not presented as a Completed result.

#### Scenario: Render finalized output
* **GIVEN** a Task has reached Completed with a finalized result
* **WHEN** the execution feed renders that Task
* **THEN** the finalized result is displayed as the completed response.

---

### Requirement: Terminal-state protection
A terminal Task SHALL NOT return to an active lifecycle state because of delayed or stale updates.

#### Scenario: Delayed event after completion
* **GIVEN** a Task is Completed, Failed, or Canceled
* **WHEN** a delayed non-terminal update is received
* **THEN** the terminal status remains unchanged
* **AND** the delayed update does not replace the final terminal presentation.

---

### Requirement: Task-scoped processing details
Processing details SHALL be scoped to the selected Task and SHALL not expose sensitive execution data by default.

#### Scenario: Open processing details
* **GIVEN** the selected conversation contains multiple Tasks
* **WHEN** the user opens processing details for Task B
* **THEN** the dialog displays the steps, logs, output metadata, and error information belonging to Task B
* **AND** it does not display Task A data.

#### Scenario: Optional execution details are unavailable
* **GIVEN** a Task has canonical lifecycle information but no optional provider activity details
* **WHEN** the user opens processing details
* **THEN** the dialog displays the information that is available
* **AND** the absence of optional details is not treated as Task failure.

---

### Requirement: Conversation-oriented search and filtering
The history sidebar SHALL search and filter conversation sessions without changing Task execution.

#### Scenario: Filter by latest Task status
* **GIVEN** a conversation has one or more Tasks
* **WHEN** a status filter is applied
* **THEN** the conversation matches only when its latest Task has the selected canonical status.

#### Scenario: Search by Task identity
* **GIVEN** a conversation contains a Task with a matching Task ID or Work ID
* **WHEN** the user searches for that identity
* **THEN** the conversation appears in the matching results
* **AND** no Task lifecycle state is changed.

---

### Requirement: Mock execution transparency
Mock execution is retained as a legitimate Task & Orchestration test and development adapter. When mock execution is exposed in an environment where users need to distinguish it from production execution, the workspace SHALL provide an accessible simulation indication.

#### Scenario: Mock execution is active
* **GIVEN** the application is configured to use mock execution
* **WHEN** the workspace exposes execution-environment information
* **THEN** it identifies the execution as simulated
* **AND** it does not imply that OpenClaw or another production provider executed the Task.

---

### Requirement: Comprehensive Accessibility Polish
All interactive components within the Task & Orchestration workspace SHALL adhere to modern accessibility standards including keyboard navigation, focus trapping in modals, and explicit ARIA attributes.

#### Scenario: Trap focus within open modal inspector
* **GIVEN** the processing detail modal is open
* **WHEN** the user navigates via keyboard (`Tab` / `Shift+Tab`)
* **THEN** keyboard focus SHALL remain trapped within the modal dialog
* **AND** closing the modal SHALL restore focus to the triggering element

#### Scenario: Announce streaming updates via ARIA live regions
* **GIVEN** a task is In-Progress and streaming simulated partial results
* **WHEN** result chunks are appended
* **THEN** the updates SHALL be contained within an appropriate `aria-live` region for screen reader awareness

