## ADDED Requirements

### Requirement: Agent Listing
The system SHALL show workspace agents with key operating information.

#### Scenario: Agent list viewed
- **WHEN** an authorized user opens the agent list for a workspace
- **THEN** the system returns agents with name, status, role, model, creation time, and update time

### Requirement: Agent Creation
The system SHALL allow authorized users to create an agent in a workspace.

#### Scenario: Agent created
- **WHEN** an authorized user submits a valid name, role, model, and instructions
- **THEN** the system creates the agent, stores its configuration, and prepares the corresponding skill configuration content

#### Scenario: Invalid agent rejected
- **WHEN** an authorized user submits missing or invalid agent configuration
- **THEN** the system rejects the request with a validation error response

### Requirement: Agent Configuration Update
The system SHALL allow authorized users to update agent configuration.

#### Scenario: Agent updated
- **WHEN** an authorized user changes an agent's role, model, or instructions
- **THEN** the system persists the new configuration and updates the skill configuration content

### Requirement: Agent Activation Control
The system SHALL allow authorized users to enable or disable an agent.

#### Scenario: Agent disabled
- **WHEN** an authorized user disables an active agent
- **THEN** the system prevents the agent from being selected for new task execution

#### Scenario: Agent enabled
- **WHEN** an authorized user enables a disabled agent
- **THEN** the system allows the agent to be selected for new task execution

### Requirement: Agent Deletion
The system SHALL allow authorized users to delete or mark an agent as deleted.

#### Scenario: Agent deleted
- **WHEN** an authorized user deletes an agent
- **THEN** the system removes the agent from active lists and prevents new workflows or tasks from selecting it

### Requirement: Agent Public Summary
The system SHALL expose public agent summaries for other modules.

#### Scenario: Module requests agent summary
- **WHEN** workflow or task orchestration needs selectable agent data
- **THEN** the system provides only public summary fields through an approved contract
