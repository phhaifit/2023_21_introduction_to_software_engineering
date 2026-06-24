## ADDED Requirements

### Requirement: Workflow Listing
The system SHALL show workflows defined in a workspace.

#### Scenario: Workflow list viewed
- **WHEN** an authorized user opens the workflow list
- **THEN** the system returns workflows with name, status, step count, creation time, and update time

### Requirement: Workflow Creation
The system SHALL allow authorized users to create a sequential workflow definition.

#### Scenario: Workflow created
- **WHEN** an authorized user submits a valid workflow name and ordered agent steps
- **THEN** the system stores the workflow definition in the workspace

#### Scenario: Invalid workflow rejected
- **WHEN** a workflow references missing agents or invalid step data
- **THEN** the system rejects the request with a validation error response

### Requirement: Workflow Editing
The system SHALL allow authorized users to update workflow definitions.

#### Scenario: Workflow updated
- **WHEN** an authorized user changes workflow name, status, or ordered steps
- **THEN** the system persists the updated workflow definition

### Requirement: Workflow Validation
The system SHALL validate workflow agent references before activation or execution.

#### Scenario: Workflow activation validated
- **WHEN** an authorized user activates a workflow
- **THEN** the system confirms all referenced agents are available through public agent summaries

### Requirement: Workflow Execution Request
The system SHALL allow authorized users to request execution of an active workflow.

#### Scenario: Workflow execution requested
- **WHEN** an authorized user starts an active workflow with an input prompt
- **THEN** the system creates or emits a workflow execution request for task orchestration
