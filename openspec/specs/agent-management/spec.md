## Purpose

Define workspace-scoped virtual employee lifecycle management, configuration, lifecycle control, and public agent summary behavior.
## Requirements
### Requirement: Agent Listing
The system SHALL show workspace agents with key operating information.

#### Scenario: Agent list viewed
- **WHEN** an authorized user opens the agent list for a workspace
- **THEN** the system returns agents with name, status, role, model, creation time, and update time

### Requirement: Agent Creation
The system SHALL allow authorized users to create an agent in a workspace.

#### Scenario: Agent created
- **WHEN** an authorized user with `agents:manage` permission submits a valid name, role, model, and instructions
- **THEN** the system creates the agent, stores its configuration, prepares the corresponding skill configuration content, and refreshes the paginated agent list

#### Scenario: Invalid agent rejected
- **WHEN** an authorized user submits missing or invalid agent configuration
- **THEN** the system rejects the request with a validation error response

### Requirement: Agent Configuration Update
The system SHALL allow authorized users to update agent configuration.

#### Scenario: Agent updated
- **WHEN** an authorized user with `agents:manage` permission changes an agent's role, model, or instructions
- **THEN** the system persists the new configuration and updates the skill configuration content

### Requirement: Agent Activation Control
The system SHALL allow authorized users to enable or disable an agent.

#### Scenario: Agent disabled
- **WHEN** an authorized user with `agents:manage` permission disables an active agent
- **THEN** the system prevents the agent from being selected for new task execution

#### Scenario: Agent enabled
- **WHEN** an authorized user with `agents:manage` permission enables a disabled agent
- **THEN** the system allows the agent to be selected for new task execution

### Requirement: Agent Deletion
The system SHALL allow authorized users to delete or mark an agent as deleted.

#### Scenario: Agent deleted
- **WHEN** an authorized user with `agents:manage` permission deletes an agent
- **THEN** the system removes the agent from active lists and prevents new workflows or tasks from selecting it

### Requirement: Agent Public Summary
The system SHALL expose public agent summaries for other modules.

#### Scenario: Module requests agent summary
- **WHEN** workflow or task orchestration needs selectable agent data
- **THEN** the system provides only public summary fields through an approved contract

### Requirement: Workspace Isolation
The system SHALL enforce strict workspace isolation for all agent data.

#### Scenario: Agent data isolated
- **WHEN** the system queries or persists agents
- **THEN** the data must be strictly scoped to the `workspaceId` provided in the authorized context, preventing cross-workspace leakage

### Requirement: E2E Verification
The system SHALL verify the agent management workflows via E2E testing.

#### Scenario: Run Playwright tests
- **WHEN** the e2e test suite is executed
- **THEN** all agent management tests pass

### Requirement: Agent Rename
The system SHALL allow authorized users to rename an existing agent.

#### Scenario: Agent renamed
- **WHEN** an authorized user with `agents:manage` permission submits a new name for an existing agent
- **THEN** the system validates workspace-scoped uniqueness, persists the new name, updates the skill configuration content, and returns the updated agent summary

### Requirement: Agent Duplicate
The system SHALL allow authorized users to duplicate an agent's configuration.

#### Scenario: Agent duplicated
- **WHEN** an authorized user with `agents:manage` permission requests to duplicate an existing agent
- **THEN** the system creates a new agent with a unique auto-generated name and cloned configuration, writes the skill configuration content, and returns the new agent's public summary

