# Task & Orchestration PA5 Implementation Tasks

## General Execution Rules

* OpenSpec is the source of truth.
* Each numbered checkbox below represents one implementation sub-issue.
* Implement only one selected sub-issue at a time.
* Every sub-issue should normally use a dedicated branch and pull request.
* Implementation and automated test code should generally remain within 500 added lines per reviewable pull request or sub-issue. Larger changes should be decomposed into multiple focused review units. Exceeding this guideline is not, by itself, a functional acceptance failure when the scope is justified, the work is reviewable, and all required verification passes.
* Do not mark a task complete until implementation and verification are complete.
* Do not implement later tasks unless they are explicitly selected.
* Do not introduce external API dependencies.
* Do not modify shared public contracts unless the selected task explicitly requires it.
* Run relevant tests, build, and OpenSpec validation before marking a task complete.

## Core Setup

* [X] 1. [PA5] Task & Orchestration – Base Workspace Layout

  Scope:

  * Locate the actual frontend workspace and follow its routing and component conventions.
  * Add the Task & Orchestration page or route shell.
  * Implement the chatbot-style workspace layout.
  * Include the sidebar area, workspace header, conversation area, and composer placement.
  * Implement the empty state.
  * Implement the module loading state.
  * Reuse existing layout, typography, spacing, icon, button, and responsive conventions.
  * Keep this task free of task creation, routing, lifecycle, streaming, cancellation, and failure logic.

  Acceptance:

  * The workspace route opens without errors.
  * Empty and loading states are visually distinct.
  * Loading is not represented as a task status.
  * The layout provides stable slots for later task states.
  * The implementation follows the PA4 workspace appearance.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Run relevant frontend tests.
  * Run the workspace build.
  * Run both OpenSpec validation commands.
  * Run `git diff --check`.

  Suggested branch:

  `feat/task-orchestration-workspace-layout`

  Suggested commit:

  `feat(task-orchestration): add base workspace layout`

* [X] 2. [PA5] Task & Orchestration – Mock Data and Shared Types

  Scope:

  * Add module-local Task, TaskStatus, RoutingMode, ProcessingStep, TaskLog, TaskError, MockAgent, and MockWorkflow types.
  * Add deterministic Task ID and Work ID generation.
  * Add the four required mock agents.
  * Add the two required mock workflows.
  * Add demo prompts, mock result content, and centralized timing configuration.
  * Add a deterministic reset for counters and seed data.
  * Do not implement UI state transitions or orchestration timing in this task.

  Acceptance:

  * No duplicate status or routing string definitions exist in the module.
  * Invalid task input does not consume an ID.
  * Different tasks receive different Task IDs and Work IDs.
  * Required agents and workflows are present.
  * Seed data can be restored deterministically.
  * Types do not use unbounded `any`.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add or update focused type, seed, and ID-generator tests.
  * Run relevant tests.
  * Run build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-mock-model`

  Suggested commit:

  `feat(task-orchestration): add mock data and domain types`

* [X] 3. [PA5] Task & Orchestration – Shared Status and Timeline Components

  Scope:

  * Implement a reusable task-status badge.
  * Implement reusable processing-step and timeline components.
  * Implement a reusable task-log list.
  * Support Pending, In-Progress, Completed, Failed, and Canceled.
  * Support waiting, active, completed, failed, and canceled timeline steps.
  * Keep components presentation-only.
  * Do not add orchestration timers or state mutation inside these components.

  Acceptance:

  * All five task statuses have clear text labels.
  * Statuses are not distinguished by color alone.
  * Failed is visually and semantically different from Completed.
  * Canceled is visually and semantically different from Failed.
  * Only data passed through props is rendered.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add focused rendering tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-shared-status`

  Suggested commit:

  `feat(task-orchestration): add status and timeline components`

## Task Creation Flow

* [X] 4. [PA5] Task & Orchestration – Task Composer

  Scope:

  * Implement the prompt input.
  * Implement valid, empty, and whitespace-only validation.
  * Implement submit interaction.
  * Add suggested prompts from deterministic demo data.
  * Retain an attachment entry point that is disabled or explicitly marked as unsupported when real upload is not implemented.
  * Keep task creation and orchestration logic outside the composer.

  Acceptance:

  * Valid text can be submitted through the composer callback.
  * Empty and whitespace-only text is rejected.
  * Validation feedback is visible and associated with the input.
  * Validation clears after correction.
  * The composer resets after a successful accepted submission.
  * Attachment controls do not falsely imply successful upload processing.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add composer interaction tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-composer`

  Suggested commit:

  `feat(task-orchestration): add task composer`

* [ ] 5. [PA5] Task & Orchestration – Routing Selector

  Scope:

  * Implement Auto-routing.
  * Implement Specific Agent selection.
  * Implement Predefined Workflow selection.
  * Populate the selector from the mock registries.
  * Clear incompatible selections when routing mode changes.
  * Validate required target selection.
  * Keep task creation outside the selector.

  Acceptance:

  * Auto-routing is available without a target.
  * Specific Agent requires an available agent.
  * Predefined Workflow requires a workflow.
  * Changing mode removes stale target values.
  * The latest valid selection is emitted.
  * Required seed agents and workflows are displayed.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add routing-selector tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-routing-selector`

  Suggested commit:

  `feat(task-orchestration): add routing selector`

