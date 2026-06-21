## MODIFIED Requirements

### Requirement: Agent Creation
The system SHALL allow authorized users to create an agent in a workspace.

#### Scenario: Agent created
- **WHEN** an authorized user with `agents:manage` permission submits a valid name, role, model, and instructions
- **THEN** the system creates the agent, stores its configuration, and prepares the corresponding skill configuration content

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

## ADDED Requirements

### Requirement: Workspace Isolation
The system SHALL enforce strict workspace isolation for all agent data.

#### Scenario: Agent data isolated
- **WHEN** the system queries or persists agents
- **THEN** the data must be strictly scoped to the `workspaceId` provided in the authorized context, preventing cross-workspace leakage
