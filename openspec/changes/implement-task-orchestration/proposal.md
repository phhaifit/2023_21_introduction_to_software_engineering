# Change Proposal: Implement Task & Orchestration PA5 Prototype

## Summary

Implement an interactive Task & Orchestration prototype for PA5.

The implementation must demonstrate the complete user-facing task lifecycle from task submission through routing, processing, result delivery, cancellation, or failure.

The prototype may use deterministic mock data and a simulated orchestration service when the real backend, database, AI services, agent registry, streaming infrastructure, or orchestration engine are not yet available.

This change extends the existing Task & Orchestration planning artifacts into an implementation-ready PA5 scope.

## Motivation

The existing OpenSpec change describes the module at a planning level but does not yet define enough implementation detail for a stable, demonstrable, and testable PA5 prototype.

The PA5 implementation must provide working interactions rather than static screens. Users must be able to submit tasks, select a routing strategy, observe lifecycle changes, inspect processing details, cancel active work, and view explicit failure information.

The implementation must also be suitable for classroom demonstration and functional testing without depending on external services.

## Goals

This change has the following goals:

1. Implement an interactive chatbot-style task workspace aligned with the PA4 prototype.
2. Support task submission using a valid natural-language prompt.
3. Support the following routing modes:

   * Auto-routing
   * Specific agent
   * Predefined workflow
4. Generate a unique Task ID and Work ID for every accepted task.
5. Display consistent task lifecycle states:

   * Pending
   * In-Progress
   * Completed
   * Failed
   * Canceled
6. Simulate the orchestration pipeline using deterministic local data.
7. Display processing steps, timeline events, and execution logs.
8. Display simulated partial or streamed task output.
9. Display a final result only when processing succeeds.
10. Support controlled cancellation for Pending and In-Progress tasks.
11. Display explicit error information when processing fails.
12. Prevent terminal tasks from continuing processing.
13. Provide empty, loading, active, completed, canceled, and failed UI states.
14. Prepare and execute at least 25 functional test cases.
15. Produce a test execution report and defect report when failures are found.
16. Prepare stable demonstration scenarios.
17. Keep every implementation sub-issue and pull request within the 500-added-code-line limit.

## In Scope

### User Interface

The PA5 implementation includes:

* Task workspace layout
* Recent-session or task-history sidebar area
* New task composer
* Prompt validation
* Routing mode selector
* Agent selector
* Workflow selector
* Pending task state
* In-Progress task state
* Processing timeline
* Processing logs
* Simulated streaming result
* Completed result view
* Processing detail modal
* Cancel confirmation dialog
* Canceled state
* Failed state
* Error detail view
* Empty state
* Loading state
* Demo reset control or equivalent reset mechanism

### Routing Modes

The implementation supports:

* Auto-routing
* Specific agent
* Predefined workflow

Auto-routing uses deterministic mock selection rules.

Specific-agent routing uses a selected agent from the local mock agent registry.

Predefined-workflow routing uses a selected workflow from the local mock workflow registry.

### Task Identity

Every successfully submitted task receives:

* A unique internal Task ID
* A unique user-visible Work ID

Example formats:

* `TASK-000001`
* `WORK-000001`

Invalid submissions must not create either identifier.

### Task Lifecycle

The implementation supports these valid transitions:

* New to Pending
* Pending to In-Progress
* Pending to Canceled
* In-Progress to Completed
* In-Progress to Failed
* In-Progress to Canceled

The following are terminal states:

* Completed
* Failed
* Canceled

A task in a terminal state must not continue processing or change to another state.

### Mock Orchestration Pipeline

The local orchestration simulation must represent these stages:

1. Validate input
2. Analyze request
3. Select agent or workflow
4. Execute task
5. Aggregate result
6. Complete, Fail, or Cancel

The simulation must expose progress through timeline steps and logs.

### Success Flow

A successful task must:

1. Enter Pending after submission.
2. Transition to In-Progress.
3. Display timeline and logs.
4. Display simulated partial output.
5. Transition to Completed.
6. Display a stable final result.
7. Stop all further processing.
8. Allow the user to open processing details.

### Cancellation Flow

A task may be canceled while Pending or In-Progress.

Cancellation must:

