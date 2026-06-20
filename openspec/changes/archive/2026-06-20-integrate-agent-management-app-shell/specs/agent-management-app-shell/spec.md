## ADDED Requirements

### Requirement: React Vite App Shell
The system SHALL provide a React + Vite frontend app shell that can be run locally in a browser.

#### Scenario: Frontend app starts
- **WHEN** a developer runs the documented frontend app command
- **THEN** the browser can load the React application without requiring backend API or database services

### Requirement: Agent Management Page
The system SHALL provide an Agent Management page mounted inside the frontend app shell.

#### Scenario: Agent Management page viewed
- **WHEN** a developer opens the frontend app in a browser
- **THEN** the app displays the Agent Management page with agent list, status, role, model, and form sections

### Requirement: Mock Agent Data Preview
The system SHALL render the Agent Management page with representative mock agent data for manual inspection.

#### Scenario: Mock agents displayed
- **WHEN** the Agent Management page loads before API integration exists
- **THEN** the page displays at least one enabled agent and one disabled agent using mock workspace-scoped data

### Requirement: Lifecycle Controls Preview
The system SHALL show Agent Management lifecycle controls in the browser preview.

#### Scenario: Lifecycle actions visible
- **WHEN** an agent row is displayed
- **THEN** the row shows the relevant enable, disable, and delete controls based on the agent status

### Requirement: Manual Browser Verification
The system SHALL document how to manually verify the Agent Management app shell in a browser.

#### Scenario: Manual test instructions followed
- **WHEN** a developer follows the documented manual test steps
- **THEN** they can verify the page renders, the mock list is visible, the form is visible, and lifecycle controls are visible
