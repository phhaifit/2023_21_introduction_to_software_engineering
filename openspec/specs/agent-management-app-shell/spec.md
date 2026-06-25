## Purpose

Define the browser-runnable Agent Management app shell and its local API-backed development behavior.
## Requirements
### Requirement: React Vite App Shell
The system SHALL provide a React + Vite frontend app shell that can run locally with the Agent Management API.

#### Scenario: Frontend and API start
- **WHEN** a developer runs the documented root development command
- **THEN** the browser can load the React application and reach Agent Management routes through the local API proxy

### Requirement: Agent Management Page
The system SHALL present the Agent Management page with interactive toolbar controls, paginated table, and complete row action menu.

#### Scenario: Toolbar search
- **WHEN** a user types in the search input
- **THEN** the system debounces the input (300ms) and refreshes the agent list with the search query, resetting to page 1

#### Scenario: Toolbar filter
- **WHEN** a user selects a status filter option (All, Enabled, Disabled)
- **THEN** the system refreshes the agent list with the selected status filter, resetting to page 1

#### Scenario: Toolbar sort
- **WHEN** a user selects a sort option (Name A-Z, Name Z-A, Last modified, Created date)
- **THEN** the system refreshes the agent list with the selected sort order, preserving the current page

#### Scenario: Table pagination
- **WHEN** the agent list has more items than the current page size
- **THEN** the system displays pagination controls below the table with page indicator, previous/next buttons, and page size selector (10, 20, 50)

#### Scenario: Empty search result
- **WHEN** a search query or filter combination returns no results
- **THEN** the system displays an empty-search-result message with a clear-filters action instead of the default empty state

### Requirement: Mock Agent Data Preview
The system SHALL keep representative mock Agent Management data as isolated test fixtures rather than the default browser data source.

#### Scenario: Browser page uses backend data
- **WHEN** the Agent Management page loads in the browser
- **THEN** it requests workspace-scoped agents from the backend and does not render the static mock list as live data

#### Scenario: Isolated UI test uses fixtures
- **WHEN** an isolated view-model or component test needs representative agents
- **THEN** it can use mock fixtures containing at least one enabled agent and one disabled agent without calling the backend

### Requirement: Lifecycle Controls Preview
The system SHALL show Agent Management lifecycle controls in the browser preview.

#### Scenario: Lifecycle actions visible
- **WHEN** an agent row is displayed for a user who can manage agents
- **THEN** the row exposes a vertical three-dot action menu with the relevant configure, enable, disable, and delete controls based on the agent status

#### Scenario: Lifecycle controls remain accessible after redesign
- **WHEN** tests or assistive technologies inspect a rendered agent row
- **THEN** the row actions are reachable through stable button names, menu names, or accessible labels rather than only through visual icons

### Requirement: Modal Agent Form
The system SHALL show Agent Management create and configure forms in an accessible modal dialog rather than a persistent page column.

#### Scenario: Create modal opened from primary action
- **WHEN** a user who can manage agents activates New Agent
- **THEN** the page opens a modal dialog titled Create agent with name, role, model, and instructions fields

#### Scenario: Create modal opened from empty state
- **WHEN** a user who can manage agents activates Create first agent from the empty state
- **THEN** the page opens the same Create agent modal dialog

#### Scenario: Configure modal opened from row menu
- **WHEN** a user who can manage agents chooses Configure from an agent row action menu
- **THEN** the page opens a modal dialog for editing that agent's configuration

#### Scenario: Dialog dismissed
- **WHEN** a user closes the create or configure dialog without submitting
- **THEN** no create, update, enable, disable, or delete API call is made by that close action

### Requirement: Row Action Menu
The system SHALL present row actions through a compact vertical three-dot menu.

#### Scenario: Action menu displayed
- **WHEN** a user hovers or focuses the vertical three-dot action button for an agent row
- **THEN** the page displays a menu with stable accessible action names for the row

#### Scenario: Unsupported menu actions are presentational
- **WHEN** Rename or Duplicate appears in the row action menu for visual parity
- **THEN** those actions are disabled or otherwise non-mutating until a later OpenSpec change implements them

### Requirement: Manual Browser Verification
The system SHALL document how to manually verify the API-backed Agent Management app shell in a browser.

