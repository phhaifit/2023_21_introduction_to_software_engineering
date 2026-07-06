## Context

Agent Management already has a React/Vite browser app shell and an API-backed page for listing, creating, editing, enabling, disabling, and deleting workspace agents. The new Stitch materials provide a richer dashboard direction with an expanded/collapsed sidebar, top app bar, hero banner, toolbar, table list, empty state, loading skeleton, and viewer-mode presentation.

The downloaded Stitch files are local reference material in `/tmp/stitch-vcp-agent-management-redesign`. They are static HTML/CSS previews generated with Tailwind CDN and Google Material Symbols. The production repository currently uses React, Vite, ordinary CSS, and no icon dependency. The redesign must therefore translate the visual intent into repository-native React components and CSS rather than copying the generated HTML directly.

Implementation should follow the repository-wide `AGENTS.md` workflow: check `git status --short --branch`, report unrelated or unclear changes before editing, fast-forward from `origin/master`, and create a focused branch before code changes.

## Goals / Non-Goals

**Goals:**

- Align the Agent Management app shell with the Stitch redesign while preserving the current API-backed behavior.
- Add `lucide-react` as the local icon library for sidebar, toolbar, empty state, loading, status, and row action affordances.
- Keep the implementation inside the existing React/Vite/CSS stack and avoid introducing Tailwind as a new styling system.
- Make expanded and collapsed sidebar presentations deterministic and testable.
- Replace the current plain Agent Management list/form presentation with a denser dashboard layout using a hero banner, toolbar, table/list rows, loading skeleton, empty state, and viewer-mode presentation.
- Move create/edit configuration into a modal dialog so the list remains the primary page surface and users only enter form mode intentionally.
- Replace visible row action button groups with a compact vertical three-dot menu that exposes actions on hover and focus.
- Update tests to assert behavior, accessibility, and stable UI states rather than old CSS class names.

**Non-Goals:**

- Do not change Agent Management backend endpoints, repositories, lifecycle use cases, or persistence.
- Do not change public shared contracts unless implementation discovers an unavoidable existing contract gap.
- Do not implement real search, filter, sort, pagination, grid view, duplicate, rename, or tool-assignment behavior unless a later OpenSpec change explicitly requires it.
- Do not add Tailwind, Material Symbols, Google font/icon CDN dependencies, or other runtime CDN dependencies.
- Do not redesign unrelated modules beyond shared app-shell styling needed by the sidebar.

## Decisions

### Use `lucide-react` for icons

The redesign needs clear icons for navigation, top actions, toolbar buttons, status, empty state, skeleton context, and row menus. `lucide-react` is a small React-native icon library that avoids external runtime fonts and keeps icons local to the bundle.

Alternatives considered:

- Material Symbols CDN: closer to Stitch output but introduces network dependency and font-rendering variability.
- Inline text/index markers: no dependency but visually weaker and harder to match the redesign.
- Tailwind plus icon font: too broad for this focused change.

### Translate Stitch layout into CSS classes instead of adding Tailwind

The Stitch HTML uses Tailwind utility classes, but this repository has established CSS files and no Tailwind build pipeline. The implementation should extract design tokens such as surface colors, outline colors, spacing, sidebar widths, status colors, and skeleton animation into `app.css` and `agent-management-view.css`.

Alternatives considered:

- Install Tailwind: would introduce a new styling pipeline and affect the whole frontend.
- Paste generated HTML: would break React state, API wiring, and tests.

### Preserve current Agent Management data flow

The redesigned UI remains a presentation layer over the existing API client. Initial load, retry, create, validation errors, edit configuration loading, update, enable, disable, delete confirmation, duplicate mutation prevention, and last-good-list behavior remain authoritative.

Alternatives considered:

- Use static Stitch demo data: rejected because existing specs require backend data in the browser and fixtures only in isolated tests.

### Treat unsupported Stitch controls as presentational or disabled

The Stitch toolbar includes search, filter, sort, list/grid toggle, per-page selection, and some row menu actions that do not map to implemented Agent Management behavior. This change may render search/filter/sort/list-grid as disabled or non-mutating visual controls if needed for visual parity, but it must not pretend to implement behavior that does not exist.

