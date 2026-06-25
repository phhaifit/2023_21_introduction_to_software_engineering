## Why

Agent Management has a complete CRUD lifecycle (create, update, enable, disable, delete) with persistence, skill-file writing, and a redesigned app shell. However, the toolbar controls (search, filter, sort), pagination, rename, and duplicate remain disabled placeholders. The list endpoint returns all agents at once with a hardcoded sort, making the feature incomplete for workspaces with many agents. Completing these features brings Agent Management to production readiness and establishes the reference implementation pattern for other modules.

## What Changes

- Add server-side search (by name, role), status filtering, configurable sort, and cursor/offset pagination to the agent list API endpoint.
- Add a rename agent API endpoint that accepts a new name with workspace-scoped uniqueness enforcement.
- Add a duplicate agent API endpoint that clones an existing agent's configuration under a new unique name.
- Enable and wire the toolbar search input with debounced server-side search.
- Enable and wire the toolbar filter button with a status dropdown (Enabled, Disabled, All).
- Enable and wire the toolbar sort button with sort options (Name A-Z, Last modified, Created date).
- Add pagination controls below the agent table (page size selector, prev/next, page indicator).
- Wire the Rename action in the row action menu to an inline-edit or modal flow with validation.
- Wire the Duplicate action in the row action menu to call the clone endpoint and refresh the list.
- Improve UI/UX polish: add micro-animations on row hover/expand, smooth modal transitions, toast notifications for mutation feedback, and empty-search-result messaging.

## Capabilities

### New Capabilities
- `agent-list-query`: Server-side search, filter, sort, and pagination for the agent list endpoint. Covers query parameter parsing, repository query building, paginated response envelope, and frontend toolbar wiring.
- `agent-rename`: Rename an existing agent with workspace-scoped name uniqueness validation. Covers the API endpoint, use case, frontend inline-edit or modal flow, and optimistic UI update.
- `agent-duplicate`: Clone an existing agent's configuration under a new auto-generated unique name. Covers the API endpoint, use case, frontend action menu wiring, and skill-file writing for the clone.

### Modified Capabilities
- `agent-management`: Update the agent creation scenario to reference the new query capabilities. Add rename and duplicate requirements to the agent lifecycle.
- `agent-management-http-api`: Add query parameter documentation for the list endpoint. Add PATCH name and POST duplicate route specifications.
- `agent-management-app-shell`: Enable toolbar controls, add pagination component, wire rename/duplicate in the row action menu, add toast notifications and micro-animations.
- `agent-management-ui-api-integration`: Update the frontend API client to support query parameters, rename, and duplicate calls. Update E2E tests for the new flows.
- `agent-management-persistence`: Extend repository interface with search, sort, and paginated query methods.

## Impact

- **Backend API**: New query parameters on `GET /api/workspaces/:workspaceId/agents` (`search`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize`). New `PATCH /:agentId/name` endpoint. New `POST /:agentId/duplicate` endpoint. Response envelope changes to use `ApiPaginatedSuccess` from shared contracts.
- **Repository layer**: `listByWorkspace` signature changes to accept search, sort, and pagination options. Prisma queries updated for `LIKE` search, dynamic `orderBy`, and `skip`/`take` pagination. New `countByWorkspace` method for total count.
- **Frontend API client**: Updated `listAgents()` to accept query params. New `renameAgent()` and `duplicateAgent()` methods.
- **Frontend UI**: Toolbar controls become interactive. Pagination component added. Row action menu items become functional. Toast notification system added for mutation feedback. CSS micro-animations added.
- **Shared contracts**: No new shared contract types needed — `ApiPaginatedSuccess` and `ApiPaginationMeta` already exist in `@vcp/shared/contracts/api.ts`.
- **Dependencies**: No new npm packages required.
- **Tests**: Contract tests for new query/rename/duplicate endpoints. Component tests for toolbar, pagination, rename, duplicate flows. E2E tests updated for full interactive flows.
