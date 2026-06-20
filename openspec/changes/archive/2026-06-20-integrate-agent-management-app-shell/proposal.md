## Why

Agent Management currently has backend lifecycle logic and a framework-agnostic UI renderer, but there is no React/Vite application shell to view the feature in a browser. This change creates the first runnable frontend surface so the team can manually inspect the Agent Management screen before API and persistence work begins.

## What Changes

- Add a React + Vite frontend app shell if the repository does not already have one.
- Add an Agent Management page that mounts the existing Agent Management UI in the browser.
- Seed the page with mock agent data for manual visual testing.
- Add a browser/manual-test path for checking the list, create/edit surface, status display, and lifecycle action controls.
- Keep backend API integration, persistence, RBAC, and OpenClaw skill writing out of scope for this change.

## Capabilities

### New Capabilities

- `agent-management-app-shell`: Runnable React/Vite Agent Management page with mock data and manual browser verification.

### Modified Capabilities

- None.

## Impact

- Frontend app shell under `frontend`.
- Agent Management frontend feature under `frontend/src/features/agent-management`.
- Package scripts and dependency metadata needed to run the browser app.
- Tests or verification commands for the app shell and existing Agent Management contracts.
