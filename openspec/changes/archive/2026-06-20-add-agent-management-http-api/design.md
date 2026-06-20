## Context

Agent Management already owns domain rules, lifecycle use cases, an in-memory repository for tests, public summary contracts, and a React/Vite app shell with mock data. The next step is to expose the lifecycle use cases through an HTTP API so a later frontend integration change can replace mock data with backend calls.

The repository currently has backend module boundaries and shared `ApiResponse` contracts, but it does not yet have Agent Management HTTP routes or a concrete Express app wiring for this module.

## Goals / Non-Goals

**Goals:**

- Add an Express-compatible Agent Management router under the backend Agent Management module.
- Expose workspace-scoped endpoints for list, create, update, enable, disable, and delete.
- Return all API responses using the shared `ApiResponse` envelope.
- Use a replaceable mock request context boundary for workspace/current-user data until real Authentication/RBAC integration exists.
- Keep route tests in the same change as the route behavior.

**Non-Goals:**

- Do not add Prisma/PostgreSQL persistence.
- Do not connect the React UI to these APIs.
- Do not implement real Authentication/RBAC enforcement.
- Do not write `skill.md` files to OpenClaw/workspace storage.
- Do not call Docker/OpenClaw or any external runtime from HTTP handlers.

## Decisions

1. Use an Express router owned by `backend/src/modules/agent-management`.
   - Rationale: The project architecture expects one backend API with capability-owned module boundaries. Keeping the router in the Agent Management module avoids leaking private services across modules.
   - Alternative considered: Add ad hoc handlers at the backend root. Rejected because it weakens capability ownership and makes later module integration harder.

2. Mount routes under a workspace-scoped prefix.
   - Planned shape: `/api/workspaces/:workspaceId/agents`.
   - Rationale: `workspaceId` is the tenant boundary for agent data. Putting it in the route makes scoping explicit for API tests and later frontend clients.
   - Alternative considered: Derive workspace only from session context. Rejected for this phase because real auth/session plumbing is not implemented yet.

3. Return public API payloads, not private configuration internals.
   - List returns active agent list items.
   - Mutations return public agent summaries.
   - Rationale: `instructions` and generated skill configuration are implementation/configuration details. The public summary contract is already available for safe cross-boundary use.

4. Use a mock request context boundary for this change.
   - Rationale: Phase 2 needs usable API behavior without blocking on Authentication, Workspace, and RBAC changes. The mock context should be isolated so the later RBAC/workspace integration change can replace it.
   - Alternative considered: Implement real permission checks now. Rejected because that combines two planned roadmap phases and would force imports from modules that are not ready.

5. Map known lifecycle errors to the existing shared error codes.
   - Validation errors map to `validation.invalid_input`.
   - Missing or unavailable agents map to `agent.not_available`.
   - Unexpected errors map to `system.unexpected_error`.
   - Rationale: This avoids changing shared API contracts before there is a reviewed need for new error codes.

## Risks / Trade-offs

- [Risk] The mock request context may look like real authorization.
  - Mitigation: Keep it explicitly named as mock/test context and document that real RBAC is out of scope.
- [Risk] API handlers could accidentally expose private `instructions` or generated skill content.
  - Mitigation: Route responses use public summaries/list items only, and tests assert response shape.
- [Risk] Adding Express changes package dependencies.
  - Mitigation: Keep dependency additions minimal and verify with `npm test` plus focused API tests.
- [Risk] Later persistence may require repository wiring changes.
  - Mitigation: Inject lifecycle use cases/repository into the router factory so persistence can be swapped without rewriting route behavior.
