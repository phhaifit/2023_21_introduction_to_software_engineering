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

### Requirement: Guided Create Agent Modal
The system SHALL provide a guided creation modal for manual template, prompt assistant, and `skill.md` import flows.

#### Scenario: Guided modal opened
- **WHEN** a manager activates New Agent
- **THEN** the page opens a guided create modal with options for template creation, prompt assistant creation, and `skill.md` import

#### Scenario: Existing configure modal preserved
- **WHEN** a manager configures an existing agent
- **THEN** the existing configure flow remains available and does not require the assistant flow

### Requirement: Assistant Prompt View
The guided modal SHALL provide a prompt-based assistant view.

#### Scenario: Prompt submitted
- **WHEN** a manager enters a natural-language description and submits it
- **THEN** the modal shows loading state until the assistant returns a draft, clarification, warning, or retryable error

#### Scenario: Clarifying questions displayed
- **WHEN** the assistant returns clarifying questions
- **THEN** the modal displays those questions and lets the manager provide additional answers before creating an agent

### Requirement: Skill Import View
The guided modal SHALL provide a free-form Markdown `skill.md` import view.

#### Scenario: Markdown import pasted or selected
- **WHEN** a manager pastes Markdown or selects a Markdown file
- **THEN** the modal sends the content for import analysis and displays the extracted draft for review

#### Scenario: Invalid import visible
- **WHEN** the imported Markdown is empty or cannot be analyzed
- **THEN** the modal displays an error and preserves the user's ability to retry

### Requirement: Draft Review and Preview View
The guided modal SHALL provide a review view with editable fields, model selection, warnings, and `skill.md` preview.

#### Scenario: Review view displayed
- **WHEN** a draft exists
- **THEN** the modal displays editable name, role, model, instructions, requested tools, requested knowledge, warnings, and the generated Markdown preview

#### Scenario: Create blocked by warnings
- **WHEN** the draft has blocking warnings
- **THEN** the modal keeps the Create Agent action disabled and explains what must be fixed

### Requirement: Assistant UI Accessibility
The guided modal SHALL remain accessible through semantic dialogs, labels, roles, and keyboard-reachable controls.

#### Scenario: Accessible guided modal
- **WHEN** assistive technologies inspect the guided creation modal
- **THEN** the modal exposes a dialog name, labeled fields, button names, status messages, and warning messages through accessible semantics

### Requirement: Agent Management Setup Workspace Hierarchy
The system SHALL present Agent Management as a friendly setup and configuration workspace with a clear hierarchy for setup context, agent status, list controls, and primary actions.

#### Scenario: Setup banner supports creation
- **WHEN** a manager opens the Agent Management page
- **THEN** the first viewport shows a compact `agents-hero.png` setup banner, page title, current-workspace agent summary, primary create action, and agent list controls without requiring the user to scroll past a dominant decorative hero

#### Scenario: Agent status summary is scannable
- **WHEN** the Agent Management page has loaded agents
- **THEN** the page shows enabled, disabled, and total agent counts in a compact summary that does not replace the paginated list as the primary setup and configuration surface

#### Scenario: Summary information is not duplicated
- **WHEN** the Agent Management page renders the setup banner and agent list in the same viewport
- **THEN** total, enabled, and disabled agent counts are presented in one clear summary region instead of being duplicated in both the banner and the list panel

### Requirement: Refined Agent List Presentation
The system SHALL keep the Agent table as the primary list surface while making it more polished, readable, and friendly.

#### Scenario: Desktop list remains comparable
- **WHEN** the page renders at a desktop width
- **THEN** agent name, role, model, status, updated metadata, and row actions are aligned for quick comparison across rows

#### Scenario: Narrow list remains usable
- **WHEN** the page renders at a narrow viewport
- **THEN** each agent still exposes name, role, model, status, updated metadata, and lifecycle actions without causing unreadable horizontal overflow

#### Scenario: Row states are visually distinct
- **WHEN** a row is enabled, disabled, selected, hovered, focused, or pending mutation
- **THEN** the row presents a distinct visual state that does not rely on color alone

### Requirement: Agent Info Popup
The system SHALL show an Agent information popup when a user selects an Agent row.

#### Scenario: Agent row opens popup
- **WHEN** a user selects an Agent row
- **THEN** the page opens an Agent Info Popup with agent name, role, model, status, updated metadata, and available actions

#### Scenario: Popup presents agent profile
- **WHEN** the Agent Info Popup is visible
- **THEN** the popup presents the selected Agent as a readable profile view rather than immediately opening edit mode

#### Scenario: Manager actions are available
- **WHEN** a manager views the Agent Info Popup
- **THEN** configure, rename, duplicate, enable, disable, and delete actions are available according to the selected Agent status

#### Scenario: Popup avoids execution concerns
- **WHEN** a user views the Agent Info Popup
- **THEN** the popup does not present run, assign task, execute workflow, provision runtime, runtime status, task history, or execution result controls

