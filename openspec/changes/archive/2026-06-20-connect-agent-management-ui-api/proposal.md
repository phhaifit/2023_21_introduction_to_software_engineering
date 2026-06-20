## Why

The Agent Management page currently renders static mock data and prevents every form and lifecycle action from reaching the completed HTTP API. Connecting the browser UI to a local in-memory backend now creates the first usable end-to-end feature slice and exposes the runtime states needed before persistence and RBAC integration.

## What Changes

- Add a typed Agent Management frontend API client for list, create, configuration read, update, enable, disable, and delete requests.
- Replace the page's default mock-data source with API-backed React state for the current demo workspace.
- Wire create, edit, enable, disable, and delete controls to their HTTP operations and refresh the active list after successful mutations.
- Add loading, submitting, empty, field-validation, and general-error states without discarding user-entered form values on failure.
- Add a workspace-scoped configuration-read endpoint so the edit form can load private instructions without exposing them in public list or mutation summaries.
- Add a local Express composition root and Vite proxy so the browser can exercise the frontend and in-memory backend together during development.
- Add tests together with each API client, React interaction, backend configuration-read, and local integration behavior.

## Capabilities

### New Capabilities

- `agent-management-ui-api-integration`: Covers API-backed page loading, form submissions, lifecycle mutations, UI runtime states, edit configuration loading, and the local in-memory browser integration boundary.

### Modified Capabilities

- `agent-management-app-shell`: Replaces the default browser mock-data preview with API-backed rendering while retaining mock fixtures only for isolated tests and stories.

## Impact

- Affects `frontend/src/features/agent-management/**`, the React app shell, Vite development configuration, and frontend contract/component tests.
- Extends `backend/src/modules/agent-management/**` with configuration-read behavior and adds a local Express server composition root backed by `InMemoryAgentRepository`.
- Reuses the shared `ApiResponse` and Agent Management public contracts; introduces an internal editable-configuration response type that must not be used as a public summary.
- Does not add Prisma/PostgreSQL persistence, real authentication/RBAC, production server deployment, or OpenClaw workspace writes.
