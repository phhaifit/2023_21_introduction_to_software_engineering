# task-execution-lifecycle Specification

## Purpose
Covers Pending, In-Progress, and Completed states, valid state transitions, processing steps, terminal-state rules, and completion behavior.

## Requirements

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

#### Scenario: Transport interruption occurs

* **GIVEN** a task is In-Progress
* **WHEN** a transport interruption occurs between the adapter and the external runtime reference
* **THEN** the task status SHALL remain unchanged (In-Progress)
* **AND** transport interruption SHALL NOT by itself transition a Task to Failed.

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