1. Require confirmation.
2. Stop active timers or simulated execution.
3. Stop partial-result streaming.
4. Prevent later orchestration stages from starting.
5. Change the task status to Canceled.
6. Record the step at which processing stopped.
7. Preserve safe timeline and log information.
8. Prevent the task from later becoming Completed or Failed.

### Failure Flow

The deterministic failure trigger is:

`FAIL_SIMULATION:`

A prompt beginning with this trigger must fail during the configured processing stage.

A failed task must:

1. Transition from In-Progress to Failed.
2. Stop execution and streaming.
3. Store an error code, failed step, message, and timestamp.
4. Display a Failed state.
5. Display error details in the processing detail view.
6. Never display the incomplete output as a completed result.
7. Never later transition to Completed.

### Functional Testing

At least 25 functional test cases must be prepared and executed.

The required feature groups are:

* Task Submission and Validation: at least 5 cases
* Routing Selection: at least 5 cases
* Task Lifecycle State: at least 5 cases
* Cancellation and Failure Handling: at least 5 cases
* Result Display and Processing Details: at least 5 cases

Every test case must contain:

* Test Case ID
* Feature
* Preconditions when applicable
* Test steps
* Expected result
* Actual result
* Result: Pass, Fail, or Blocked
* Defect ID when the case fails

### Test Execution Report

The test execution report must include:

* Total test cases
* Passed test cases
* Failed test cases
* Blocked test cases
* Pass rate
* Failed test case IDs
* Related defect IDs
* Test environment
* Tested branch or commit
* Execution date
* Short test summary

### Defect Reporting

When a functional test fails, a defect must be recorded with:

* Defect ID
* Related test case
* Title
* Severity
* Steps to reproduce
* Expected result
* Actual result
* Status
* Retest result when applicable

When no defects are found, the report must explicitly state that no defects were recorded during the execution cycle.

### Demo Scenarios

The final demo must include:

1. Submit a valid prompt using Auto-routing.
2. Display the generated Work ID.
3. Display Pending.
4. Display In-Progress timeline and logs.
5. Display simulated partial output.
6. Display Completed and the final result.
7. Open the processing detail modal.
8. Submit another task and cancel it while active.
9. Display Canceled and prove that streaming has stopped.
10. Submit a failure-simulation task.
11. Display Failed and the related error details.
12. Demonstrate Specific Agent routing.
13. Demonstrate Predefined Workflow routing.
14. Reset the demo and repeat without stale timers or data.

## Demo Seed Data

### Mock Agents

* `AGT-CODE`: Code Agent
* `AGT-REVIEW`: Review Agent
* `AGT-RESEARCH`: Research Agent
* `AGT-SYNTHESIS`: Synthesis Agent

### Mock Workflows

* `WFL-CODE-REVIEW`: Code + Review
* `WFL-RESEARCH-SYNTHESIS`: Research + Synthesis

### Demo Prompts

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

## Out of Scope

The following are outside the mandatory PA5 scope:

* Real external AI API integration
* Real LLM intent analysis
* Real multi-agent execution
* Real agent microservices
* Real backend orchestration engine
* Real database persistence
* Real Redis shared context
* Real WebSocket or Server-Sent Events streaming
* Real file upload processing
* PDF, DOCX, CSV, or TXT content extraction
* Authentication and authorization implementation
* Payment or subscription behavior
* Workspace administration
* Production retry policies
* Production timeout infrastructure
* Distributed task queues
* Cross-device persistence
* Production observability
* Production deployment configuration

The UI may retain a non-functional or disabled attachment entry point to remain visually aligned with the PA4 prototype, but real file processing is not required by this PA5 change.

## Architecture and Boundary Constraints

The implementation must follow the existing repository structure and module boundaries.

The module may use:

* `@vcp/shared`
* `@vcp/database` from backend or worker code only
* Existing backend shared utilities
* Files inside the Task & Orchestration module

The module must not import another module's internal service, repository, state store, or UI implementation.

Cross-module interaction must use an API, DTO, shared contract, or domain event.

Changes to public shared contracts require:

1. A documented reason.
2. An affected-spec or design update.
3. Contract tests.
4. Review from at least one other module owner.

For the PA5 prototype, module-local types and mock data should be preferred unless a shared contract is already available and appropriate.

