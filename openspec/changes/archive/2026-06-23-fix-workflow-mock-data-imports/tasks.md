## 1. Preparation

- [x] 1.1 Check repository state with `git status --short --branch`.
- [x] 1.2 Start from latest `master` with `git checkout master` and `git pull --ff-only origin master` only if the worktree is clean.
- [x] 1.3 Create an implementation branch for this change before editing application code.
- [x] 1.4 Confirm `.local-docs/` remains private and is not read, staged, committed, or pushed during implementation.

## 2. Reproduce and Confirm the Blocker

- [x] 2.1 Run `npm test` from the repository root and capture whether the workflow mock data import blocker is covered by the current test suite.
- [x] 2.2 Run `npm run build` from the repository root and confirm the frontend build fails on unresolved workflow data imports.
- [x] 2.3 Run `npm run dev` and confirm whether Vite shows a missing-module overlay for Dashboard or Workflow Management.
- [x] 2.4 Confirm the affected imports in `apps/frontend/src/features/workflow-management/WorkflowsPage.tsx` and `apps/frontend/src/features/dashboard/DashboardPage.tsx`.

## 3. Restore Workflow Mock Data Import Stability

- [x] 3.1 Choose the conservative repair path: restore `apps/frontend/src/data/workflows.ts` or provide an equivalent workflow fixture source with updated imports.
- [x] 3.2 Define a workflow mock data shape compatible with the existing Dashboard summary cards and Workflow list rendering.
- [x] 3.3 Ensure the restored or relocated fixture exports `mockWorkflows` for all current consumers.
- [x] 3.4 Keep the fixture documented or named as demo/mock data so it is not mistaken for final Workflow Management API behavior.
- [x] 3.5 Avoid adding backend APIs, Prisma models, shared DTOs, workers, or external integrations in this blocker fix.

## 4. Focused Test Coverage

- [x] 4.1 Add or update a Dashboard render test that imports workflow data successfully and renders summary content.
- [x] 4.2 Add or update a Workflow list render test that imports workflow data successfully and renders at least one workflow row.
- [x] 4.3 Add or update a Workflow search empty-state test that verifies filtering can render an empty result without import failure.
- [x] 4.4 Keep tests focused on import stability and user-visible rendering, not final Workflow domain behavior.

## 5. Verification and Handoff

- [x] 5.1 Run `npm test` and confirm it passes.
- [x] 5.2 Run `npm run build` and confirm it passes.
- [x] 5.3 Run `npm run dev` and manually confirm the Vite app loads without unresolved import overlay.
- [x] 5.4 Run `openspec validate "fix-workflow-mock-data-imports" --strict`.
- [x] 5.5 Run `openspec validate --all --strict`.
- [x] 5.6 Run `git diff --check`.
- [x] 5.7 Prepare PR notes that explicitly describe this as integration repair, not new Workflow Management behavior.
