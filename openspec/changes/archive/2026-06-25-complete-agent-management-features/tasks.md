## 1. Backend — Repository Query Extension

- [x] 1.1 Extend `AgentListFilters` type with `search?: string`, `sortBy?: string`, `sortOrder?: "asc" | "desc"`, `page?: number`, `pageSize?: number` fields and add `AgentPaginatedResult` return type with `agents: Agent[]` and `total: number`.
- [x] 1.2 Add `countByWorkspace(workspaceId, filters)` method to the `AgentRepository` interface.
- [x] 1.3 Update `InMemoryAgentRepository.listByWorkspace` to support search (substring match on name/role), sort (by name, createdAt, updatedAt, status), and pagination (offset/limit). Implement `countByWorkspace`.
- [x] 1.4 Update `PrismaAgentRepository.listByWorkspace` to support Prisma `contains` (mode insensitive) for search, dynamic `orderBy` for sort, and `skip`/`take` for pagination. Implement `countByWorkspace` using Prisma `count`.
- [x] 1.5 Add contract tests for repository search, sort, pagination, and count using in-memory repository.

## 2. Backend — Rename Use Case and Endpoint

- [x] 2.1 Add `renameAgent(input: { workspaceId, agentId, name })` method to `AgentLifecycleUseCases` with name validation, uniqueness check (via `existsByName`), same-name no-op, deleted-agent rejection, timestamp update, and skill file rewrite.
- [x] 2.2 Add `PATCH /:agentId/name` route to `agent-management-router.ts` with `enforcePermission("agents:manage")`, reading `name` from the request body.
- [x] 2.3 Add contract tests for rename: successful rename, duplicate name rejection, empty name rejection, deleted agent rejection, same-name no-op.

## 3. Backend — Duplicate Use Case and Endpoint

- [x] 3.1 Add a `generateUniqueCopyName(workspaceId, baseName)` helper in the use case that appends `" (Copy)"` and increments until a unique name is found using `existsByName`.
- [x] 3.2 Add `duplicateAgent(input: { workspaceId, agentId })` method to `AgentLifecycleUseCases` that reads the source agent, generates a unique copy name, creates a new agent with cloned config, writes the skill file, and returns the mutation result.
- [x] 3.3 Add `POST /:agentId/duplicate` route to `agent-management-router.ts` with `enforcePermission("agents:manage")`.
- [x] 3.4 Add contract tests for duplicate: successful clone, deleted source rejection, name collision resolution, not-found source.

## 4. Backend — Paginated List Endpoint

- [x] 4.1 Update `listAgents` in `AgentLifecycleUseCases` to accept query options (search, status, sortBy, sortOrder, page, pageSize) with defaults (page=1, pageSize=20, sortBy=createdAt, sortOrder=asc, status=["enabled","disabled"]), validate `sortBy` against allowed fields, and return `{ items: AgentListItem[], pagination: ApiPaginationMeta }`.
- [x] 4.2 Update `GET /` route in `agent-management-router.ts` to parse query parameters (`req.query.search`, `req.query.status`, `req.query.sortBy`, `req.query.sortOrder`, `req.query.page`, `req.query.pageSize`) and return `ApiPaginatedSuccess` envelope.
- [x] 4.3 Add contract tests for list endpoint: default pagination, custom page/pageSize, search filtering, status filtering, sort ordering, invalid sortBy rejection, page-beyond-total returns empty.

## 5. Frontend — API Client Updates

- [x] 5.1 Update `listAgents()` in `agent-management-api-client.ts` to accept `options?: ListAgentsOptions` and return `{ items: AgentListItem[], pagination: ApiPaginationMeta }`.
- [x] 5.2 Update the `request` function to return `{ data, meta }` instead of just `data`, extracting pagination from `body.meta.pagination`.
- [x] 5.3 Add `renameAgent(workspaceId, agentId, name)` to `AgentManagementApiClient`.
- [x] 5.4 Add `duplicateAgent(workspaceId, agentId)` to `AgentManagementApiClient`.
- [x] 5.5 Add unit tests in `tests/component/agent-management-api-client.test.ts` to cover query string construction and paginated response parsing.

## 6. Frontend — Toast Notification Component