#### Scenario: Viewer popup is read only
- **WHEN** a viewer opens the Agent Info Popup
- **THEN** the popup shows Agent information without mutation actions

#### Scenario: Popup dismissed
- **WHEN** a user closes the Agent Info Popup without choosing an action
- **THEN** no create, update, rename, duplicate, enable, disable, or delete API call is made by that close action

### Requirement: Refined Toolbar And Filter Controls
The system SHALL make Agent Management search, filter, sort, view, and pagination controls compact, discoverable, and keyboard reachable.

#### Scenario: Toolbar controls remain visible
- **WHEN** a user scans the Agent Management list area
- **THEN** search, status filter, sort, view controls, and pagination affordances are grouped near the list and remain visually associated with list results

#### Scenario: Filter state is understandable
- **WHEN** a search query or filter is active
- **THEN** the page makes the active query or filter state visible and provides a clear way to reset it

### Requirement: Modal Flow Usability
The system SHALL refine Agent Management create, configure, rename, delete, assistant, import, draft review, and Agent Info Popup dialogs for usable scanning and completion.

#### Scenario: Guided create modal is readable
- **WHEN** a manager opens the guided create modal
- **THEN** template, prompt assistant, import, draft review, warning, and `skill.md` preview areas are organized so the primary next action is clear

#### Scenario: New Agent modal feels like a creation workspace
- **WHEN** a manager opens the New Agent modal
- **THEN** the modal presents a polished creation workspace with a clear header, intentional mode selector, grouped form sections, styled inputs, helper text, useful preview area, and a persistent primary action path

#### Scenario: Template mode avoids raw prototype controls
- **WHEN** a manager uses Template mode in the New Agent modal
- **THEN** identity, role, model, responsibilities, operating context, instructions, requested tools, requested knowledge, and constraints are visually grouped with consistent app-styled controls rather than unstyled native form controls

#### Scenario: Preview guides incomplete drafts
- **WHEN** the New Agent draft is incomplete
- **THEN** the `skill.md` preview area shows a helpful incomplete-state or draft outline that explains what is missing instead of a large empty panel

#### Scenario: Prompt Assistant is ergonomic
- **WHEN** a manager selects Prompt Assistant mode
- **THEN** the interface provides a comfortable description input, clear guidance, generate action, pending state, and visible path to review the generated draft without leaving excessive unused space

#### Scenario: Import workflow is intentional
- **WHEN** a manager selects Import `skill.md` mode
- **THEN** the interface presents a styled file selection or drop area, readable Markdown input, clear analyze action, validation feedback, and a visible path from parsed content to draft review

#### Scenario: Modal actions remain reachable
- **WHEN** the New Agent modal content scrolls on desktop or narrow viewports
- **THEN** cancel, next, create, or other primary actions remain reachable without requiring users to scroll unpredictably to the bottom of a long form

#### Scenario: Modal adapts to narrow viewport
- **WHEN** a modal is opened on a narrow viewport
- **THEN** the modal content remains readable, scrollable, and actionable without controls overlapping or escaping the viewport

#### Scenario: Destructive confirmation is explicit
- **WHEN** a manager opens the delete confirmation dialog
- **THEN** the dialog presents the agent name, consequence text, cancel action, and destructive action with clear visual hierarchy

#### Scenario: Modal stacking avoided
- **WHEN** a user starts configure, rename, or delete from the Agent Info Popup
- **THEN** the interface avoids stacking multiple active dialogs in a way that traps focus or obscures the active dialog flow

### Requirement: Interaction And Motion Polish
The system SHALL provide polished interaction states for Agent Management without introducing distracting or inaccessible motion.

#### Scenario: Interactive controls have feedback
- **WHEN** a user hovers, focuses, presses, disables, or waits on Agent Management controls
- **THEN** buttons, menus, filters, rows, dialogs, and toasts provide visible feedback appropriate to the state

#### Scenario: Reduced motion is respected
- **WHEN** the user has requested reduced motion in the operating system or browser
- **THEN** nonessential Agent Management animations are removed or shortened while preserving state clarity

### Requirement: Agent Management Accessibility Quality
The system SHALL meet practical WCAG 2.2 AA-oriented accessibility expectations for the refined Agent Management page.

#### Scenario: Keyboard operation works
- **WHEN** a keyboard user navigates the Agent Management page
- **THEN** toolbar controls, pagination, row action menus, dialogs, and mutation actions are reachable and operable in a logical order

#### Scenario: Focus remains visible
- **WHEN** any interactive Agent Management control receives keyboard focus
- **THEN** the focus indicator is visible and not hidden by layout, color, or overflow styling

#### Scenario: Accessible names remain stable
- **WHEN** tests or assistive technologies inspect Agent Management controls
- **THEN** icon buttons, row action menus, dialogs, toast messages, loading states, and empty states expose stable accessible names or roles

#### Scenario: Contrast and touch targets are sufficient
- **WHEN** the refined UI is rendered
- **THEN** text, status indicators, controls, and icons meet readable contrast expectations and primary touch/click targets are at least 44 by 44 CSS pixels where practical

