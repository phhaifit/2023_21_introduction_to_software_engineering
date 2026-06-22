# Agent Working Rules

These rules apply to this repository.

Follow them before project-specific chat context unless the user explicitly
overrides them.

## Communication

* Use Vietnamese by default, but retain technical terms in their original form.
* Use English when executing OpenSpec actions and when preparing commit, push,
  or pull-request content.
* Use a pragmatic, scientific, and direct response style.
* Report concrete commands, changed files, verification results, and known gaps.
* Do not claim that a command passed unless it was actually executed.

## Personal Files Protection

* **STRICT RULE**: Never read, modify, stage, or commit any file inside
  `.local-docs/`.
* Apply the same rule to any other directory explicitly identified as personal.
* Treat personal directories as invisible to repository analysis and Git
  operations.
* Never use broad staging commands before checking that protected files are not
  included.

## Source of Truth

OpenSpec is the source of truth for project planning and implementation.

Do not implement product behavior from memory or chat context alone.

Before coding, read the relevant files in this order:

1. `docs/requirements.md`
2. `docs/architecture.md`
3. `openspec/specs/platform-architecture/spec.md`
4. `openspec/specs/project-skeleton/spec.md`
5. `openspec/specs/shared-contracts/spec.md`
6. `openspec/specs/team-workflow/spec.md`
7. `docs/module-ownership.md`
8. The proposal, design, specifications, and tasks for the active OpenSpec change

For Task & Orchestration work, the active change is:

```text
openspec/changes/implement-task-orchestration
```

The required change artifacts are:

* `proposal.md`
* `design.md`
* All `spec.md` files under the change
* `tasks.md`

## Repository Discovery Rule

Before implementing the first task of a module or when repository conventions
are unclear, perform a read-only discovery pass.

During discovery:

* Do not modify files.
* Do not install dependencies.
* Do not create commits.
* Do not push.
* Inspect the real workspace, route, component, styling, state-management, and
  test conventions.
* Identify exact files likely to change.
* Estimate added code lines.
* Report module-boundary and shared-contract risks.
* Stop after reporting the implementation plan.

Do not create guessed folder structures when the repository already has its own
conventions.

## OpenSpec Apply Change Workflow

When the user asks to apply or continue an OpenSpec change:

1. Check repository state first:

   ```bash
   git status --short --branch
   ```

2. If the worktree contains unrelated or unclear changes, stop and report the
   dirty files before pulling, switching branches, or editing files.

3. Start from the latest default integration branch.

   The expected branch is currently:

   ```text
   master
   ```

   Use:

   ```bash
   git checkout master
   git pull --ff-only origin master
   ```

   If the repository default branch is changed, use the branch reported by
   `git remote show origin`.

4. Create a feature branch before editing.

   Use these branch patterns:

   ```text
   feature/<module>/<change-short-name>
   test/<module>/<change-short-name>
   docs/<module>/<change-short-name>
   chore/<change-short-name>
   ```

   Task & Orchestration examples:

   ```text
   feature/task-orchestration/workspace-layout
   feature/task-orchestration/mock-domain-model
   feature/task-orchestration/routing-selector
   test/task-orchestration/functional-cases
   docs/task-orchestration/test-report
   ```

5. Read all relevant OpenSpec artifacts before coding.

6. Implement only the explicitly selected OpenSpec task or sub-issue.

7. Do not implement later tasks in `tasks.md` unless the user explicitly
   requests them.

8. Add focused automated tests together with implemented business behavior.

   Do not defer tests for lifecycle, routing, cancellation, terminal-state,
   or failure behavior to a later phase when that behavior is implemented now.

9. Update a `tasks.md` checkbox only after:

   * Implementation is complete.
   * Relevant automated tests pass.
   * Build passes.
   * OpenSpec validation passes.
   * The code-size requirement passes.

10. Before completing a task, run the repository-supported equivalents of:

```bash
npm test
npm run build
openspec validate "<change-name>" --strict
openspec validate --all --strict
git diff --check
```

11. Run Prisma validation only when Prisma-related files are affected:

```bash
npm run prisma -- validate
```

12. Archive a change only when:

* All tasks are complete.
* Main specifications have been synchronized.
* Tests pass.
* Build passes.
* Strict validation passes.
* The user explicitly requests or approves archival.

## Module Boundary Rules

A module may import:

* `@vcp/shared`
* `@vcp/database` from backend or worker code only
* `apps/backend/src/shared/*`
* Files inside the same module

A module must not import:

* Another module's internal service
* Another module's internal repository
* Another module's private state store
* Another module's internal UI component

When data from another module is required, use:

* An API
* A DTO
* A domain event
* A public shared contract

## Shared Contract Rules

Changing anything in:

```text
packages/shared/src/contracts
```

or changing public exports from:

```text
@vcp/shared
```

affects multiple modules.

Before making such a change:

1. Explain why the existing contract is insufficient.
2. Confirm that the selected OpenSpec task requires the change.
3. Update the affected specification or design when behavior changes.
4. Run contract tests.
5. Request review from another module owner.

Prefer module-local types for PA5 mock behavior when no shared public contract
is required.

## Task & Orchestration PA5 Scope

The Task & Orchestration implementation is an interactive PA5 prototype.

It may use deterministic local mock data and simulated orchestration.

It must not depend on:

* External AI APIs
* External databases
* External orchestration engines
* Real agent services
* Real WebSocket or Server-Sent Events infrastructure
* Network access
* Non-deterministic external responses

Required routing modes:

* Auto-routing
* Specific agent
* Predefined workflow

Required task statuses:

* Pending
* In-Progress
* Completed
* Failed
* Canceled