Before Task 6 begins, the change must complete a Module Foundation phase that:

* Defines the Task and TaskWork ownership boundary.
* Defines workspace and submitter identity as authenticated request-context data.
* Defines authoritative routing invariants for Auto, Specific Agent, and Predefined Workflow.
* Defines the future Prisma ownership and scalar cross-module references.
* Defines the public create-task transport and internal authenticated command.
* Separates shared public contracts from private domain and persistence types.
* Catalogs proposed versioned task domain events while documenting the current unversioned shared envelope.
* Defines repository, service, and cross-module lookup ports.
* Defines contract and architecture tests that gate later implementation.

The foundation is a design prerequisite only. It must not introduce Prisma models, API handlers, repositories, services, workers, or emitted domain events.

## Code Size Constraint

Every implementation sub-issue and pull request must add no more than 500 lines of code.

Code-line accounting includes implementation and automated test code in relevant source extensions.

Documentation, generated files, lock files, and build outputs do not count as implementation code, but all changes must still be reviewed.

If a planned sub-issue may exceed 500 added code lines, it must be split before implementation.

Large concerns must not be combined in the same pull request.

Examples of concerns that must remain separate:

* Base UI layout
* Shared types and seed data
* Shared status components
* Task creation logic
* Mock orchestration logic
* Streaming logic
* Cancellation logic
* Failure logic
* Functional tests
* Test reports
* Demo documentation

## Acceptance Criteria

This change is complete when all of the following are true:

* A user can submit a valid task prompt.
* Auto-routing can be selected.
* A specific agent can be selected.
* A predefined workflow can be selected.
* The Module Foundation task is complete before Task 6 begins.
* Every accepted task receives a unique Task ID and Work ID.
* A submitted task initially displays Pending.
* A Pending task can transition to In-Progress.
* An In-Progress task displays timeline and logs.
* An In-Progress task displays simulated partial output.
* A successful task transitions to Completed.
* A Completed task displays the final result.
* Processing details can be opened.
* A Pending task can be canceled.
* An In-Progress task can be canceled.
* A canceled task stops processing and streaming.
* A failed task displays Failed and its error details.
* A failed task is not displayed as Completed.
* Terminal tasks do not continue processing.
* Empty and loading states are available.
* Demo data can be reset reliably.
* At least 25 functional test cases exist.
* All test cases have been executed.
* Test execution results are recorded.
* Failed tests have linked defects.
* Demo scenarios run reliably.
* No implementation pull request exceeds 500 added code lines.
* Relevant automated tests pass.
* The project build passes.
* The OpenSpec change validates successfully.
* Full strict OpenSpec validation passes.

## Dependencies

This implementation depends on:

* The existing frontend workspace
* Existing project routing conventions
* Existing UI component conventions
* Existing workspace scripts for test and build
* Existing OpenSpec foundation specifications
* The PA4 Task & Orchestration UI prototype
* The Task & Orchestration Module Foundation architecture decisions

It does not depend on external APIs or external services.

## Risks

### Risk: Scope expansion

The PA4 documents include optional attachments, download actions, retry actions, and production architecture elements that may expand the PA5 implementation.

Mitigation:

Only implement items explicitly included in this proposal and specification. Treat attachment parsing, production retry behavior, and real backend infrastructure as out of scope.

### Risk: Timer callbacks continue after cancellation

Mitigation:

Track all active timers or use an abort signal. Every asynchronous update must verify that the task remains active and non-terminal.

### Risk: UI contains inconsistent task status

Mitigation:

Define task status in one shared module-local type and derive all badges, actions, timelines, and result views from the authoritative task state.

### Risk: Failed output appears as successful output

Mitigation:

Completed result rendering must require the authoritative `Completed` status and a finalized result. Partial or failed output must never be passed to the completed-result view.

### Risk: Pull requests exceed the code-size limit

Mitigation:

Estimate affected files before coding, check added code lines before opening each pull request, and split sub-issues when the limit is at risk.

## Completion and Archival

The change must not be archived until:

* All 17 tasks are complete.
* Relevant tests pass.
* Functional testing has been executed.
* Test reports are complete.
* Defects are resolved or formally documented.
* Demo scenarios have been verified.
* The implementation matches the change specification.
* OpenSpec strict validation passes.
