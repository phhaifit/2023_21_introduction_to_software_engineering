## Why

The current integration branch is not usable because frontend Workflow Management and Dashboard code import workflow mock data from a path that no longer exists. This blocks `npm test`, `npm run build`, and local Vite loading, so the repository must be stabilized before additional foundation or feature work continues.

## What Changes

- Restore a compatible workflow mock data source or move the workflow fixtures into a Workflow-owned frontend source and update imports.
- Keep this as an integration repair, not a new Workflow Management feature implementation.
- Add focused coverage so the dashboard, workflow list, and workflow empty-state rendering cannot regress through missing or incompatible workflow data imports.
- Verify the root test, build, dev startup, OpenSpec validation, and whitespace gates after the fix.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `monorepo-workspaces`: root verification and local development commands must not fail because frontend feature imports reference missing source files.

## Impact

- Affected frontend files:
  - `apps/frontend/src/features/workflow-management/WorkflowsPage.tsx`
  - `apps/frontend/src/features/dashboard/DashboardPage.tsx`
  - workflow mock data or fixture source under `apps/frontend/src/features/workflow-management/` or `apps/frontend/src/data/`
- Affected tests:
  - focused frontend/component tests for dashboard and workflow list rendering
  - root verification via `npm test` and `npm run build`
- No backend API, database schema, shared contract, external integration, or production Workflow execution behavior is introduced by this change.
