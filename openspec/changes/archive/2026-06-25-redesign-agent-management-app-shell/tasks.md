## 1. Baseline and Dependency Setup

- [x] 1.1 Fast-forward local `master` from `origin/master`, create `feature/agent-management/redesign-app-shell`, and confirm the worktree has no unrelated changes before editing.
- [x] 1.2 Review current Stitch materials in `/tmp/stitch-vcp-agent-management-redesign` and select the canonical hero asset to copy into the frontend asset tree.
- [x] 1.3 Add `lucide-react` to `@vcp/frontend` dependencies without adding Tailwind, Material Symbols, or runtime CDN icon dependencies.
- [x] 1.4 Run a targeted dependency/build sanity check to confirm the icon package resolves in the Vite frontend.

## 2. Sidebar and App Shell Redesign

- [x] 2.1 Redesign `Sidebar.tsx` with `lucide-react` icons, active Agent Management styling, workspace identity, footer actions, and accessible navigation names.
- [x] 2.2 Add expanded and collapsed desktop sidebar styling in `app.css` using repository CSS variables and stable dimensions.
- [x] 2.3 Preserve existing page selection behavior in `App.tsx` and avoid route or module wiring changes unless required for sidebar state.
- [x] 2.4 Update app-shell contract/component checks for local icon usage and expanded/collapsed sidebar expectations.

## 3. Agent Management Page Redesign

- [x] 3.1 Redesign the Agent Management page header, top action area, hero banner, toolbar, and list container using existing API-backed state.
- [x] 3.2 Convert the existing row presentation to the Stitch-aligned table/list layout while preserving row metadata and edit/enable/disable/delete actions.
- [x] 3.3 Implement the redesigned empty state with the create-agent action for users who can manage agents.
- [x] 3.4 Implement the redesigned initial loading skeleton while preserving a screen-reader-visible loading status.
- [x] 3.5 Keep unsupported Stitch controls such as filter, sort, grid view, per-page, duplicate, and rename disabled or out of functional scope.

## 4. Viewer Presentation

- [x] 4.1 Add a viewer-mode presentation path that shows a viewer indicator and hides or disables create/edit/enable/disable/delete mutation controls.
- [x] 4.2 Add component coverage proving viewer mode does not call create, update, enable, disable, or delete API client methods from viewer controls.
- [x] 4.3 Keep viewer mode frontend-only unless a later Workspace User Management change supplies real role context.

## 5. Test Update

- [x] 5.1 Update Agent Management component tests to use accessible roles, labels, button names, menu names, and visible text rather than legacy layout class selectors.
- [x] 5.2 Preserve coverage for loading, empty, retry, create, validation, duplicate create prevention, edit load, update, duplicate update prevention, lifecycle actions, deletion confirmation, and mutation failure.
- [x] 5.3 Update Agent Management E2E tests for the redesigned sidebar/list presentation while still verifying list, create, invalid form, edit, disable, enable, and delete flows.
- [x] 5.4 Update static contract tests only where they intentionally check app-shell files, local icon dependency, or mock-data isolation.

## 6. Verification and Handoff

- [x] 6.1 Review final scope and confirm the PR stays focused on this OpenSpec change without unrelated modules, unrelated features, or broad refactors.
- [x] 6.2 Run `npm test` and record the exact result.
- [x] 6.3 Run `npm run build` and record the exact result.
- [x] 6.4 Run `openspec validate "redesign-agent-management-app-shell" --strict` and record the exact result.
- [x] 6.5 Run `openspec validate --all --strict` and record the exact result.
- [x] 6.6 Run `git diff --check` and record the exact result.
- [x] 6.7 Prepare PR notes with summary, OpenSpec change, completed tasks, scope, out-of-scope controls, files changed, tests run, manual test notes, shared-boundary impact, dependency impact, and known risks.

## 7. Modal Form and Row Action Menu Refinement

- [x] 7.1 Update OpenSpec proposal, design, and specs for modal create/configure forms and vertical three-dot row action menus.
- [x] 7.2 Move the create/configure form out of the persistent Agent Management page column into an accessible modal dialog opened by New Agent, Create first agent, and Configure.
- [x] 7.3 Close the modal after successful create/update while preserving validation errors and form values on failure.
- [x] 7.4 Replace always-visible row action buttons with a vertical three-dot action menu that appears on hover and focus.
- [x] 7.5 Keep Configure, Enable/Disable, and Delete wired to existing API-backed behavior while showing Rename and Duplicate as disabled, non-mutating actions.
- [x] 7.6 Update component tests for modal open/close, create/update through modal, non-mutating close, row action menu behavior, and disabled Rename/Duplicate safety.
- [x] 7.7 Update E2E tests to open the modal and row action menu before exercising create, edit/configure, enable/disable, and delete flows.
- [x] 7.8 Run targeted Agent Management tests, E2E flow, build, OpenSpec validation, and `git diff --check`.
- [x] 7.9 Update PR notes to include modal form and row action menu refinements.
