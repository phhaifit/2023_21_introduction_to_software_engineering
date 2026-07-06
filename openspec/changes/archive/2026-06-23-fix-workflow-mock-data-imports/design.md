## Context

The frontend currently has Workflow Management and Dashboard components that import `mockWorkflows` from `apps/frontend/src/data/workflows` / `apps/frontend/src/data/workflows.ts`. That module is missing, so Vite cannot resolve the imports and the root verification flow fails before the team can safely continue feature or foundation work.

This change is an integration repair. It stabilizes the current frontend build and test surface without claiming that Workflow Management has a real backend API, persistence model, workflow editor behavior, or execution runtime.

## Goals / Non-Goals

**Goals:**

- Make `npm test`, `npm run build`, and local Vite module loading pass again from the root.
- Provide a compatible workflow mock data source for the existing Dashboard and Workflow Management UI.
- Keep the repair small enough to review and rollback independently.
- Add focused tests that fail if the workflow data import disappears again.

**Non-Goals:**

- Implement Workflow Management backend APIs, persistence, or execution behavior.
- Define final Workflow shared contracts or Prisma models.
- Replace all frontend mock data patterns across the repository.
- Add external AI, OpenClaw, worker, or database behavior.

## Decisions

### Restore a compatible workflow mock data module first

Use a conservative compatibility repair for the missing `mockWorkflows` import. The implementation should either restore `apps/frontend/src/data/workflows.ts` or provide an equivalent source with updated imports, but it must keep the current Dashboard and Workflow Management screens working without introducing a backend dependency.

Alternative considered: move all workflow mock data into `apps/frontend/src/features/workflow-management/`. This is cleaner for long-term module ownership, but the Dashboard currently consumes the same data and would either need a cross-feature private import or additional shared frontend fixture conventions. That belongs in a later foundation or Workflow feature change, not this blocker fix.

### Treat mock data as temporary integration support

The restored workflow mock data must be documented in tests and code usage as frontend/demo data. It must not be presented as the final Workflow Management domain contract.

Alternative considered: start the real `implement-workflow-management` backend/API work immediately. That would widen the scope and delay repairing master, so it is explicitly excluded.

### Verify the root developer contract

The repair must be validated through the commands developers use from the repository root: `npm test`, `npm run build`, `npm run dev`, OpenSpec validation, and `git diff --check`.

## Risks / Trade-offs

- Mock data can continue drifting from the future Workflow API -> keep this change scoped to build stability and require later Workflow feature work to replace or align the fixture.
- Restoring `apps/frontend/src/data/workflows.ts` may preserve a non-module-owned data location -> acceptable as a short-term blocker fix; document future migration to module-owned fixtures or API-backed data.
- Component tests may overfit current display text -> focus tests on renderability, empty state, and import stability rather than exact visual layout.

## Migration Plan

1. Reproduce the failure from the latest clean `master`.
2. Restore or relocate the workflow mock data source.
3. Update imports only if the data source path changes.
4. Add focused frontend tests for Dashboard and Workflow list behavior.
5. Run verification gates.
6. Open a small PR labeled as integration repair.

Rollback is straightforward: revert this change PR. Because the change does not add backend/database/shared contract behavior, rollback should only affect frontend mock data and tests.

## Open Questions

- Should later Workflow Management implementation replace this compatibility fixture with API-backed data, or should the fixture remain only for isolated tests?
