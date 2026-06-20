## Context

Agent Management already has a completed foundation change with domain logic, lifecycle use cases, a public summary contract, a framework-agnostic UI renderer, CSS, and contract tests. The repository architecture foundation selects TypeScript with React + Vite for the frontend, but the current repo does not yet provide a runnable browser app shell.

This change is the first follow-up item from `docs/agent-management-work-plan.md`: make the Agent Management UI visible in a browser with mock data before introducing HTTP APIs, persistence, RBAC, or OpenClaw runtime writes.

## Goals / Non-Goals

**Goals:**

- Add a minimal React + Vite app shell under the existing `frontend` boundary.
- Add an Agent Management page that renders the existing list/form/action experience in a browser.
- Use mock agent data so manual UI testing does not depend on backend API work.
- Provide scripts and instructions for local browser verification.
- Keep existing Agent Management contract tests passing.

**Non-Goals:**

- Do not add Express API routes.
- Do not add Prisma/PostgreSQL persistence.
- Do not connect to Authentication, Workspace, RBAC, or OpenClaw.
- Do not implement real create/edit/enable/disable/delete mutations against backend state.

## Decisions

1. Build the app shell with React + Vite inside `frontend`.
   - Rationale: The architecture foundation selected React + Vite, and the app shell should match that decision before later UI/API integration work.
   - Alternative considered: Keep generating static HTML files for preview. Rejected because the next roadmap phases need an actual browser app surface.

2. Render Agent Management with mock data only.
   - Rationale: This change is for visual/manual shell validation. API integration has its own planned OpenSpec change, so mock data keeps the scope small and independently testable.
   - Alternative considered: Add API routes at the same time. Rejected because it would combine app-shell and backend-interface decisions in one change.

3. Keep the frontend runtime boundary clean.
   - Rationale: Vite browser code should import frontend code and shared contracts, not backend module internals at runtime.
   - Alternative considered: Mount the existing HTML string directly with raw HTML injection. Rejected because a React page should use React rendering patterns and remain ready for stateful controls.

4. Treat lifecycle action buttons as non-mutating UI controls for this phase.
   - Rationale: Enable, disable, and delete controls need to be visible for manual inspection, but real behavior belongs to the UI-to-API phase.
   - Alternative considered: Mutate local mock state now. Rejected because it can create misleading behavior before the backend API contract exists.

## Risks / Trade-offs

- [Risk] The page may look complete even though actions do not persist changes -> Mitigation: label this change as app-shell-only in README/manual test notes.
- [Risk] Adding Vite dependencies changes package setup -> Mitigation: keep scripts minimal and verify with `npm test` plus a frontend build/dev smoke check.
- [Risk] Existing framework-agnostic UI code may need small boundary cleanup for Vite -> Mitigation: keep reusable view-model code, but ensure browser runtime imports stay inside frontend/shared boundaries.
