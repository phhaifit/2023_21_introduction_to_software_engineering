## ADDED Requirements

### Requirement: Task Submission
The system SHALL allow authorized users to submit a task prompt within a workspace.

#### Scenario: Task submitted
- **WHEN** an authorized user submits a valid prompt
- **THEN** the system creates a task record, marks it queued, and returns the task identifier

#### Scenario: Invalid task rejected
- **WHEN** a user submits an empty prompt or invalid workspace target
- **THEN** the system rejects the request with a validation error response

### Requirement: Task Routing
The system SHALL route tasks to a direct agent, workflow, or simple automatic router.

#### Scenario: Direct agent selected
- **WHEN** the user selects a specific enabled agent
- **THEN** the system routes the task to that agent

#### Scenario: Workflow selected
- **WHEN** the user selects an active workflow
- **THEN** the system routes the task to the workflow execution path

#### Scenario: Automatic routing selected
- **WHEN** the user does not select an agent or workflow
- **THEN** the system chooses an eligible agent or workflow using the V1 routing rule and records the decision

### Requirement: Sequential Multi-Agent Execution
The system SHALL execute V1 multi-agent workflows sequentially.

#### Scenario: Workflow step completed
- **WHEN** one workflow step completes
- **THEN** the system passes the step output as context to the next step

### Requirement: Task Status Tracking
The system SHALL expose task status and execution history.

#### Scenario: Task status viewed
- **WHEN** an authorized user opens a task
- **THEN** the system returns current status, selected route, step history, and available result data

### Requirement: Task Result Aggregation
The system SHALL aggregate final output from direct agent or workflow execution.

#### Scenario: Task completed
- **WHEN** all required execution steps finish successfully
- **THEN** the system marks the task completed and stores the final result for display

#### Scenario: Task failed
- **WHEN** execution fails and cannot be recovered
- **THEN** the system marks the task failed and stores a safe error summary