* [x] 5A. [PA5] Task & Orchestration – Module Foundation

  Scope:

  * Document the Task and TaskWork ownership boundary and referenced entities.
  * Define workspace and submitter identity from authenticated request context.
  * Define authoritative routing invariants and same-workspace target validation.
  * Define the one-to-many Task-to-TaskWork domain model and initial statuses.
  * Define the authoritative shared production status enum and the PA5 presentation-only mapping boundary.
  * Define Work ID as the TaskWork primary key, attempt numbering from 1, and new-row retry semantics.
  * Define future Prisma model ownership, scalar cross-module references, naming, IDs, timestamps, indexes, and deletion behavior.
  * Define `POST /api/workspaces/:workspaceId/tasks`, its public transport contract, and the internal authenticated create-task command.
  * Define which IDs, routing/API DTOs, statuses, and event contracts belong in `@vcp/shared`.
  * Keep domain entities, commands, repositories, Prisma records, lifecycle guards, logs, and failure internals private.
  * Document the current event envelope and the proposed reviewed version 1 extension.
  * Define the Task and TaskWork event matrix and distinguish attempt events from terminal Task events.
  * Define repository, routing-catalog, event-publisher, and application-service boundaries.
  * Define contract and architecture tests.
  * Do not implement Prisma models, handlers, repositories, services, workers, or domain events.

  Acceptance:

  * Workspace ID and submitter user ID cannot be supplied by the create-task body.
  * Route workspace ID must match authenticated workspace context.
  * Auto, Specific Agent, and Predefined Workflow invariants are exact and mutually exclusive.
  * Agent and Workflow are scalar references, not module-owned Prisma relations.
  * Task owns one or more TaskWork attempts; initial creation creates one queued attempt.
  * Initial creation uses attempt number 1; retries create new Work IDs and TaskWork rows for the same Task.
  * Shared production status and PA5 presentation status remain distinct and have an exact mapping.
  * Public API and shared contracts do not expose Prisma models.
  * Current and proposed event-envelope capabilities are not conflated.
  * Repository and service boundaries require tenant scope.
  * Architecture and contract test expectations are documented.
  * Task 6 is explicitly blocked until this foundation is complete.

  Verification:

  * Run `openspec validate "implement-task-orchestration" --strict`.
  * Run `openspec validate --all --strict`.
  * Run documentation formatting checks when available.
  * Run `git diff --check`.

  Suggested branch:

  `feature/task-orchestration/module-foundation`

  Suggested commit:

  `docs(task-orchestration): define module foundation`

* [x] 6. [PA5] Task & Orchestration – Task Creation Mock Flow

  Scope:

  * Begin only after Task 5A is complete.
  * Connect composer input and routing selection to the task factory.
  * Create Task ID and Work ID for accepted submissions.
  * Add the authoritative task store, reducer, or equivalent state boundary.
  * Add lifecycle transition helpers.
  * Create every accepted task with Pending status.
  * Store selected routing metadata.
  * Prevent invalid input from creating a task.
  * Keep processing timers, streaming, cancellation, and failure outside this task.

  Acceptance:

  * A valid submission creates exactly one task.
  * The task receives a unique Task ID and Work ID.
  * Initial status is Pending.
  * Routing metadata is correct.
  * Invalid submission creates no task.
  * Status cannot be assigned directly by presentation components.
  * Invalid state transitions are rejected.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add tests for task creation, identifiers, and transition guards.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-task-creation`

  Suggested commit:

  `feat(task-orchestration): implement mock task creation`

* [x] 7. [PA5] Task & Orchestration – Pending Task State

  Scope:

  * Render the submitted prompt.
  * Render Task ID or Work ID according to the PA4 view.
  * Render Pending status.
  * Render routing summary.
  * Render the initial processing timeline.
  * Provide the Pending cancellation entry point.
  * Do not implement the confirmation dialog or cancellation execution yet.
  * Do not show partial or completed output.

  Acceptance:

  * Pending appears immediately after task creation.
  * Work ID is visible.
  * Routing information is consistent with the created task.
  * The timeline does not claim future steps are completed.
  * Completed result is absent.
  * A cancellation action is available for later integration.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add Pending rendering tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-pending-state`

  Suggested commit:

  `feat(task-orchestration): add pending task state`

