## Why

The Agent Management UI needs to be synchronized with the new Stitch redesign so the demo feels consistent with the intended product dashboard instead of the current plain list/form layout. The redesign should improve the app shell, sidebar, empty/loading/viewer states, and visual affordances while preserving the existing API-backed Agent Management flows.

## What Changes

- Refresh the Agent Management app shell using the Stitch materials downloaded under `/tmp/stitch-vcp-agent-management-redesign`.
- Redesign the shared sidebar for Agent Management navigation states, including expanded and collapsed desktop presentations.
- Redesign the Agent Management page with a top app bar, hero banner, toolbar, table-style agent list, empty state, loading skeleton, and viewer-mode presentation.
- Move the create/edit Agent form out of the persistent page column and into a polished modal dialog opened from New Agent, Create first agent, or Configure.
- Replace always-visible row action buttons with a vertical three-dot action menu that reveals row actions on hover or keyboard focus.
- Add a small React icon dependency, `lucide-react`, for local icon rendering instead of relying on Google Material Symbols or CDN-hosted icon fonts.
- Keep ordinary React/Vite/CSS implementation patterns; do not add Tailwind or runtime CDN dependencies for this redesign.
- Preserve existing API-backed list, create, edit, enable, disable, delete, validation, retry, and mutation-failure behavior.
- Update component and E2E tests so they assert user-visible behavior and accessibility semantics rather than old CSS class names.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-management-app-shell`: refine the browser app shell requirements for the Stitch-aligned sidebar, icon-supported navigation, Agent Management hero/toolbar/list layout, empty state, loading skeleton, and viewer presentation.
- `agent-management-ui-api-integration`: preserve API-backed behavior while requiring the redesigned loading, empty, mutation, lifecycle, and viewer-mode UI states to remain wired to the current frontend state and API client behavior.

## Impact

- Affected frontend code:
  - `apps/frontend/package.json`
  - root lock file, if dependency installation updates it
  - `apps/frontend/src/components/layout/Sidebar.tsx`
  - `apps/frontend/src/App.tsx`, only if app-shell state or page wiring is needed
  - `apps/frontend/src/app.css`
  - `apps/frontend/src/features/agent-management/agent-management-page.tsx`
  - `apps/frontend/src/features/agent-management/agent-management-view.css`
  - optional local Agent Management visual asset file copied from the downloaded Stitch hero material
- Affected tests:
  - `tests/component/agent-management-page.test.tsx`
  - `tests/contract/agent-management-app-shell.test.mjs`
  - `tests/contract/agent-management-frontend.test.mjs`, only if static render expectations change
  - `tests/e2e/agent-management.spec.ts`
- Dependency impact:
  - Add `lucide-react` to `@vcp/frontend` dependencies for local React icons.
  - Do not add Tailwind, Material Symbols, or external runtime CDN dependencies.
- API/backend/shared-contract impact:
  - No backend endpoint changes.
  - No shared contract changes expected.
  - No Prisma changes expected.
- Repository state caveat:
  - Implementation should begin with `git status --short --branch` and fast-forward from `origin/master` before editing code.
