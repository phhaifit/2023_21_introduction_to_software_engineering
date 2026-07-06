## Context

Agent Management is the most mature module in the Virtual Company Platform with 17 archived changes covering domain, API, persistence, UI app shell, skill writer, and E2E tests. The current implementation supports full CRUD lifecycle but the toolbar controls (search, filter, sort), pagination, rename, and duplicate are disabled placeholders. The list endpoint (`GET /api/workspaces/:workspaceId/agents`) returns all agents at once with a hardcoded `createdAt ASC` sort order, making it unsuitable for workspaces with many agents.

Shared contracts already define `ApiPaginatedSuccess<T>` and `ApiPaginationMeta` in `@vcp/shared/contracts/api.ts`, but the agent module does not use them yet.

The current repository interface (`AgentRepository`) exposes `listByWorkspace(workspaceId, filters?)` with only a `statuses` filter array. The Prisma implementation hardcodes `orderBy: { createdAt: "asc" }`.

The frontend toolbar renders disabled `<input>` and `<button>` elements. The row action menu shows Rename and Duplicate as `disabled aria-disabled="true"` buttons.

## Goals / Non-Goals

**Goals:**
- Enable all disabled toolbar controls with server-side query support.
- Add offset-based pagination to the agent list with configurable page size.
- Allow renaming agents with workspace-scoped uniqueness validation.
- Allow duplicating agents by cloning configuration under a new unique name.
- Improve UI/UX with toast notifications, micro-animations, and empty-search-result states.
- Maintain backward compatibility — existing API consumers that omit query params get the same behavior.

**Non-Goals:**
- Grid view layout — deferred to a future change (requires card component design).
- Full-text search or fuzzy matching — simple `ILIKE` prefix/substring search is sufficient.
- Batch operations (multi-select enable/disable/delete).
- Real RBAC integration — viewer mode remains frontend-only until Workspace User Management is ready.
- Agent execution or OpenClaw runtime integration.

## Decisions

### Decision 1: Offset-based pagination over cursor-based

Use offset-based pagination (`page` + `pageSize` parameters) rather than cursor-based pagination.

**Rationale**: The agent list is displayed in a traditional table with page numbers. Users expect to jump to arbitrary pages. The total agent count per workspace is unlikely to exceed thousands, so offset performance is acceptable. The shared contracts already define `ApiPaginationMeta` with `page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage` which maps directly to offset-based pagination.

**Alternative considered**: Cursor-based pagination provides better performance for large datasets and consistent results during concurrent mutations, but adds complexity (opaque cursors, no page-number navigation) without clear benefit at this scale.

### Decision 2: Search via ILIKE substring match

Implement search as a case-insensitive substring match (`ILIKE '%term%'`) across `name` and `role` fields combined with OR.

**Rationale**: Simple, predictable, and sufficient for workspace-scoped agent lists (typically <100 agents). No external search infrastructure needed. Prisma supports `contains` with `mode: "insensitive"` natively.

**Alternative considered**: Full-text search (PostgreSQL `tsvector`) provides ranking and stemming but is over-engineered for this use case and adds schema migration complexity.

### Decision 3: Rename via dedicated PATCH endpoint

Add `PATCH /:agentId/name` as a separate endpoint rather than extending the existing `PATCH /:agentId` body.

**Rationale**: Name changes have unique validation semantics (workspace-scoped uniqueness check, different from config validation). Separating the endpoint keeps the existing update contract stable and makes the rename action explicit in audit logs. The existing `PATCH /:agentId` deliberately excluded `name` to prevent accidental renames during config updates.

**Alternative considered**: Adding `name` as an optional field to the existing `PATCH /:agentId` body is simpler but mixes two distinct mutation intents (config update vs. identity rename) and changes the existing API contract.

### Decision 4: Duplicate via POST endpoint that clones config

Add `POST /:agentId/duplicate` that reads the source agent's configuration, generates a unique name (e.g., `"Original Name (Copy)"`, incrementing if needed), and creates a new agent with the cloned config.

**Rationale**: The duplicate operation is a server-side concern because it must enforce name uniqueness and atomically create the new agent with a skill file. The client does not need to know the source agent's instructions (which are not in the list response).

**Alternative considered**: Client-side duplicate (fetch config → create with modified name) requires two round trips, exposes instructions to the client unnecessarily, and has a race condition on name uniqueness.

### Decision 5: Toast notification system for mutation feedback

Add a lightweight toast/snackbar notification component to replace `window.confirm` for delete confirmation and to provide success/error feedback for create, update, rename, duplicate, enable, disable, and delete operations.

**Rationale**: `window.confirm` blocks the UI thread and cannot be styled. Toast notifications are the standard UX pattern for non-blocking feedback. The component is simple enough to build without a third-party library.

### Decision 6: Debounced search input

The search input fires API requests after a 300ms debounce delay rather than on every keystroke.

**Rationale**: Prevents excessive API calls during typing. 300ms is the standard UX threshold that feels responsive without wasting network requests.

## Risks / Trade-offs

- **[Breaking pagination response]** → The list endpoint response shape changes from `{ data: Agent[] }` to `{ data: Agent[], meta: { pagination: {...} } }`. Mitigation: The frontend API client is the only consumer; update it in the same change. E2E tests updated together.
- **[Search performance at scale]** → `ILIKE '%term%'` cannot use standard B-tree indexes. Mitigation: At workspace scale (<1000 agents), full table scan within a workspace partition is fast. Add a GIN trigram index later if needed.
- **[Duplicate name collision race]** → Two concurrent duplicate requests could generate the same `"Name (Copy)"` name. Mitigation: The `existsByName` check + unique database constraint will reject the second request with a validation error, which the client handles gracefully.
- **[Toast component scope creep]** → Building a toast system could become complex. Mitigation: Keep it minimal — fixed bottom-right position, auto-dismiss after 4 seconds, single stack, no animation library. Reusable across modules.