- [x] 6.1 Create a `Toast` component with success/error variants, auto-dismiss (4s for success, persistent for error), dismiss button, slide-in-from-right animation, and fixed bottom-right positioning.
- [x] 6.2 Create a `useToast()` hook or context provider that manages toast stack state and exposes `showSuccess(message)` and `showError(message)` methods.
- [x] 6.3 Add CSS for toast animations (slide-in, fade-out) and stacking layout.

## 7. Frontend — Toolbar Search, Filter, and Sort

- [x] 7.1 Add query state management to the Agent Management page: `search`, `statusFilter`, `sortBy`, `sortOrder`, `page`, `pageSize` as React state, with URL sync if practical.
- [x] 7.2 Enable and wire the search input with 300ms debounce — on change, update `search` state and reset to page 1.
- [x] 7.3 Enable the filter button and implement a dropdown menu with options: All, Enabled, Disabled — on select, update `statusFilter` and reset to page 1.
- [x] 7.4 Enable the sort button and implement a dropdown menu with options: Name A-Z, Name Z-A, Last modified, Created date — on select, update `sortBy`/`sortOrder`.
- [x] 7.5 Add an empty-search-result state component with a "Clear filters" action that resets all query state.

## 8. Frontend — Pagination Component

- [x] 8.1 Create a `Pagination` component that displays current page, total pages, previous/next buttons, and a page size selector (10, 20, 50).
- [x] 8.2 Wire the pagination component below the agent table — on page change or page size change, update query state and re-fetch.
- [x] 8.3 Add CSS for pagination layout, button states, and responsive compact mode.

## 9. Frontend — Rename Flow

- [x] 9.1 Create a `RenameDialog` modal component with the current name pre-filled, a name input with validation error display, and Cancel/Save buttons.
- [x] 9.2 Wire the Rename action menu item to open the rename dialog (remove `disabled` and `aria-disabled` attributes).
- [x] 9.3 On submit, call `renameAgent()` API client method, show success toast on success, show validation error in dialog on failure, and refresh the agent list.

## 10. Frontend — Duplicate Flow

- [x] 10.1 Wire the Duplicate action menu item to call `duplicateAgent()` API client method (remove `disabled` and `aria-disabled` attributes).
- [x] 10.2 On success, show a success toast with the new agent name and refresh the agent list.
- [x] 10.3 On failure, show an error toast.

## 11. Frontend — Delete Confirmation Dialog

- [x] 11.1 Create a `ConfirmDeleteDialog` modal component with agent name, warning text, and Cancel/Delete buttons, replacing the current `window.confirm` usage.
- [x] 11.2 Wire the Delete action to open the confirmation dialog, call the delete API on confirm, show a success toast, and refresh the list.

## 12. Frontend — UI/UX Polish and Micro-Animations

- [x] 12.1 Add CSS transition for modal open/close: backdrop fade (150ms), modal scale+fade (150ms ease-out).
- [x] 12.2 Add CSS transition for table row hover: smooth background color change and subtle elevation.
- [x] 12.3 Replace all mutation callbacks (create, update, enable, disable, delete) to show toast notifications via `useToast()` instead of silent or alert-based feedback.
- [x] 12.4 Review overall visual polish: consistent spacing, focus-visible outlines, accessible color contrast, smooth transitions.

## 13. Testing and Verification

- [x] 13.1 Update component tests for toolbar interaction: search input fires debounced query, filter dropdown updates status filter, sort dropdown updates sort order.
- [x] 13.2 Add component tests for pagination: page navigation, page size change, boundary conditions.
- [x] 13.3 Add component tests for rename dialog: open/close, validation error display, successful rename.
- [x] 13.4 Add component tests for duplicate: action menu click triggers API call, success toast displayed.
- [x] 13.5 Add component tests for delete confirmation dialog: open, cancel, confirm.
- [x] 13.6 Add component tests for toast notifications: success auto-dismiss, error persist, dismiss button.
- [x] 13.7 Update E2E tests for search, filter, sort, pagination, rename, duplicate, and delete confirmation flows.
- [x] 13.8 Run `npm test`, `npm run build`, `openspec validate "complete-agent-management-features" --strict`, `openspec validate --all --strict`, `git diff --check` and record results.
