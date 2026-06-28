# Task Execution Lifecycle Contract Establishment Specification

## MODIFIED Requirements

### Requirement: Task Lifecycle State Machine
The Task & Orchestration module SHALL maintain a robust, authoritative state machine governing task lifecycle transitions across Pending, In-Progress, Completed, Failed, and Canceled statuses, driven strictly by normalized runtime events and decoupled from runtime provisioning or infrastructure management.

#### Scenario: Platform Task accepted
* **GIVEN** a valid task request is submitted and accepted by the platform
* **WHEN** the initial record is created
* **THEN** the task SHALL be assigned the canonical Pending status
* **AND** the system SHALL NOT provision an execution runtime

#### Scenario: Provider execution confirmed started
* **GIVEN** a task is in Pending status
* **WHEN** the adapter confirms the provider execution has started
* **THEN** the task SHALL transition to In-Progress status

#### Scenario: Partial or activity update received
* **GIVEN** a task is In-Progress
* **WHEN** a partial output or activity update is received via `NormalizedRuntimeEvent`
* **THEN** the task SHALL remain In-Progress

#### Scenario: Final completion confirmed
* **GIVEN** a task is In-Progress
* **WHEN** a final completion event is confirmed by the adapter
* **THEN** the task SHALL transition to Completed status

#### Scenario: Terminal provider failure confirmed
* **GIVEN** a task is In-Progress
* **WHEN** a terminal provider failure is confirmed by the adapter
* **THEN** the task SHALL transition to Failed status
* **AND** the error details SHALL be normalized and safe for presentation

#### Scenario: Cancellation confirmed
* **GIVEN** a task is In-Progress
* **WHEN** a cancellation confirmation is received from the adapter
* **THEN** the task SHALL transition to Canceled status

#### Scenario: Transport interruption occurs
* **GIVEN** a task is In-Progress
* **WHEN** a transport interruption occurs between the adapter and the external runtime reference
* **THEN** the task status SHALL remain unchanged (In-Progress)
* **AND** transport interruption SHALL NOT by itself transition a Task to Failed.
