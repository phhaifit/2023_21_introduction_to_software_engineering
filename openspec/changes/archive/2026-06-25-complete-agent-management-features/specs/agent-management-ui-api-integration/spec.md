## MODIFIED Requirements

### Requirement: API-Backed Agent List
The frontend SHALL fetch the agent list with query parameters and display paginated results.

#### Scenario: List with query support
- **WHEN** the agent management page loads or query state changes (search, filter, sort, page)
- **THEN** the frontend API client sends `GET /api/workspaces/:workspaceId/agents` with the current query parameters and renders the paginated result

#### Scenario: Pagination state management
- **WHEN** the user navigates between pages or changes page size
- **THEN** the frontend updates the query state and re-fetches the agent list without full page reload

## ADDED Requirements

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
