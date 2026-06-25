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
The frontend SHALL fetch the agent list with query parameters and display paginated results.

#### Scenario: List with query support
- **WHEN** the agent management page loads or query state changes (search, filter, sort, page)
- **THEN** the frontend API client sends `GET /api/workspaces/:workspaceId/agents` with the current query parameters and renders the paginated result

#### Scenario: Pagination state management
- **WHEN** the user navigates between pages or changes page size
- **THEN** the frontend updates the query state and re-fetches the agent list without full page reload

### Requirement: API-Backed Agent Creation
The system SHALL submit create-form values to the workspace Agent Management API from the redesigned Agent Management presentation.

#### Scenario: Valid agent created
- **WHEN** a user submits valid name, role, model, and instructions through the redesigned create modal
- **THEN** the page creates the agent, refreshes the active list, and resets the create form

#### Scenario: Invalid create rejected
- **WHEN** the API returns `validation.invalid_input` for a create request
- **THEN** the page displays corresponding field or form errors in the create modal and preserves the submitted values

### Requirement: API-Backed Agent Editing
The system SHALL load editable agent configuration before submitting an update from the redesigned Agent Management presentation.

#### Scenario: Edit form opened
- **WHEN** a user selects the edit or configure action for an active agent in the redesigned list
- **THEN** the page opens the configure modal, loads that agent's editable configuration, and populates name, role, model, and instructions

#### Scenario: Valid update saved
- **WHEN** a user submits valid edited role, model, and instructions through the redesigned configure modal
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
The system SHALL connect redesigned enable, disable, and delete controls to their workspace Agent Management API operations.

#### Scenario: Enabled agent disabled
- **WHEN** a user activates Disable for an enabled agent through the redesigned row action menu
- **THEN** the page disables the agent and refreshes the list with the disabled status and Enable action

#### Scenario: Disabled agent enabled
- **WHEN** a user activates Enable for a disabled agent through the redesigned row action menu
- **THEN** the page enables the agent and refreshes the list with the enabled status and Disable action

#### Scenario: Agent deletion confirmed
- **WHEN** a user confirms Delete for an active agent through the redesigned row action menu
- **THEN** the page deletes the agent and refreshes the list without that agent

#### Scenario: Agent deletion cancelled
- **WHEN** a user cancels Delete confirmation
- **THEN** the page does not call the delete endpoint and leaves the list unchanged

### Requirement: Mutation Progress and Failure Feedback
The system SHALL communicate mutation progress and failures in the redesigned presentation while preserving recoverable user state.

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

### Requirement: Viewer Mode API Safety
The system SHALL avoid frontend mutation API calls from the Agent Management viewer presentation.

#### Scenario: Viewer cannot create agents
- **WHEN** Agent Management renders in viewer mode
- **THEN** the create-agent action is not available and the page does not call the create endpoint from viewer controls

#### Scenario: Viewer cannot mutate existing agents
- **WHEN** Agent Management renders a row in viewer mode
- **THEN** edit, enable, disable, and delete actions are not available as mutation controls and the page does not call the corresponding mutation endpoints from viewer controls

### Requirement: Modal Form API Safety
The system SHALL preserve API-backed create and update behavior after moving forms into modal dialogs.

#### Scenario: Create modal close is non-mutating
- **WHEN** a user opens Create agent and closes the modal without submitting
- **THEN** the page does not call the create endpoint and keeps the current agent list unchanged

#### Scenario: Configure modal close is non-mutating
- **WHEN** a user opens Configure for an agent and closes the modal without submitting
- **THEN** the page does not call the update endpoint and keeps the current agent list unchanged

### Requirement: Row Menu API Safety
The system SHALL ensure only supported row menu actions call Agent Management mutation APIs.

#### Scenario: Unsupported menu action selected
- **WHEN** a user inspects Rename or Duplicate in the row action menu
- **THEN** the page does not call create, update, enable, disable, or delete endpoints for those unsupported actions

### Requirement: Redesigned Test Selectors
The system SHALL keep Agent Management behavior testable after the visual redesign.

#### Scenario: Component tests inspect redesigned rows
- **WHEN** component tests render agents in the redesigned list
- **THEN** tests can identify rows and actions through accessible names, roles, labels, or visible text rather than legacy class names

#### Scenario: E2E tests verify redesigned lifecycle flow
- **WHEN** Playwright tests exercise list, create, edit, enable, disable, and delete flows
- **THEN** the tests pass against the redesigned presentation while still verifying the existing API-backed behavior

### Requirement: Frontend Rename Flow
The frontend SHALL support renaming agents through the API client.

#### Scenario: Rename API call
- **WHEN** a user confirms a rename in the rename dialog
- **THEN** the frontend sends `PATCH /api/workspaces/:workspaceId/agents/:agentId/name` with the new name and refreshes the list on success

#### Scenario: Rename validation error display
- **WHEN** the rename API returns a validation error (duplicate name)
- **THEN** the frontend displays the validation error in the rename dialog without closing it

### Requirement: Frontend Duplicate Flow
The frontend SHALL support duplicating agents through the API client.

#### Scenario: Duplicate API call
- **WHEN** a user clicks Duplicate in the row action menu
- **THEN** the frontend sends `POST /api/workspaces/:workspaceId/agents/:agentId/duplicate` and shows a success toast with the new agent name on success

### Requirement: Frontend Toast Integration
The frontend SHALL show toast notifications for all mutation outcomes.

#### Scenario: Create success toast
- **WHEN** agent creation succeeds
- **THEN** the frontend displays a success toast `"Agent '<name>' created successfully"`

#### Scenario: Delete success toast
- **WHEN** agent deletion succeeds
- **THEN** the frontend displays a success toast `"Agent '<name>' deleted"`

#### Scenario: Error toast
- **WHEN** any mutation fails with a non-validation server error
- **THEN** the frontend displays an error toast with the error message

### Requirement: E2E Test Coverage for New Flows
The system SHALL verify new agent management flows via E2E testing.

#### Scenario: Search flow E2E
- **WHEN** the E2E test types in the search input
- **THEN** the agent list filters to matching results

#### Scenario: Rename flow E2E
- **WHEN** the E2E test renames an agent through the action menu
- **THEN** the agent list reflects the new name

#### Scenario: Duplicate flow E2E
- **WHEN** the E2E test duplicates an agent through the action menu
- **THEN** the agent list shows the new cloned agent

