# task-failure-cancellation Specification

## Purpose
Covers controlled cancellation, Failed state, deterministic TaskError, failed step and error details, and prevention of invalid terminal-state transitions.

## Requirements

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
