## ADDED Requirements

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
