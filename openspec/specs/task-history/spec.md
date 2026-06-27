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

---

### Requirement: Runtime Ownership by Task ID

Runtime event subscriptions SHALL be keyed by Task ID. Conversation selection SHALL NOT suppress, redirect, or cancel runtime events for any task.

#### Scenario: Conversation switch does not cancel runtime event delivery

* **GIVEN** a task subscription is active for Task A in Conversation 1
* **WHEN** the user switches to Conversation 2
* **THEN** the subscription for Task A SHALL remain active
* **AND** events for Task A SHALL continue to be delivered to its handler

#### Scenario: Demo reset unsubscribes all active task subscriptions

* **WHEN** the demo reset action is invoked
* **THEN** `unsubscribeFromTaskEvents` SHALL be called for every active subscription before the task store is cleared
* **AND** no stale event SHALL update the cleared store
