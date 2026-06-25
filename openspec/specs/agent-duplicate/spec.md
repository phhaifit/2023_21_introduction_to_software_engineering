# agent-duplicate Specification

## Purpose
TBD - created by archiving change complete-agent-management-features. Update Purpose after archive.
## Requirements
### Requirement: Agent Duplicate
The system SHALL allow authorized users to duplicate an existing agent's configuration under a new unique name.

#### Scenario: Successful duplicate
- **WHEN** an authorized user with `agents:manage` permission requests to duplicate an existing agent
- **THEN** the system creates a new agent with the same role, model, and instructions as the source agent, generates a unique name by appending `" (Copy)"` to the source name (incrementing with `" (Copy 2)"`, `" (Copy 3)"` etc. if needed), sets the new agent's status to `enabled`, writes the skill configuration file, and returns the new agent's public summary

#### Scenario: Duplicate deleted agent rejected
- **WHEN** an authorized user attempts to duplicate an agent with status `deleted`
- **THEN** the system rejects the request with a validation error `"deleted agents cannot be duplicated"`

#### Scenario: Source agent not found
- **WHEN** an authorized user attempts to duplicate a non-existent agent
- **THEN** the system returns a not-found error

#### Scenario: Duplicate name collision resolved
- **WHEN** the generated copy name (e.g., `"My Agent (Copy)"`) already exists in the workspace
- **THEN** the system increments the copy suffix (e.g., `"My Agent (Copy 2)"`, `"My Agent (Copy 3)"`) until a unique name is found