## Processing Flow

* [x] 8. [PA5] Task & Orchestration – In-Progress Timeline and Logs

  Scope:

  * Add the mock orchestration service or controller.
  * Transition Pending to In-Progress.
  * Simulate Validate input.
  * Simulate Analyze request.
  * Simulate Select agent or workflow.
  * Simulate Execute task.
  * Simulate Aggregate result.
  * Simulate Finalize.
  * Update timeline and logs in order.
  * Centralize delays.
  * Check terminal status before every asynchronous update.
  * Do not implement result chunk streaming in this task.

  Acceptance:

  * Pending transitions to In-Progress.
  * Only one step is active at a time.
  * Earlier steps remain Completed.
  * Later steps remain Waiting.
  * Logs are ordered and task-scoped.
  * Terminal tasks do not advance.
  * Timing is configurable for tests.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add lifecycle and fake-timer tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-processing-timeline`

  Suggested commit:

  `feat(task-orchestration): simulate processing timeline`

* [ ] 9. [PA5] Task & Orchestration – Simulated Streaming Result

  Scope:

  * Split deterministic mock result content into chunks.
  * Append chunks while the task is In-Progress.
  * Add a processing or streaming indicator.
  * Check abort and terminal status before every chunk.
  * Stop streaming when the run is disposed or reset.
  * Do not implement final Completed rendering in this task.

  Acceptance:

  * Partial result appears incrementally.
  * Pending does not stream.
  * Completed, Failed, and Canceled tasks reject late chunks.
  * Reset stops stale streaming callbacks.
  * Automated tests use fake timers or zero-delay configuration.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add streaming and cleanup tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-streaming`

  Suggested commit:

  `feat(task-orchestration): simulate streamed task results`

* [ ] 10. [PA5] Task & Orchestration – Completed Result View

  Scope:

  * Complete a successful mock task after all required stages.
  * Store the final result.
  * Render the Completed status.
  * Render formatted final result content.
  * Add a working Copy action.
  * Add Download only when it can be implemented correctly within the task budget.
  * Stop all processing and streaming after completion.
  * Prevent cancellation of Completed tasks.

  Acceptance:

  * In-Progress transitions to Completed exactly once.
  * Completed requires a finalized result.
  * Partial output alone never renders Completed.
  * No new logs, steps, or chunks appear after completion.
  * Copy works.
  * Completed cannot be canceled.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add Completed rendering and terminal-guard tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-completed-result`

  Suggested commit:

  `feat(task-orchestration): add completed result view`

* [ ] 11. [PA5] Task & Orchestration – Processing Detail Modal

  Scope:

  * Implement a shared processing-detail modal.
  * Display Task ID and Work ID.
  * Display current or final status.
  * Display routing mode and target.
  * Display processing timestamps or duration.
  * Display timeline and logs.
  * Support In-Progress and Completed initially.
  * Leave extension points for Canceled and Failed data.
  * Follow the existing modal and accessibility conventions.

  Acceptance:

  * Modal data comes from the authoritative task.
  * Modal opens and closes correctly.
  * In-Progress details show the active step.
  * Completed details show completed steps.
  * Waiting steps are not shown as completed.
  * Status is not hard-coded.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add modal interaction and rendering tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-processing-modal`

  Suggested commit:

  `feat(task-orchestration): add processing detail modal`

## Exception Flow

