# Design: Task & Orchestration PA5 Prototype

## 1. Context

The Task & Orchestration module represents the execution layer of the virtual company workspace.

The production architecture includes task ingestion, lifecycle control, routing, agent registry lookup, collaboration, shared context, aggregation, streaming, cancellation, and failure handling.

PA5 does not require the full production backend. The implementation therefore uses a frontend-first deterministic mock architecture while preserving the production responsibility boundaries.

The prototype must remain interactive and must demonstrate the complete lifecycle of a task.

## 2. Design Goals

The design must:

1. Follow the PA4 chatbot-style workspace.
2. Support all required lifecycle states.
3. Separate UI rendering from lifecycle and orchestration logic.
4. Provide deterministic and resettable demo behavior.
5. Avoid all external API dependencies.
6. Support cancellation without stale timer callbacks.
7. Make invalid task transitions impossible.
8. Prevent Failed and Canceled tasks from being rendered as Completed.
9. Keep task-scoped data isolated.
10. Support automated testing with fake timers or configurable delays.
11. Fit the implementation into focused pull requests of no more than 500 added code lines each.

## 3. Design Constraints

* The implementation must use the existing repository and workspace structure.
* Existing UI, styling, routing, and testing conventions must be reused.
* No new production dependency may be added unless necessary and approved.
* No real AI, database, agent, orchestration, or streaming service may be required.
* No internal implementation from another module may be imported.
* Shared public contracts must not be changed unless explicitly required.
* Task status must have one authoritative source.
* A terminal task must never resume processing.

## 4. High-Level Architecture

The PA5 mock implementation uses the following structure:

```text
Task Workspace UI
        |
        v
Task Store / Reducer
        |
        v
Mock Task Orchestration Service
        |
        +--> Task Factory and ID Generator
        +--> Routing Resolver
        +--> Lifecycle State Machine
        +--> Timeline and Log Generator
        +--> Streaming Simulator
        +--> Cancellation Controller
        +--> Failure Simulator
        |
        v
Deterministic Seed Data
```

The UI displays the current state but does not own orchestration timing or lifecycle rules.

The mock service simulates the responsibilities of the production TaskProcessor, Orchestrator, Collaboration Manager, Agent Registry, and Output Aggregator.

## 5. Responsibility Mapping

| Production Responsibility | PA5 Mock Responsibility                 |
| ------------------------- | --------------------------------------- |
| Task Ingestion Provider   | Prompt validation and task factory      |
| TaskProcessor             | State machine and lifecycle controller  |
| Orchestrator              | Deterministic routing resolver          |
| Agent Registry            | Local seed agent registry               |
| Workflow Registry         | Local seed workflow registry            |
| Collaboration Manager     | Simulated execution stages and logs     |
| SharedContext             | Task-scoped in-memory state             |
| Output Aggregator         | Partial-output and final-result builder |
| Streaming Transport       | Configurable local timer simulation     |

## 6. Proposed Module Structure

The exact paths must follow the existing repository conventions.

A logical module structure is:

```text
task-orchestration/
├── components/
│   ├── TaskWorkspaceLayout
│   ├── TaskComposer
│   ├── RoutingSelector
│   ├── TaskStatusBadge
│   ├── TaskTimeline
│   ├── TaskLogList
│   ├── StreamingResult
│   ├── CompletedResultView
│   ├── ProcessingDetailModal
│   ├── CancelConfirmationDialog
│   ├── CanceledTaskView
│   └── FailedTaskView
├── model/
│   ├── task-types
│   ├── task-state-machine
│   └── task-id
├── mocks/
│   ├── mock-agents
│   ├── mock-workflows
│   ├── mock-prompts
│   ├── mock-results
│   └── mock-timings
├── services/
│   └── mock-task-orchestration-service
├── state/
│   └── task-store-or-reducer
└── tests/
```

The implementation must not create this exact structure blindly. Codex must first inspect and follow the real repository layout and naming conventions.

## 7. Domain Model

### 7.1 Task Status

```ts
export type TaskStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "canceled";
```

