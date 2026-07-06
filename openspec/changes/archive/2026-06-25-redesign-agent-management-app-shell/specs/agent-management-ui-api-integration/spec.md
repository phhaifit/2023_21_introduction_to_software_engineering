## MODIFIED Requirements

### Requirement: API-Backed Agent List
The system SHALL load the active agent list from the backend for the workspace supplied by the app boundary and render it through the redesigned Agent Management list presentation.

#### Scenario: Page initially loads agents
- **WHEN** the Agent Management page mounts
- **THEN** it shows a redesigned loading skeleton with a screen-reader-visible loading state and then renders the enabled and disabled agents returned by the list API

#### Scenario: Workspace has no active agents
- **WHEN** the list API returns no agents
- **THEN** the page renders the redesigned active-list empty state instead of mock agents

#### Scenario: Initial list request fails
- **WHEN** the list API cannot return agent data
- **THEN** the page displays a recoverable general error instead of mock agents and preserves a retry action

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
- **THEN** the relevant redesigned controls are disabled and duplicate requests are prevented

#### Scenario: Mutation fails unexpectedly
- **WHEN** a mutation returns a non-validation error or the network request fails
- **THEN** the page displays a general error, preserves form values when applicable, and keeps the last successfully loaded list

## ADDED Requirements

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
