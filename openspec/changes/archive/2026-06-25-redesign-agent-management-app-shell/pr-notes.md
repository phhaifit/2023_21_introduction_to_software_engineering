## Summary

- Redesign the Agent Management app shell, sidebar, hero, toolbar, list, empty state, loading skeleton, and viewer presentation from the Stitch materials.
- Add `lucide-react` for local bundled icons and copy the selected Stitch hero asset into the frontend asset tree.
- Move create/configure agent into a modal dialog opened from `New Agent`, `Create first agent`, and the row `Configure` action.
- Replace always-visible row action buttons with a vertical three-dot action menu that exposes Configure, Enable/Disable, Rename, Duplicate, and Delete.
- Preserve API-backed list, create, edit, enable, disable, delete, validation, retry, and mutation-failure flows.

## OpenSpec

Change: `redesign-agent-management-app-shell`

Completed tasks:

- [x] Baseline and dependency setup
- [x] Sidebar and app shell redesign
- [x] Agent Management page redesign
- [x] Viewer presentation
- [x] Test update
- [x] Verification and handoff
- [x] Modal form and row action menu refinement

## Scope

- `@vcp/frontend` dependency update for `lucide-react`
- Shared frontend sidebar/app-shell styling
- Agent Management frontend page, view renderer, CSS, local hero asset, and tests
- Modal create/configure form and row-level vertical three-dot action menu
- OpenSpec change artifacts for the redesign

## Out of Scope

- Backend endpoint changes
- Shared contract changes
- Prisma schema or migration changes
- Tailwind, Material Symbols, Google icon/font CDN, and runtime CDN dependencies
- Functional search, filter, sort, grid view, per-page, duplicate, rename, or real RBAC integration
- Rename and Duplicate are visible as disabled, non-mutating menu items only

## Files Changed

- `apps/frontend/package.json`
- `package-lock.json`
- `apps/frontend/src/assets/agent-management/agents-hero.png`
- `apps/frontend/src/app.css`
- `apps/frontend/src/components/layout/Sidebar.tsx`
- `apps/frontend/src/features/agent-management/agent-management-page.tsx`
- `apps/frontend/src/features/agent-management/agent-management-view.css`
- `apps/frontend/src/features/agent-management/agent-management-view.ts`
- `tests/component/agent-management-page.test.tsx`
- `tests/contract/agent-management-app-shell.test.mjs`
- `tests/contract/agent-management-frontend.test.mjs`
- `tests/e2e/agent-management.spec.ts`
- `openspec/changes/redesign-agent-management-app-shell/**`

## Tests

- [x] `npm test`
- [x] `npm run build`
- [x] `openspec validate "redesign-agent-management-app-shell" --strict`
- [x] `openspec validate --all --strict`
- [x] `git diff --check`

Additional commands:

- [x] `npm run build --workspace=@vcp/frontend`
- [x] `npm run test:agent-management`
- [x] `npx vitest run --config vitest.config.ts tests/component/agent-management-page.test.tsx`
- [x] `node tests/contract/agent-management-app-shell.test.mjs && node tests/contract/agent-management-frontend.test.mjs`
- [x] `npx playwright test tests/e2e/agent-management.spec.ts`

## Manual Test

- Navigate to `Agents` from the redesigned sidebar.
- Verify expanded and collapsed sidebar states.
- Verify hero, disabled toolbar controls, table rows, status chips, modal form, empty state, loading skeleton, and viewer-mode presentation.
- Exercise list, modal create, validation failure, configure/update, action-menu hover, disable, enable, and delete flows.

## Shared Boundary Impact

- Shared contracts changed: No
- Prisma schema changed: No
- API route boundary changed: No
- New production dependency: Yes, `lucide-react` for local bundled icons

## Known Gaps / Risks

- Viewer mode is frontend-only until Workspace User Management supplies real role context.
- Search, filter, sort, grid view, per-page, duplicate, and rename remain disabled or out of functional scope.
- The row menu is implemented with hover and focus visibility; future keyboard menu semantics can be expanded when Rename/Duplicate become real features.