Implementation may keep only the controls that can be wired to current behavior: New Agent, Configure/Edit, Enable, Disable, Delete, Retry, and Create/Edit form submission. Rename and Duplicate may appear in the row action menu for visual parity with the latest screenshot, but they remain disabled or non-functional until a later OpenSpec change adds supported behavior.

### Use modal dialogs for create and configure flows

The previous implementation kept the Create Agent form permanently visible in a right column. The updated design opens the same API-backed form in a modal dialog from New Agent, Create first agent, or Configure. The dialog should have a clear title, supporting copy, close affordance, and accessible dialog semantics. Closing the dialog should not trigger API calls.

The edit/configure path should reuse the modal so configuration loading, validation errors, update submission, and duplicate-submit prevention remain covered by the existing API flow. Successful create/update closes the modal after the list refreshes.

### Use a focused action menu for row actions

Rows should expose a vertical three-dot menu button instead of a group of always-visible action buttons. The menu opens on hover and keyboard focus, uses accessible menu/menuitem semantics, and contains current functional actions plus disabled out-of-scope actions where needed for visual parity. Functional actions remain wired to the existing API client methods.

### Keep viewer mode presentation isolated

Viewer mode is a UI state showing read-only access. The page should be able to render a viewer presentation where create/edit/lifecycle mutation controls are hidden or disabled and no mutation API call is made from those controls. This change does not implement backend authorization; backend authorization remains owned by the existing API/security layer.

### Prefer accessibility selectors in tests

Tests should locate rows and controls through roles, names, labels, and visible text. Class selectors such as `article.agent-row` and `.agent-row__status` are too coupled to the old layout and should not be the primary test contract after moving to table/list presentation.

## Risks / Trade-offs

- [Risk] Adding `lucide-react` changes frontend dependencies and lock files. -> Mitigation: add only this dependency, document why Tailwind and CDN icon fonts are excluded, and verify build/test output.
- [Risk] Table-based layout can break existing component and E2E tests that assume article rows. -> Mitigation: update test helpers to use accessible row/menu/button queries and keep behavior assertions unchanged.
- [Risk] Stitch contains controls for unimplemented behavior such as filter, sort, grid view, duplicate, rename, and pagination. -> Mitigation: keep these out of functional scope or render them disabled/presentational with tests that do not imply implemented behavior.
- [Risk] Moving the form into a modal can accidentally remove create/edit validation and duplicate-submit coverage. -> Mitigation: update component and E2E tests to open the modal before submitting and keep existing behavior assertions.
- [Risk] Hover action menus can become inaccessible. -> Mitigation: make the menu visible on focus-within and expose stable accessible button/menu item names.
- [Risk] Viewer mode could be mistaken for full RBAC implementation. -> Mitigation: spec it as frontend presentation only unless a later change connects it to Workspace User Management authorization state.
- [Risk] Hero assets copied from `/tmp` could be missed by future agents. -> Mitigation: copy any selected asset into an explicit frontend asset path during implementation and reference that path in tests/manual notes.
- [Risk] Local branch is behind remote master. -> Mitigation: implementation starts with `git checkout master` and `git pull --ff-only origin master` before creating the feature branch.

## Migration Plan

1. Check repository state, fast-forward local `master` from `origin/master`, and create a feature branch before edits.
2. Install `lucide-react` in the frontend workspace and verify the dependency lands only in the intended package/lock files.
3. Implement sidebar/app-shell visual refresh with stable expanded/collapsed behavior.
4. Implement Agent Management redesigned page layout while keeping the existing API client and mutation handlers.
5. Move create/edit form presentation into a modal and replace row action buttons with the vertical action menu.
6. Add or copy the selected hero asset into the frontend assets area if the implementation uses a bitmap hero background.
7. Update component, contract, and E2E tests to match the redesigned semantics.
8. Run `npm test`, `npm run build`, `openspec validate "redesign-agent-management-app-shell" --strict`, `openspec validate --all --strict`, and `git diff --check`.

Rollback is straightforward because this change is frontend-only except for the icon dependency: revert the UI/CSS/test changes and remove `lucide-react` from the frontend package if the redesign is rejected.

## Open Questions

- Should the collapsed sidebar default be controlled by user interaction, viewport width, or a fixed demo state?
- Should viewer mode be exposed through a prop/demo toggle for testing, or deferred until Workspace User Management provides role context?
- Which one of the downloaded hero assets should become the canonical local asset for the Agent Management page?
