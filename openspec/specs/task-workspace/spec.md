# task-workspace Specification

## Purpose
Covers workspace shell, composer behavior, execution feed, inspector, loading, empty and pending presentation, responsive design, and accessibility behavior.

## Requirements

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
