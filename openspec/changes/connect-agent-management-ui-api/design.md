## Context

Agent Management now has a React/Vite page, lifecycle use cases, an in-memory repository, and workspace-scoped Express routes. The page still receives static mock input, form submission is prevented, and lifecycle buttons do not call the backend. Vite also has no backend process or proxy, so the existing API is reachable only from contract tests.

The list and mutation routes intentionally return public summaries without `instructions`. Editing an existing agent therefore needs a separate configuration-read boundary; reusing a public summary or caching mock instructions would either leak private data into the wrong contract or lose the current instructions after reload.

## Goals / Non-Goals

**Goals:**

- Make the browser page load and mutate workspace agents through HTTP.
- Preserve the existing pure view-model boundary while adding React-owned asynchronous state.
- Provide complete create, edit, enable, disable, and delete interactions with loading and error feedback.
- Add the minimum private configuration-read contract needed by the edit form.
- Provide one local command that runs Vite and an in-memory Express API together.
- Add focused route, API-client, and React interaction tests with each behavior.

**Non-Goals:**

- Do not add Prisma/PostgreSQL persistence or migration files.
- Do not implement real authentication, permissions, or workspace membership checks.
- Do not add Playwright coverage in this change.
- Do not add production deployment/server composition.
- Do not write skill configuration to OpenClaw or workspace storage.

## Decisions

1. Add an injectable frontend API client built on native `fetch`.
   - The client owns route construction, JSON serialization, `ApiResponse` parsing, and typed API errors.
   - The page receives a client and `workspaceId` from the app boundary, with browser defaults supplied by `App`.
   - Alternative: call `fetch` directly from each click handler. Rejected because it duplicates envelope/error handling and makes component tests brittle.

2. Keep the existing view model pure and let the React page own server state.
   - The page owns agents, selected agent, form values/errors, initial-load state, edit-load state, and mutation state.
   - The view model continues deriving labels, available actions, and presentation data.
   - Alternative: move networking into the view-model module. Rejected because that would mix deterministic presentation logic with side effects.

3. Reload the list after every successful mutation.
   - Create, update, enable, disable, and delete call the API and then request the canonical active list.
   - Mutation controls remain disabled while the operation and refresh are pending.
   - Alternative: optimistic list updates. Rejected for this phase because canonical reload is simpler and avoids divergence from lifecycle filtering rules.

4. Add a dedicated editable-configuration read boundary.
   - Add an application use case and `GET /api/workspaces/:workspaceId/agents/:agentId/configuration` route returning name, role, model, instructions, status, and update metadata.
   - The route remains workspace-scoped, maps unavailable agents to `agent.not_available`, and never returns generated skill configuration.
   - Public list and mutation routes remain unchanged and continue returning only public summaries.
   - Alternative: leave instructions blank when editing. Rejected because update requires instructions and would force users to overwrite valid configuration blindly.

5. Use a local Express process plus a Vite `/api` proxy.
   - The local API composition root creates one `InMemoryAgentRepository`, lifecycle use cases, representative seed agents, and the Agent Management router.
   - The root development command runs the API and Vite processes together; Vite proxies `/api` to the local API port.
   - The repository is intentionally reset whenever the local API process restarts.
   - Alternative: mount Express inside Vite middleware. Rejected because a separate composition root more closely matches the future production backend boundary.

6. Separate tests by boundary.
   - Route contract tests cover configuration-read workspace scoping and private response shape.
   - API-client tests cover methods, URLs, payloads, success envelopes, and typed failures using an injected fetch implementation.
   - React component tests in jsdom cover loading, create/edit, lifecycle actions, refreshes, validation, general failures, confirmation, and duplicate-submit prevention.
   - Manual browser verification covers the complete in-memory flow; Playwright remains deferred.

## Risks / Trade-offs

- [Risk] The configuration endpoint exposes private instructions while authorization is still mocked. -> Keep it under the workspace route, document it as local/mock-context only, exclude generated skill content, and replace the context in the RBAC change.
- [Risk] Multiple overlapping list requests can render stale results. -> Serialize mutation-plus-refresh operations and ignore or cancel superseded initial/edit requests.
- [Risk] Users may submit the same mutation repeatedly. -> Disable relevant controls while a mutation is pending and test single invocation behavior.
- [Risk] In-memory data disappears after API restart. -> Document reset behavior and reserve durability for the Prisma change.
- [Risk] Running two development processes adds script complexity. -> Use one root command with fixed documented ports and terminate both processes together.

## Migration Plan

1. Add the configuration-read use case and route with contract tests.
2. Add the frontend API client and isolated tests.
3. Convert the page from mock input to API-backed state one interaction at a time, adding component tests for each behavior.
4. Add the local API composition root, Vite proxy, seed data, and manual test guide.
5. Remove mock data from the browser default while retaining fixtures for isolated tests.

Rollback is limited to restoring the mock input as the page default and removing the local API/proxy scripts; the underlying lifecycle API remains compatible.

## Open Questions

- Real workspace selection and authorization remain intentionally unresolved until the RBAC/workspace integration change; this change uses the existing demo workspace id at the app boundary.
