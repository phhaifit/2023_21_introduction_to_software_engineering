## ADDED Requirements

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
