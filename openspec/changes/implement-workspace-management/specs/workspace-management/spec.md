## ADDED Requirements

### Requirement: Workspace Listing
The system SHALL show authenticated users the workspaces they can access.

#### Scenario: Workspace list viewed
- **WHEN** an authenticated user opens the workspace list
- **THEN** the system returns accessible workspaces with name, status, creation time, and update time

### Requirement: Workspace Creation
The system SHALL allow an authenticated user to create a workspace with a selected configuration.

#### Scenario: Workspace creation requested
- **WHEN** a user submits a valid workspace name and configuration
- **THEN** the system creates workspace metadata, marks it as provisioning, and enqueues OpenClaw runtime provisioning

#### Scenario: Invalid workspace creation rejected
- **WHEN** a user submits an invalid name or unsupported configuration
- **THEN** the system rejects the request with a shared API error response

### Requirement: OpenClaw Provisioning Status
The system SHALL track OpenClaw provisioning progress for each workspace.

#### Scenario: Provisioning succeeds
- **WHEN** the OpenClaw provisioning worker reports success
- **THEN** the system marks the workspace active and stores the runtime reference

#### Scenario: Provisioning fails
- **WHEN** the OpenClaw provisioning worker reports failure
- **THEN** the system marks the workspace failed and records an actionable error state

### Requirement: Workspace Detail
The system SHALL show workspace details and related public module summaries.

#### Scenario: Workspace detail viewed
- **WHEN** an authorized user opens a workspace
- **THEN** the system returns workspace configuration plus available agent, workflow, and tool summaries through public contracts

### Requirement: Workspace Deletion
The system SHALL support deleting a workspace and cleaning up its OpenClaw runtime.

#### Scenario: Workspace deletion requested
- **WHEN** an authorized user deletes a workspace
- **THEN** the system marks the workspace deleting and enqueues runtime cleanup through the OpenClaw adapter boundary
