## MODIFIED Requirements

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

## ADDED Requirements

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