Required mock orchestration stages:

1. Validate input
2. Analyze request
3. Select agent or workflow
4. Execute task
5. Aggregate result
6. Complete, Fail, or Cancel

Required deterministic failure trigger:

```text
FAIL_SIMULATION:
```

Required mock agents:

* `AGT-CODE`
* `AGT-REVIEW`
* `AGT-RESEARCH`
* `AGT-SYNTHESIS`

Required mock workflows:

* `WFL-CODE-REVIEW`
* `WFL-RESEARCH-SYNTHESIS`

## Task Lifecycle Rules

`New` is a user-interface state before a task object exists.

Supported persisted task statuses are:

* Pending
* In-Progress
* Completed
* Failed
* Canceled

Valid transitions are:

* New to Pending
* Pending to In-Progress
* Pending to Canceled
* In-Progress to Completed
* In-Progress to Failed
* In-Progress to Canceled

Terminal states are:

* Completed
* Failed
* Canceled

After a task reaches a terminal state, it must not:

* Continue processing
* Start another orchestration stage
* Append another processing log
* Append another streaming chunk
* Change its final result
* Change to another lifecycle state

A Failed task must never be rendered as Completed.

A Canceled task must stop active timers and simulated streaming.

Presentation components must not directly mutate lifecycle status.

Lifecycle changes must pass through the authoritative reducer, store,
controller, or service.

## Task & Orchestration Architecture Rules

Keep these responsibilities separated:

* Task input validation and creation
* Task identity generation
* Lifecycle state control
* Routing resolution
* Timeline and log generation
* Streaming simulation
* Final result rendering
* Cancellation control
* Failure handling
* UI presentation

Do not place all timers, routing decisions, state transitions, and rendering
logic in one React component.

Centralize:

* Task status definitions
* Routing-mode definitions
* Demo timing values
* Mock agents
* Mock workflows
* Mock result content
* Task transition guards

Every asynchronous processing callback must verify that:

* The current run has not been aborted.
* The task has not reached a terminal state.
* The callback still belongs to the current task run.

## Demo Data Rules

Demo data must be deterministic and resettable.

Do not use:

* `Math.random()` for workflow outcomes
* Current network state
* Live API responses
* Uncontrolled real-time dependencies

Reset must:

* Abort active task runs
* Clear active timers
* Stop result streaming
* Clear current task data
* Restore seed agents and workflows
* Prevent callbacks from the previous run from updating the new session

## Pull Request Code Size Rule

Every implementation sub-issue and pull request must add no more than 500
lines of code.

Before editing:

1. Identify exact files to create or modify.
2. Estimate added code lines.
3. Stop and propose a split when the estimate may exceed 500 lines.

Before opening a pull request:

1. Calculate actual added code lines.
2. Report the count.
3. Confirm that the count is 500 or fewer.

Do not combine large concerns in one pull request.

Keep these concerns separate:

* Workspace layout
* Mock data and types
* Shared UI components
* Composer
* Routing selector
* Task creation
* Processing timeline
* Streaming
* Completed result
* Processing detail modal
* Cancellation
* Failure handling
* Functional tests
* Test execution report
* Demo documentation

Documentation, generated files, lock files, and build output are not counted as
implementation code, but they must still be reviewed.

## Dependency Rules

Do not install or add a new production dependency without explicit approval.

Before proposing a dependency:

1. Check whether the repository already provides equivalent functionality.
2. Explain why the dependency is necessary.
3. Explain its impact on bundle size, tests, and maintenance.
4. Wait for user approval.

Do not run dependency-upgrade commands unless explicitly requested.

## Commit And Push Workflow

When the user asks to commit and push completed work:

1. Review changed files before staging:

   ```bash
   git status --short
   git diff --stat
   git diff
   ```

2. Never stage files inside `.local-docs/` or another personal directory.

3. Stage only files that belong to the current task.

4. Do not use a broad staging command without reviewing its result.

5. Prefer small commits grouped by work unit:

   * Feature implementation
   * Focused tests
   * OpenSpec task update
   * Documentation

6. Use Conventional Commit messages.

   Examples:

   ```text
   feat(task-orchestration): add base workspace layout
   feat(task-orchestration): add mock domain types
   test(task-orchestration): cover lifecycle transitions
   docs(task-orchestration): add test execution report
   chore(openspec): archive implement-task-orchestration
   ```

7. Do not commit or push unless the user explicitly requests it.

8. When requested, push the current feature branch:

   ```bash
   git push -u origin HEAD
   ```

## Pull Request Workflow

When the user asks for a pull request:

1. Prepare a pull-request title and body for GitHub Web.
2. Do not create the pull request directly unless explicitly requested.
3. Include:

   * OpenSpec change name
   * Selected and completed task
   * Scope
   * Out-of-scope items
   * Files changed
   * Tests and commands executed
   * Manual test notes
   * Added code line count
   * Known gaps and risks

Use this format:

```md
## Summary

- 
- 

## OpenSpec

Change: `<change-name>`

Completed tasks:

- [x] 

## Scope

- 

## Out of Scope

- 

## Tests

- [ ] `npm test`
- [ ] `npm run build`
- [ ] `openspec validate "<change-name>" --strict`
- [ ] `openspec validate --all --strict`
- [ ] `git diff --check`

## Manual Test

- 

## Code Size

Added code lines: `<number>`

## Remaining Scenarios / Gaps

- 
```

## Completion Report

After implementation, report:

1. Files created or modified
2. Behavior implemented
3. Tests added or updated
4. Commands executed
5. Exact command results
6. Added code line count
7. Remaining risks or gaps
8. Suggested Conventional Commit message

Do not hide failed commands or unresolved issues.
