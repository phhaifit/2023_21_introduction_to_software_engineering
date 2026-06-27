# task-routing Specification

## Purpose
Covers auto-routing, specific-agent routing, predefined workflow routing, routing validation, and routing selection results.

## Requirements

### Requirement: Authoritative Routing Contract

The create-task contract SHALL represent routing as a discriminated union and
the application layer SHALL enforce exactly one valid routing policy.

#### Scenario: Validate authoritative routing invariants

* **WHEN** Auto-routing is requested
* **THEN** agent ID and workflow ID SHALL both be absent
* **WHEN** Specific Agent routing is requested
* **THEN** exactly one same-workspace selectable agent ID SHALL be present
* **WHEN** Predefined Workflow routing is requested
* **THEN** exactly one same-workspace executable workflow ID SHALL be present
* **AND** incompatible target combinations SHALL be rejected before persistence

---

### Requirement: Routing Mode Selection

The system SHALL support Auto-routing, Specific Agent, and Predefined Workflow routing modes.

Auto-routing SHALL be available without selecting a target.

Specific Agent routing SHALL require a valid agent selection.

Predefined Workflow routing SHALL require a valid workflow selection.

#### Scenario: Use Auto-routing

* **GIVEN** the user is composing a task
* **WHEN** the user selects Auto-routing and submits a valid prompt
* **THEN** the task SHALL store Auto-routing as its routing mode
* **AND** the task SHALL NOT require an explicit agent ID
* **AND** the task SHALL NOT require an explicit workflow ID

#### Scenario: Select a specific agent

* **GIVEN** the mock agent registry is available
* **WHEN** the user selects Specific Agent
* **AND** the user selects an available agent
* **AND** the user submits a valid prompt
* **THEN** the task SHALL store Specific Agent as its routing mode
* **AND** the task SHALL store the selected agent ID
* **AND** the selected agent SHALL override Auto-routing

#### Scenario: Select a predefined workflow

* **GIVEN** the mock workflow registry is available
* **WHEN** the user selects Predefined Workflow
* **AND** the user selects an available workflow
* **AND** the user submits a valid prompt
* **THEN** the task SHALL store Predefined Workflow as its routing mode
* **AND** the task SHALL store the selected workflow ID

#### Scenario: Change routing mode before submission

* **GIVEN** the user has selected a routing mode and target
* **WHEN** the user changes to another routing mode before submission
* **THEN** the latest routing mode SHALL replace the previous mode
* **AND** incompatible target values SHALL be cleared
* **AND** only the latest valid routing selection SHALL be attached to the task

#### Scenario: Prevent submission without required target

* **GIVEN** the user selected Specific Agent or Predefined Workflow
* **AND** no corresponding target was selected
* **WHEN** the user attempts to submit the task
* **THEN** the system SHALL reject the routing selection
* **AND** the system SHALL request a valid target
* **AND** the system SHALL NOT create the task

---

### Requirement: Mock Agent and Workflow Registry

The PA5 implementation SHALL provide deterministic local agent and workflow seed data.

The seed registry SHALL include the required agents and workflows.

#### Scenario: Load required mock agents

* **WHEN** the Task & Orchestration module initializes
* **THEN** the mock agent registry SHALL include `AGT-CODE`
* **AND** the mock agent registry SHALL include `AGT-REVIEW`
* **AND** the mock agent registry SHALL include `AGT-RESEARCH`
* **AND** the mock agent registry SHALL include `AGT-SYNTHESIS`

#### Scenario: Load required mock workflows

* **WHEN** the Task & Orchestration module initializes
* **THEN** the mock workflow registry SHALL include `WFL-CODE-REVIEW`
* **AND** the mock workflow registry SHALL include `WFL-RESEARCH-SYNTHESIS`

#### Scenario: Reset mock registries

* **GIVEN** the demo data has been used or modified in memory
* **WHEN** the user resets the demo
* **THEN** the system SHALL restore the original mock agents
* **AND** the system SHALL restore the original mock workflows