`New` is a composer or page state before a Task object exists. It is not persisted as a Task status.

### 7.2 Routing Mode

```ts
export type RoutingMode =
  | "auto"
  | "specific-agent"
  | "predefined-workflow";
```

### 7.3 Task Identity

```ts
export interface TaskIdentity {
  taskId: string;
  workId: string;
}
```

Example:

```text
TASK-000001
WORK-000001
```

### 7.4 Processing Step Status

```ts
export type ProcessingStepStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "canceled";
```

### 7.5 Processing Step

```ts
export interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStepStatus;
  startedAt?: string;
  completedAt?: string;
}
```

### 7.6 Task Log

```ts
export type TaskLogLevel =
  | "info"
  | "success"
  | "warning"
  | "error";

export interface TaskLog {
  id: string;
  timestamp: string;
  level: TaskLogLevel;
  stepId: string;
  message: string;
}
```

### 7.7 Task Error

```ts
export interface TaskError {
  code: string;
  stepId: string;
  title: string;
  message: string;
  occurredAt: string;
}
```

### 7.8 Task

```ts
export interface Task {
  taskId: string;
  workId: string;
  prompt: string;

  status: TaskStatus;
  routingMode: RoutingMode;

  selectedAgentId?: string;
  selectedWorkflowId?: string;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  activeStepId?: string;
  canceledAtStepId?: string;

  timeline: ProcessingStep[];
  logs: TaskLog[];

  partialResult: string;
  finalResult?: string;
  error?: TaskError;
}
```

### 7.9 Agent Seed Model

```ts
export interface MockAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  available: boolean;
}
```

### 7.10 Workflow Seed Model

```ts
export interface MockWorkflow {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}
```

## 8. Seed Data

### 8.1 Agents

```text
AGT-CODE       Code Agent
AGT-REVIEW     Review Agent
AGT-RESEARCH   Research Agent
AGT-SYNTHESIS  Synthesis Agent
```

### 8.2 Workflows

```text
WFL-CODE-REVIEW
Code + Review
Agents: AGT-CODE, AGT-REVIEW
```

```text
WFL-RESEARCH-SYNTHESIS
Research + Synthesis
Agents: AGT-RESEARCH, AGT-SYNTHESIS
```

### 8.3 Demo Prompts

Success:

`Lập báo cáo tiến độ tuần dựa trên số liệu mẫu.`

Specific Agent:

`Viết một đoạn mô tả ngắn cho sản phẩm mới của công ty.`

Workflow:

`Nghiên cứu thông tin và tổng hợp thành báo cáo ngắn.`

Cancellation:

`Tạo một báo cáo dài cần nhiều bước xử lý.`

Failure:

`FAIL_SIMULATION: mô phỏng lỗi khi tổng hợp kết quả.`

## 9. ID Generation

The task factory generates both identifiers when a valid submission is accepted.

Recommended deterministic format:

```text
TASK-000001
WORK-000001
```

Rules:

* The counter increments only after successful validation.
* Invalid input must not consume an ID.
* Every accepted task receives a different ID pair.
* IDs must not be generated in a presentation component.
* The generator must support reset for stable demonstrations and tests.

A production-grade globally unique identifier is not required for the PA5 mock.

## 10. State Machine

### 10.1 Valid Transitions

```text
New -> Pending
Pending -> In-Progress
Pending -> Canceled
In-Progress -> Completed
In-Progress -> Failed
In-Progress -> Canceled
```

### 10.2 Terminal States

```text
Completed
Failed
Canceled
```

### 10.3 Invalid Transitions

The state machine must reject at least:

```text
Completed -> Canceled
Completed -> Failed
Completed -> In-Progress

Failed -> Completed
Failed -> Canceled
Failed -> In-Progress

Canceled -> Completed
Canceled -> Failed
Canceled -> In-Progress
```

### 10.4 State Machine API

A module-local helper is recommended:

```ts
export function isTerminalStatus(
  status: TaskStatus,
): boolean;

export function canTransition(
  current: TaskStatus,
  next: TaskStatus,
): boolean;
```

