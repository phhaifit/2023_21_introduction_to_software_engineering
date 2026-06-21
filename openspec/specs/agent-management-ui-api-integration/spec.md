## Purpose

Define the browser-to-API integration behavior for workspace-scoped Agent Management operations and local development.

## Requirements

### Requirement: Agent Management Frontend API Client
The system SHALL provide a frontend Agent Management API client that uses the shared response envelope for workspace-scoped list, create, configuration read, update, enable, disable, and delete operations.

#### Scenario: Successful response parsed
- **WHEN** an Agent Management endpoint returns a successful `ApiResponse`
- **THEN** the client returns the typed response data to the page

#### Scenario: Failure response parsed
- **WHEN** an Agent Management endpoint returns a failed `ApiResponse`
- **THEN** the client exposes the error code, message, and validation details without treating the response as successful data

### Requirement: API-Backed Agent List
The system SHALL load the active agent list from the backend for the workspace supplied by the app boundary.

#### Scenario: Page initially loads agents
- **WHEN** the Agent Management page mounts
- **THEN** it shows a loading state and then renders the enabled and disabled agents returned by the list API

#### Scenario: Workspace has no active agents
- **WHEN** the list API returns no agents
- **THEN** the page renders the active-list empty state

#### Scenario: Initial list request fails
- **WHEN** the list API cannot return agent data
- **THEN** the page displays a recoverable general error instead of mock agents

### Requirement: API-Backed Agent Creation
The system SHALL submit create-form values to the workspace Agent Management API.

#### Scenario: Valid agent created
- **WHEN** a user submits valid name, role, model, and instructions
- **THEN** the page creates the agent, refreshes the active list, and resets the create form

#### Scenario: Invalid create rejected
- **WHEN** the API returns `validation.invalid_input` for a create request
- **THEN** the page displays corresponding field or form errors and preserves the submitted values

### Requirement: API-Backed Agent Editing
The system SHALL load editable agent configuration before submitting an update.

#### Scenario: Edit form opened
- **WHEN** a user selects Edit for an active agent
- **THEN** the page loads that agent's editable configuration and populates name, role, model, and instructions

#### Scenario: Valid update saved
- **WHEN** a user submits valid edited role, model, and instructions
- **THEN** the page updates the agent, refreshes the active list, and keeps the updated agent visible

#### Scenario: Edit configuration unavailable
- **WHEN** the configuration request returns `agent.not_available`
- **THEN** the page displays a general edit error and does not submit stale or empty instructions

### Requirement: Agent Configuration Read Endpoint
The system SHALL provide a workspace-scoped endpoint for reading the editable configuration of one active agent.

#### Scenario: Active agent configuration returned
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents/:agentId/configuration` for an active agent in that workspace
- **THEN** the response returns name, role, model, instructions, status, and update metadata without generated skill configuration

#### Scenario: Cross-workspace configuration rejected
- **WHEN** a client requests configuration for an agent belonging to another workspace
- **THEN** the response uses `agent.not_available` and exposes no agent configuration

### Requirement: API-Backed Lifecycle Controls
The system SHALL connect enable, disable, and delete controls to their workspace Agent Management API operations.

#### Scenario: Enabled agent disabled
- **WHEN** a user activates Disable for an enabled agent
- **THEN** the page disables the agent and refreshes the list with the disabled status and Enable action

#### Scenario: Disabled agent enabled
- **WHEN** a user activates Enable for a disabled agent
- **THEN** the page enables the agent and refreshes the list with the enabled status and Disable action

#### Scenario: Agent deletion confirmed
- **WHEN** a user confirms Delete for an active agent
- **THEN** the page deletes the agent and refreshes the list without that agent

#### Scenario: Agent deletion cancelled
- **WHEN** a user cancels Delete confirmation
- **THEN** the page does not call the delete endpoint and leaves the list unchanged

### Requirement: Mutation Progress and Failure Feedback
The system SHALL communicate mutation progress and failures while preserving recoverable user state.

#### Scenario: Mutation in progress
- **WHEN** a create, update, enable, disable, or delete request is pending
- **THEN** the relevant controls are disabled and duplicate requests are prevented

#### Scenario: Mutation fails unexpectedly
- **WHEN** a mutation returns a non-validation error or the network request fails
- **THEN** the page displays a general error, preserves form values when applicable, and keeps the last successfully loaded list

### Requirement: Local Browser Integration
The system SHALL provide a local development composition that runs the React page and Agent Management API together.

#### Scenario: Local application started
- **WHEN** a developer runs the documented root development command
- **THEN** the browser can load agents and perform create, edit, enable, disable, and delete operations through the proxied API

#### Scenario: Local API restarted without database
- **WHEN** the local API process restarts without `DATABASE_URL`
- **THEN** Agent Management data resets to the documented seed state

#### Scenario: Local API started with database
- **WHEN** the local API starts with `DATABASE_URL`
- **THEN** Agent Management data is loaded through the database repository instead of the in-memory seed repository
