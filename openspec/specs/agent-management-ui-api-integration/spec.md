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

### Requirement: Frontend Model Catalog Integration
The frontend SHALL load selectable agent models from the Agent Management model catalog API.

#### Scenario: Model dropdown populated
- **WHEN** the guided create modal opens
- **THEN** the frontend loads model catalog entries and displays them as selectable model options

#### Scenario: Model catalog failure
- **WHEN** the model catalog request fails
- **THEN** the frontend displays a recoverable error and does not submit an agent draft with an unknown model

### Requirement: Frontend Skill Artifact Integration
The frontend SHALL support `skill.md` preview, download, and import through Agent Management APIs.

#### Scenario: Preview shown
- **WHEN** a manager edits a valid draft
- **THEN** the frontend shows the latest generated `skill.md` preview without creating an agent

#### Scenario: Download action
- **WHEN** a manager activates Download skill.md for an existing agent
- **THEN** the frontend downloads the current Markdown artifact for that agent

#### Scenario: Import action
- **WHEN** a manager imports a Markdown `skill.md`
- **THEN** the frontend sends the content to the import analysis endpoint and displays the extracted draft for review

### Requirement: Frontend LLM Provider Failure Handling
The frontend SHALL handle LLM provider failures as retryable errors.

#### Scenario: All providers fail
- **WHEN** the assistant draft or skill import request returns an all-providers-failed error
- **THEN** the frontend displays a retry message and does not replace the current draft with partial data

#### Scenario: Fallback provider used
- **WHEN** Gemini fails and OpenRouter succeeds
- **THEN** the frontend displays the generated draft and may show provider metadata indicating fallback usage

### Requirement: Frontend Blocking Warning Safety
The frontend SHALL prevent agent creation while the draft contains blocking warnings.

#### Scenario: Blocking warning disables submit
- **WHEN** a draft has unavailable tools, missing knowledge, unready knowledge, invalid model, or missing required fields
- **THEN** the create action is disabled and the warning is visible to the manager

#### Scenario: Warning resolved
- **WHEN** the manager edits the draft so all blocking warnings are resolved
- **THEN** the frontend allows the draft to be submitted if all required fields are valid

### Requirement: Frontend Session Draft Safety
The frontend SHALL avoid unintended API mutations while a session-only draft is being edited.

#### Scenario: Draft close is non-mutating
- **WHEN** a manager closes the guided creation modal before submitting
- **THEN** the frontend does not call create, update, enable, disable, delete, rename, duplicate, or assignment APIs

#### Scenario: Valid draft submit uses create API
- **WHEN** a manager submits a valid assistant draft
- **THEN** the frontend calls the Agent Management create endpoint and refreshes the agent list on success

### Requirement: UI Refinement Preserves API-Backed Behavior
The system SHALL preserve existing Agent Management API-backed behavior while refining the user interface.

#### Scenario: List query behavior is preserved
- **WHEN** search, status filter, sort, page, or page size changes in the refined UI
- **THEN** the frontend sends the same workspace-scoped list query semantics and renders the returned paginated result

#### Scenario: Mutation behavior is preserved
- **WHEN** a manager creates, configures, renames, duplicates, enables, disables, or deletes an agent through the refined UI
- **THEN** the frontend uses the existing Agent Management API operation for that action and refreshes or preserves local state according to the existing behavior contract

#### Scenario: Assistant and import behavior is preserved
- **WHEN** a manager uses template creation, prompt assistant creation, `skill.md` import, model catalog loading, or `skill.md` preview in the refined UI
- **THEN** the frontend uses the existing Agent Management API client behavior without adding unrelated backend requirements

#### Scenario: New Agent creation workspace preserves request payloads
- **WHEN** the redesigned New Agent modal creates an agent from Template, Prompt Assistant, Import `skill.md`, or draft review mode
- **THEN** the frontend submits the same supported Agent Management create/configuration payload semantics as the existing API contract requires

### Requirement: API-Backed Agent Info Popup
The system SHALL load Agent Info Popup data through existing Agent Management frontend API behavior.

#### Scenario: Popup shows list summary immediately
- **WHEN** a user selects an Agent row
- **THEN** the Agent Info Popup shows available list summary data without waiting for a separate configuration response

