## ADDED Requirements

### Requirement: Agent Rename
The system SHALL allow authorized users to rename an agent within a workspace.

#### Scenario: Successful rename
- **WHEN** an authorized user with `agents:manage` permission submits a new name for an existing agent
- **THEN** the system validates the new name is non-empty, checks workspace-scoped uniqueness, persists the updated name, updates the `updatedAt` timestamp, and returns the updated agent summary

#### Scenario: Duplicate name rejected
- **WHEN** an authorized user submits a new name that is already used by another agent in the same workspace
- **THEN** the system rejects the request with a validation error `"name must be unique within the workspace"`

#### Scenario: Empty name rejected
- **WHEN** an authorized user submits an empty or whitespace-only name
- **THEN** the system rejects the request with a validation error `"name is required"`

#### Scenario: Rename deleted agent rejected
- **WHEN** an authorized user attempts to rename an agent with status `deleted`
- **THEN** the system rejects the request with a validation error `"deleted agents cannot be changed"`

#### Scenario: Same name accepted
- **WHEN** an authorized user submits the agent's current name as the new name
- **THEN** the system accepts the request without error (no-op rename)

#### Scenario: Skill file updated after rename
- **WHEN** an agent is successfully renamed
- **THEN** the system writes an updated skill configuration file reflecting the new name