#### Scenario: Manual test instructions followed
- **WHEN** a developer follows the documented manual test steps
- **THEN** they can verify API-backed list, create, edit, lifecycle controls, validation feedback, recoverable errors, loading skeleton, empty state, and viewer-mode presentation

### Requirement: Stitch-Aligned Sidebar
The system SHALL provide an Agent Management app shell sidebar aligned with the Stitch expanded and collapsed sidebar materials.

#### Scenario: Expanded sidebar displayed
- **WHEN** the app shell renders the expanded desktop navigation
- **THEN** the sidebar displays the workspace identity, primary navigation items, active Agent Management item, settings/billing access, and help action with local icons

#### Scenario: Collapsed sidebar displayed
- **WHEN** the app shell renders the collapsed desktop navigation
- **THEN** the sidebar preserves the active Agent Management indication and exposes navigation items as icon buttons with accessible names

### Requirement: Local Icon Rendering
The system SHALL render app-shell and Agent Management icons through a local React icon dependency.

#### Scenario: Icons render without external icon fonts
- **WHEN** the frontend app is built and loaded locally
- **THEN** sidebar, toolbar, empty-state, row-action, and status icons render from the bundled React app without requiring Material Symbols, Google icon fonts, or remote icon CSS

### Requirement: Redesigned Empty and Loading States
The system SHALL provide Stitch-aligned empty and loading states for Agent Management.

#### Scenario: Empty state displayed
- **WHEN** the Agent Management list API returns no active agents
- **THEN** the page displays a Stitch-aligned empty state explaining agents and offering the create-agent action for users who can manage agents

#### Scenario: Loading skeleton displayed
- **WHEN** the Agent Management page is waiting for the initial list API response
- **THEN** the page displays a loading skeleton for the hero, toolbar, and list area while preserving a screen-reader-visible loading status

### Requirement: Viewer Presentation
The system SHALL provide a read-only viewer presentation for Agent Management.

#### Scenario: Viewer presentation displayed
- **WHEN** Agent Management renders in viewer mode
- **THEN** the page shows a viewer indicator and does not expose create, edit, enable, disable, or delete mutation controls as available actions

#### Scenario: Viewer presentation remains inspectable
- **WHEN** Agent Management renders existing agents in viewer mode
- **THEN** the page still displays agent name, role, model, status, and update metadata without allowing mutation submission

### Requirement: Row Action Menu Rename
The system SHALL allow renaming agents via the row action menu.

#### Scenario: Rename via action menu
- **WHEN** a manager clicks Rename in the row action menu
- **THEN** the system opens a rename dialog with the current name pre-filled, validates the new name on submit, and updates the agent list on success

### Requirement: Row Action Menu Duplicate
The system SHALL allow duplicating agents via the row action menu.

#### Scenario: Duplicate via action menu
- **WHEN** a manager clicks Duplicate in the row action menu
- **THEN** the system calls the duplicate endpoint, shows a success toast with the new agent name, and refreshes the agent list

### Requirement: Toast Notification System
The system SHALL provide non-blocking toast notifications for mutation feedback.

#### Scenario: Mutation success feedback
- **WHEN** a create, update, rename, duplicate, enable, disable, or delete operation succeeds
- **THEN** the system displays a success toast notification that auto-dismisses after 4 seconds

#### Scenario: Mutation error feedback
- **WHEN** a mutation operation fails with a server error
- **THEN** the system displays an error toast notification that persists until dismissed

### Requirement: Delete Confirmation Dialog
The system SHALL replace `window.confirm` with a styled confirmation dialog for agent deletion.

#### Scenario: Delete confirmation
- **WHEN** a manager clicks Delete in the row action menu
- **THEN** the system opens a confirmation dialog with agent name, warning text, and Cancel/Delete buttons instead of a browser-native confirm dialog

### Requirement: UI Micro-Animations
The system SHALL provide smooth visual transitions for interactive elements.

#### Scenario: Modal transition
- **WHEN** the create/configure/rename modal opens or closes
- **THEN** the modal backdrop fades in/out and the modal panel scales and fades smoothly (150ms ease-out)

#### Scenario: Row hover effect
- **WHEN** a user hovers over an agent table row
- **THEN** the row background transitions smoothly with a subtle elevation change

#### Scenario: Toast animation
- **WHEN** a toast notification appears or disappears
- **THEN** the toast slides in from the right and fades out on dismiss

