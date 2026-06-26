# task-history Specification

## Purpose
Covers conversation sessions, multi-turn navigation, history storage, history filtering, session switching, and restoration.

## Requirements

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
