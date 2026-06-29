## 1. QA Re-Audit And Scope Reset

- [x] 1.1 Review the provided QA screenshots and document the concrete defects: duplicated summary counts, weak page hierarchy, raw New Agent controls, sparse assistant/import states, long modal scrolling, and unclear primary action paths.
- [x] 1.2 Re-open the current Agent Management implementation in desktop and narrow viewports and capture the current list, Agent Info Popup, New Agent Template, Prompt Assistant, Import `skill.md`, draft review, validation, and error states.
- [x] 1.3 Confirm the rework stays scoped to Agent Management setup/configuration and does not add Workspace Management, Task Orchestration, OpenClaw runtime, task execution, or workflow controls.
- [x] 1.4 Treat the previous completed checkboxes as superseded by this QA rework checklist; do not mark any rework task complete until implementation and verification pass again.

## 2. Page Hierarchy And Duplicate Display Fixes

- [x] 2.1 Remove duplicated total/enabled/disabled summaries so the first viewport has one clear summary region and the Agent list header does not repeat nearby counts.
- [x] 2.2 Refine the setup banner so `agents-hero.png` remains lively but does not dominate or visually compete with the list and toolbar.
- [x] 2.3 Tighten toolbar, list header, table density, row hover/focus/selected states, and pagination so the page feels intentional rather than card-heavy or repetitive.
- [x] 2.4 Verify desktop and narrow viewports have no overlapping, clipped, or repeated content and preserve readable table/list behavior.

## 3. New Agent Creation Workspace Redesign

- [x] 3.1 Redesign the New Agent modal header, mode selector, layout grid, scroll behavior, and persistent footer/action area so the flow has a clear next step at all times.
- [x] 3.2 Redesign Template mode with grouped form sections, app-styled inputs/selects/textareas, helper text, consistent spacing, and visible validation feedback.
- [x] 3.3 Redesign the `skill.md` preview panel so incomplete drafts show helpful missing-field guidance or draft structure instead of an empty oversized panel.
- [x] 3.4 Redesign Prompt Assistant mode with an ergonomic description input, useful guidance, generate action, pending state, draft review transition, and no excessive unused space.
- [x] 3.5 Redesign Import `skill.md` mode with a styled file picker/drop area, readable Markdown input, analyze action, validation/error feedback, parsed draft transition, and consistent visual hierarchy.
- [x] 3.6 Refine draft review and create confirmation states so users can inspect generated/imported content before creating the Agent.
- [x] 3.7 Ensure the redesigned New Agent flow still uses existing model catalog, preview, assistant draft, import, and create API behavior without backend or shared contract changes.

## 4. Agent Info Popup And Existing Modal Alignment

- [x] 4.1 Keep the row-opened Agent Info Popup behavior, but ensure it visually aligns with the redesigned New Agent modal quality bar.
- [x] 4.2 Re-check configure, rename, delete confirmation, and lifecycle action flows so modal transitions avoid stacking, preserve focus, and keep non-mutating close behavior.
- [x] 4.3 Keep manager and viewer mode behavior correct: managers see allowed mutation actions, viewers can inspect but cannot mutate.
- [x] 4.4 Confirm no run, assign task, execute workflow, provision runtime, runtime status, task history, or execution result controls appear in Agent Management.

## 5. Accessibility And Interaction Quality

- [x] 5.1 Improve keyboard order, visible focus indicators, dialog labels/descriptions, icon button names, form labels, error associations, and touch target sizing across the list and all Agent modals.
- [x] 5.2 Add reduced-motion handling for any nonessential modal, row, toast, or banner transitions.
- [x] 5.3 Verify pending states disable conflicting actions and prevent duplicate submissions for create, preview, assistant, import, configure, rename, duplicate, enable, disable, and delete flows.
- [x] 5.4 Preserve stable accessible selectors for component and E2E tests without relying on private CSS class names.

## 6. Tests And Verification

- [x] 6.1 Update focused component/view tests for non-duplicated summaries, New Agent Template mode, Prompt Assistant mode, Import `skill.md` mode, draft review, validation feedback, Agent Info Popup, viewer mode, and mutation safety.
- [x] 6.2 Update browser/E2E or Playwright visual verification for desktop and narrow Agent Management flows, including list page, Agent Info Popup, New Agent Template, Prompt Assistant, Import `skill.md`, draft review, and validation/error states.
- [x] 6.3 Run `npm run test:agent-management:components`.
- [x] 6.4 Run `node tests/contract/agent-management-frontend.test.mjs`.
- [x] 6.5 Run `npx playwright test tests/e2e/agent-management.spec.ts`.
- [x] 6.6 Run `npm test`.
- [x] 6.7 Run `npm run build`.
- [x] 6.8 Run `openspec validate "improve-agent-management-ui-ux-quality" --strict`.
- [x] 6.9 Run `openspec validate --all --strict`.
- [x] 6.10 Run `git diff --check`.