All status updates must pass through the authoritative lifecycle controller or reducer.

UI components must not directly assign a status.

## 11. Mock Orchestration Pipeline

The mock pipeline consists of:

```text
1. Validate input
2. Analyze request
3. Select agent / workflow
4. Execute task
5. Aggregate result
6. Finalize
```

Recommended step identifiers:

```text
validate-input
analyze-request
select-routing
execute-task
aggregate-result
finalize
```

For every stage, the service must:

1. Verify that the task is not terminal.
2. Mark the stage active.
3. Add a processing log.
4. Wait for the configured mock delay.
5. Verify the abort signal again.
6. Mark the stage completed, failed, or canceled.
7. Start the next stage only when allowed.

## 12. Mock Service Interface

A service boundary similar to the following is recommended:

```ts
export interface CreateTaskInput {
  prompt: string;
  routingMode: RoutingMode;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
}

export interface MockTaskOrchestrationService {
  createTask(input: CreateTaskInput): Task;
  startTask(taskId: string): void;
  cancelTask(taskId: string): void;
  reset(): void;
}
```

The exact interface may be adapted to the repository's state-management approach.

## 13. Routing Design

### 13.1 Auto-Routing

Auto-routing uses deterministic local rules.

Example rules:

* Prompts containing code-related terms may resolve to `AGT-CODE` or `WFL-CODE-REVIEW`.
* Prompts containing research or report-related terms may resolve to `WFL-RESEARCH-SYNTHESIS`.
* Other prompts may resolve to `AGT-SYNTHESIS`.

The resolved route must be written into task processing metadata and shown in the processing detail modal.

No real LLM intent analysis is performed.

### 13.2 Specific Agent

When `specific-agent` is selected:

* `selectedAgentId` is required.
* `selectedWorkflowId` must be absent.
* The selected agent must exist and be available.
* Auto-routing analysis is bypassed.

### 13.3 Predefined Workflow

When `predefined-workflow` is selected:

* `selectedWorkflowId` is required.
* `selectedAgentId` must be absent.
* The workflow must exist.
* Its configured agents are represented in logs and processing details.

### 13.4 Routing Selection Changes

When the user changes routing mode:

* Switching to Auto clears selected agent and workflow.
* Switching to Specific Agent clears selected workflow.
* Switching to Predefined Workflow clears selected agent.
* The latest valid selection before submission is authoritative.

## 14. Timing Design

All demo timing values must be centralized.

Example:

```ts
export const DEMO_TIMINGS = {
  pendingMs: 600,
  stepMs: 700,
  streamChunkMs: 150,
} as const;
```

No component should contain independent orchestration delays.

Tests must use:

* Fake timers, or
* A timing configuration override

Automated tests must not wait for the full real-time demo duration.

## 15. Pending Flow

After a valid task is created:

* Status becomes Pending.
* Task ID and Work ID are visible.
* Routing summary is visible.
* Partial result is empty.
* Completed result is absent.
* Cancellation is available.
* The initial timeline is visible.
* Processing begins only through the orchestration service.

## 16. In-Progress Flow

After the configured pending delay:

* Status becomes In-Progress.
* The current processing step becomes active.
* Completed steps remain visible.
* Future steps remain waiting.
* Logs are appended in order.
* Partial output may begin when execution or aggregation reaches the configured point.
* Cancellation remains available.

Only one processing step may be active at a time.

## 17. Streaming Design

The final deterministic result is split into stable chunks.

The streaming simulator appends one chunk at a time to `partialResult`.

Before appending every chunk, it must verify:

```ts
if (signal.aborted) {
  return;
}

if (isTerminalStatus(task.status)) {
  return;
}
```

Streaming must stop when:

* The task is Canceled.
* The task is Failed.
* The task is Completed.
* The demo is reset.
* The component or task scope is disposed.

A task must never receive a late chunk after reaching a terminal state.

## 18. Completion Design

A successful task completes only after all required processing stages succeed.