#### Scenario: Popup loads configuration
- **WHEN** the Agent Info Popup opens for an active or disabled Agent
- **THEN** the frontend loads the selected Agent's editable configuration through the existing workspace-scoped configuration API

#### Scenario: Popup configuration failure is recoverable
- **WHEN** the selected Agent configuration request fails
- **THEN** the popup keeps the available list summary visible and displays a recoverable error for configuration-only details

#### Scenario: Popup actions use existing operations
- **WHEN** a manager chooses configure, rename, duplicate, enable, disable, or delete from the Agent Info Popup
- **THEN** the frontend uses the existing Agent Management API client operation for that action

### Requirement: Refined Mutation Safety
The system SHALL prevent accidental or duplicate mutations after the UI refinement.

#### Scenario: Pending mutation disables conflicting actions
- **WHEN** a create, update, rename, duplicate, enable, disable, delete, assistant, import, or preview request is pending
- **THEN** conflicting controls are disabled or marked busy and duplicate submissions are prevented

#### Scenario: Dialog close remains non-mutating
- **WHEN** a user closes create, configure, rename, delete, assistant, import, draft review, or Agent Info Popup UI without confirming a mutation
- **THEN** the frontend does not call a create, update, rename, duplicate, enable, disable, delete, assistant, import, or preview mutation except for already-started non-persisting preview requests

#### Scenario: Viewer mode remains read only
- **WHEN** Agent Management renders in viewer mode after the UI refinement
- **THEN** mutation controls are unavailable and the frontend does not call mutation endpoints from viewer controls

### Requirement: Recoverable API Feedback
The system SHALL keep recoverable user state and clear feedback when API operations fail in the refined UI.

#### Scenario: Validation error stays near field
- **WHEN** an API operation returns validation details for a submitted form or draft
- **THEN** the refined UI displays the relevant validation message near the affected field or form area and preserves user-entered values

#### Scenario: Non-validation error keeps last stable data
- **WHEN** a list, mutation, assistant, import, model catalog, or skill preview request fails unexpectedly
- **THEN** the refined UI displays recoverable error feedback without discarding the last successfully loaded list or draft state unnecessarily

### Requirement: Browser-Verifiable Refined Flow
The system SHALL keep the refined Agent Management UI verifiable through automated and manual browser flows.

#### Scenario: Accessible selectors support tests
- **WHEN** component or E2E tests inspect the refined Agent Management UI
- **THEN** tests can identify key regions, rows, the Agent Info Popup, dialogs, row actions, toasts, loading states, empty states, filters, and pagination through accessible roles, labels, names, or visible text

#### Scenario: End-to-end interactions remain covered
- **WHEN** browser verification is run after implementation
- **THEN** list loading, search/filter/sort, row-opened Agent Info Popup, create/configure, rename, duplicate, enable/disable, delete confirmation, viewer mode, and responsive layout are covered without depending on private implementation classes

#### Scenario: Creation modes are visually verified
- **WHEN** browser verification is run after implementation
- **THEN** desktop and narrow screenshots or equivalent visual assertions cover the Agent list, Agent Info Popup, New Agent Template mode, Prompt Assistant mode, Import `skill.md` mode, draft review, and validation or recoverable error states

### Requirement: Authenticated Agent Management API Requests
The Agent Management frontend API client SHALL send authenticated requests by default for workspace-scoped Agent Management operations.

#### Scenario: Token is attached to list request
- **WHEN** an authenticated browser session has a persisted session token and the Agent Management page requests the agent list
- **THEN** the request includes the bearer token through the shared frontend authenticated request mechanism

#### Scenario: Token is attached to mutation request
- **WHEN** an authenticated browser session creates, updates, renames, duplicates, enables, disables, deletes, previews, imports, or drafts an agent
- **THEN** the request includes the bearer token through the shared frontend authenticated request mechanism

#### Scenario: Test transport remains injectable
- **WHEN** a test creates an Agent Management API client with an injected fetch implementation
- **THEN** the client uses the injected implementation so tests can verify request paths, headers, payloads, and response handling without relying on browser local storage

#### Scenario: Auth failure remains visible
- **WHEN** an authenticated request receives an `auth.unauthorized` or `auth.forbidden` API failure
- **THEN** the Agent Management client exposes the failure code, message, details, status, and API error kind to the page instead of treating it as successful data