* [ ] 12. [PA5] Task & Orchestration – Cancel Confirmation and Canceled State

  Scope:

  * Implement the cancel confirmation dialog.
  * Display Work ID, current status, and current step.
  * Support Continue processing.
  * Support confirmed cancellation for Pending.
  * Support confirmed cancellation for In-Progress.
  * Abort the active run.
  * Clear active timers.
  * Stop streaming.
  * Mark the active step Canceled when applicable.
  * Store the canceled step.
  * Render the Canceled state.
  * Extend processing details for Canceled.
  * Preserve existing terminal states.

  Acceptance:

  * Pending can be canceled.
  * In-Progress can be canceled.
  * Continue processing changes nothing.
  * Confirming cancellation stops timers and chunks.
  * No later stage begins.
  * Canceled never becomes Completed or Failed.
  * Completed and Failed ignore cancellation.
  * Canceled details show where processing stopped.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add Pending-cancel, In-Progress-cancel, streaming-stop, and invalid-cancel tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-cancellation`

  Suggested commit:

  `feat(task-orchestration): implement task cancellation`

* [ ] 13. [PA5] Task & Orchestration – Failed Task State and Error Details

  Scope:

  * Detect prompts beginning with `FAIL_SIMULATION:`.
  * Trigger failure during the configured aggregation stage.
  * Stop timers and streaming.
  * Store a deterministic TaskError.
  * Mark the failed step.
  * Keep later steps incomplete.
  * Render the Failed summary.
  * Extend processing details for Failed.
  * Prevent Failed from transitioning to Completed.
  * Do not add production retry behavior unless separately approved.

  Acceptance:

  * The failure prompt fails deterministically.
  * Status is Failed.
  * Error code, failed step, title, message, and timestamp are available.
  * The incomplete output is not displayed as Completed.
  * No chunks or processing updates occur after failure.
  * Failed details preserve logs up to the failed step.
  * Failed never becomes Completed.
  * Added implementation and test code should generally remain within 500 lines per reviewable PR or sub-issue; larger work should be decomposed into multiple focused review units.

  Verification:

  * Add failure-trigger, Failed rendering, error-detail, and terminal-guard tests.
  * Run relevant tests and build.
  * Run OpenSpec validation.

  Suggested branch:

  `feat/task-orchestration-failure-state`

  Suggested commit:

  `feat(task-orchestration): add failure simulation and details`

## QA and Demo

* [ ] 14. [PA5] Task & Orchestration – Functional Test Cases

  Scope:

  * Prepare at least 25 functional test cases.
  * Include at least 5 Task Submission and Validation cases.
  * Include at least 5 Routing Selection cases.
  * Include at least 5 Task Lifecycle State cases.
  * Include at least 5 Cancellation and Failure Handling cases.
  * Include at least 5 Result Display and Processing Details cases.
  * Add automated coverage for business-critical behaviors when supported.
  * Use stable seed data and fake timers where appropriate.
  * Decompose this task into multiple focused review units when automated test code may exceed the 500-line recommendation.

  Acceptance:

  * At least 25 cases exist.
  * Every case contains ID, feature, preconditions when needed, steps, and expected result.
  * Success, validation, routing, lifecycle, cancellation, failure, results, and details are covered.
  * Cases use the same demo seed data as the implementation.
  * Test code in one pull request should generally remain within 500 added lines; decompose into multiple focused review units when needed.

  Verification:

  * Run all relevant automated tests.
  * Review the functional test case document for completeness.
  * Run build and OpenSpec validation.

  Suggested branch:

  `test/task-orchestration-functional-cases`

  Suggested commit:

  `test(task-orchestration): add functional test cases`

* [ ] 15. [PA5] Task & Orchestration – Test Execution and Defect Report

  Scope:

  * Execute every functional test case on the implementation.
  * Record actual result.
  * Record Pass, Fail, or Blocked.
  * Record a defect ID for every failed test.
  * Produce the test execution summary.
  * Create defect records with severity and reproduction details.
  * Retest fixed defects and record the retest outcome.
  * State explicitly when no defects are found.

  Acceptance:

  * Total, passed, failed, blocked, and pass rate are reported.
  * Failed test cases are listed.
  * Defect IDs link to failed cases.
  * Environment, branch or commit, date, and tester are recorded.
  * Defect reports contain all required fields.
  * Retest results are recorded when applicable.

  Verification:

  * Cross-check test totals against the case list.
  * Verify every failed case has a defect.
  * Verify every defect references a case.
  * Run final regression tests where fixes were made.

  Suggested branch:

  `docs/task-orchestration-test-report`

  Suggested commit:

  `docs(test): add task orchestration execution report`

* [ ] 16. [PA5] Task & Orchestration – Demo Script and Final Checklist

  Scope:

  * Prepare the Auto-routing success demo.
  * Prepare the Specific Agent demo.
  * Prepare the Predefined Workflow demo.
  * Prepare the cancellation demo.
  * Prepare the failure demo.
  * Verify deterministic reset.
  * Record the expected Work ID and visible state sequence.
  * Complete the final acceptance checklist.
  * Run the final test, build, and OpenSpec validation commands.
  * Review that implementation pull requests generally follow the 500-added-line recommendation and were decomposed into reviewable units when larger.

  Acceptance:

  * Success demo shows Pending, In-Progress, streaming, Completed, and details.
  * Specific Agent demo shows the selected agent.
  * Workflow demo shows the selected workflow.
  * Cancel demo proves that no chunk appears after cancellation.
  * Failure demo shows Failed and error details.
  * Reset allows the demonstrations to be repeated reliably.
  * All final acceptance criteria are checked.
  * Tests and build pass.
  * OpenSpec strict validation passes.

  Verification:

  * Execute the complete demo from a clean reset.
  * Run the final automated test suite.
  * Run the final build.
  * Run change-level and full OpenSpec validation.
  * Record any remaining known limitation.

  Suggested branch:

  `docs/task-orchestration-demo`

  Suggested commit:

  `docs(demo): add task orchestration demo script`
