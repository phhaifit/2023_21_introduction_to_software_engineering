## MODIFIED Requirements

### Requirement: Agent Creation
The system SHALL allow authorized users to create an agent in a workspace.

#### Scenario: Agent created
- **WHEN** an authorized user with `agents:manage` permission submits a valid name, role, model, and instructions
- **THEN** the system creates the agent, stores its configuration, prepares the corresponding skill configuration content, and refreshes the paginated agent list

#### Scenario: Invalid agent rejected
- **WHEN** an authorized user submits missing or invalid agent configuration
- **THEN** the system rejects the request with a validation error response

## ADDED Requirements

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