Completion performs:

1. Mark the final active step completed.
2. Build the stable final result.
3. Set `partialResult` to the authoritative completed content when appropriate.
4. Store `finalResult`.
5. Set `completedAt`.
6. Transition to Completed.
7. Clear active timers.
8. Prevent any further update.

The Completed view requires:

* `status === "completed"`
* A finalized result

It must never be rendered based only on non-empty partial text.

## 19. Cancellation Design

### 19.1 Eligible States

Cancellation is allowed only when the task is:

* Pending
* In-Progress

### 19.2 Confirmation

The confirmation dialog displays:

* Work ID
* Current status
* Current step
* A warning that processing will stop

The user can:

* Continue processing
* Confirm cancellation

### 19.3 Cancellation Execution

Confirming cancellation performs:

1. Abort the active task controller.
2. Clear active timers.
3. Stop chunk streaming.
4. Mark the active step Canceled when applicable.
5. Record `canceledAtStepId`.
6. Transition the task to Canceled.
7. Append one final cancellation log if the task is still active.
8. Prevent all later processing.

Completed, Failed, and Canceled tasks ignore cancellation requests and preserve their current status.

## 20. Failure Design

The deterministic failure trigger is:

```text
FAIL_SIMULATION:
```

The configured failure occurs during `aggregate-result`.

Failure performs:

1. Complete all previous successful steps.
2. Mark `aggregate-result` as Failed.
3. Leave later steps Waiting.
4. Store an error object.
5. Stop streaming.
6. Clear active timers.
7. Transition the task to Failed.
8. Prevent all later processing.
9. Suppress the Completed result view.

Recommended error:

```ts
{
  code: "MOCK_AGGREGATION_FAILED",
  stepId: "aggregate-result",
  title: "Không thể tổng hợp kết quả",
  message:
    "Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.",
  occurredAt: "<timestamp>",
}
```

## 21. Processing Detail Modal

The modal is a shared view that supports:

* In-Progress
* Completed
* Failed
* Canceled

It displays:

* Task ID
* Work ID
* Current or final status
* Prompt summary when appropriate
* Routing mode
* Selected agent
* Selected workflow
* Started time
* Completed time when applicable
* Processing duration
* Timeline
* Logs
* Failed step and error when applicable
* Canceled step when applicable

The modal must use the authoritative task data and must not hard-code a Completed status.

## 22. Empty and Loading States

### Empty State

Displayed when:

* No task has been submitted in the current demo session.

It contains:

* Workspace introduction
* Suggested prompts
* Composer
* Routing entry point

### Loading State

Displayed while:

* Local module data is being initialized, or
* A defined mock loading flag is active

Loading must not be confused with Pending.

`Loading` is a UI state.

`Pending` is a Task lifecycle state.

## 23. Reset Design

Reset must:

1. Abort every active task controller.
2. Clear every active timer.
3. Clear current task data.
4. Clear partial and final results.
5. Restore mock agent data.
6. Restore mock workflow data.
7. Reset ID counters when stable demo replay requires it.
8. Return the UI to the empty state.
9. Prevent callbacks from the previous run from updating the new session.

## 24. Session and Task Separation

A conversation or workspace session may contain multiple tasks.

Every task has its own:

* Task ID
* Work ID
* Status
* Timeline
* Logs
* Partial result
* Final result
* Error
* Active run controller

Task-scoped data must not leak to another task.

For the first PA5 implementation, the module may display only the current task while keeping its model task-scoped.

## 25. UI Design

The UI follows the PA4 prototype:

* Chatbot-style layout
* Sidebar area
* Main conversation area
* Fixed or persistent composer area
* Routing selector near the composer
* Clear status badge
* Inline processing timeline
* Separate final result
* Processing details available on demand
* Confirmation before cancellation
* Explicit Failed and Canceled presentation

Technical logs should not dominate the Completed result view.

The main result remains user-focused, while traceability remains accessible through the detail modal.

## 26. Accessibility

Interactive components must use the existing accessible component primitives where available.

Minimum expectations:

* Buttons have accessible labels.
* Status is represented by text, not color alone.
* Dialogs have titles.
* Keyboard focus is managed by the existing modal component.
* Disabled controls expose a disabled state.
* Error messages are associated with the related input.
* Loading indicators include accessible text.

## 27. Testing Design

### 27.1 Unit Tests

Recommended unit-test targets:

* Prompt validation
* ID generation
* `isTerminalStatus`
* `canTransition`
* Routing selection normalization
* Auto-routing rules
* Failure-trigger detection
* Timer cleanup
* Reset behavior

### 27.2 Component Tests

Recommended component-test targets:

* Empty state
* Loading state
* Composer validation
* Routing selector
* Pending rendering
* Status badge
* Timeline rendering
* Completed result
* Cancel dialog
* Failed details
* Processing detail modal

### 27.3 Lifecycle Tests

Lifecycle tests must verify:

* New to Pending
* Pending to In-Progress
* Pending to Canceled
* In-Progress to Completed
* In-Progress to Failed
* In-Progress to Canceled
* Rejection of invalid terminal transitions
* No streaming after Canceled
* No streaming after Failed
* No processing after Completed

### 27.4 Functional Test Documentation

At least 25 manual or automated functional cases must be documented and executed.

Automated tests do not replace the required test execution report.

## 28. Code Size and Pull Request Design

Each sub-issue is implemented in a separate focused pull request.

Before implementation, the agent must:

1. Identify affected files.
2. Estimate added code lines.
3. Stop and propose a split when the work may exceed 500 lines.

Before opening the pull request, the developer must calculate actual added code lines.

The implementation plan intentionally separates:

* Workspace layout
* Shared data and types
* Shared components
* Composer
* Routing
* Task creation
* Pending view
* Timeline and logs
* Streaming
* Completed result
* Details modal
* Cancellation
* Failure
* Tests
* Test report
* Demo documentation

## 29. Key Design Decisions

### Decision 1: Use a deterministic local mock service

Reason:

PA5 must be stable, repeatable, independent of external APIs, and demonstrable offline.

### Decision 2: Keep lifecycle control outside React presentation components

Reason:

This preserves the architectural distinction between lifecycle processing and UI rendering and prevents duplicated or invalid status updates.

### Decision 3: Store Task ID and Work ID

Reason:

The use-case documents refer to Task ID, while the PA4 user interface displays Work ID. Storing both avoids ambiguity.

### Decision 4: Treat New and Loading as UI states

Reason:

They exist before or outside a persisted task lifecycle and must not be mixed with task statuses.

### Decision 5: Use an explicit failure trigger

Reason:

`FAIL_SIMULATION:` provides stable, intentional, and testable failure behavior.

### Decision 6: Centralize timing and cancellation

Reason:

This prevents stale callbacks and makes tests fast with fake timers.

### Decision 7: Prefer module-local contracts

Reason:

The PA5 prototype should not create unnecessary cross-module contract changes.

## 30. Risks and Mitigations

### Timer leakage

Mitigation:

Track active timers, abort task runs, and check terminal state before every asynchronous update.

### State duplication

Mitigation:

Keep one authoritative task store or reducer.

### UI scope expansion

Mitigation:

Implement only the selected task in each pull request.

### Inconsistent routing metadata

Mitigation:

Normalize routing input before task creation and clear incompatible selections when routing mode changes.

### Tests become too large

Mitigation:

Use shared test builders, fake timers, and table-driven transition tests. Split the testing sub-issue if the 500-line limit is at risk.

### Existing project conventions differ from this proposal

Mitigation:

The coding agent performs repository discovery first and adapts names and paths without changing the behavioral design.

## 31. Verification

Every implementation pull request must run the relevant repository-supported equivalents of:

```text
npm test
npm run build
npm run prisma -- validate
openspec validate implement-task-orchestration --strict
openspec validate --all --strict
git diff --check
```

Prisma validation is required only when Prisma-related files are affected.

A command must not be reported as passing unless it was actually executed successfully.
