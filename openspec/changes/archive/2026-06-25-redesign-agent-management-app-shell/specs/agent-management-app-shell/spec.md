## MODIFIED Requirements

### Requirement: Agent Management Page
The system SHALL provide an Agent Management page mounted inside the frontend app shell with the Stitch-aligned dashboard presentation.

#### Scenario: Agent Management page viewed
- **WHEN** a developer opens the frontend app in a browser and navigates to Agent Management
- **THEN** the app displays the Agent Management page with a top app bar, hero banner, toolbar, agent list area, status indicators, and modal-based create/edit form access

#### Scenario: Redesigned page uses local assets and CSS
- **WHEN** the Agent Management page renders the redesigned presentation
- **THEN** it uses repository-local React, CSS, and asset references rather than Tailwind CDN, Material Symbols CDN, or remote runtime icon fonts

### Requirement: Lifecycle Controls Preview
The system SHALL show Agent Management lifecycle controls in the redesigned browser preview.

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

## ADDED Requirements

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
