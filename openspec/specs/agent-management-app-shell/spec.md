## Purpose

Define the browser-runnable Agent Management app shell and its local API-backed development behavior.

## Requirements

### Requirement: React Vite App Shell
The system SHALL provide a React + Vite frontend app shell that can run locally with the Agent Management in-memory API.

#### Scenario: Frontend and API start
- **WHEN** a developer runs the documented root development command
- **THEN** the browser can load the React application and reach Agent Management routes through the local API proxy without database services

### Requirement: Agent Management Page
The system SHALL provide an Agent Management page mounted inside the frontend app shell.

#### Scenario: Agent Management page viewed
- **WHEN** a developer opens the frontend app in a browser
- **THEN** the app displays the Agent Management page with agent list, status, role, model, and form sections

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
- **WHEN** an agent row is displayed
- **THEN** the row shows the relevant enable, disable, and delete controls based on the agent status

### Requirement: Manual Browser Verification
The system SHALL document how to manually verify the API-backed Agent Management app shell in a browser.

#### Scenario: Manual test instructions followed
- **WHEN** a developer follows the documented manual test steps
- **THEN** they can verify API-backed list, create, edit, lifecycle controls, validation feedback, and recoverable errors
