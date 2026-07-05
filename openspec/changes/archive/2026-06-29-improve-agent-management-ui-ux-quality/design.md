## Context

Agent Management is implemented as a React + Vite frontend feature backed by workspace-scoped Agent Management APIs. The current page already includes the main interaction surface: sidebar shell, hero image, toolbar search/filter/sort, paginated table, row action menu, create/configure dialog, guided creation, toast notifications, delete and rename dialogs, loading skeletons, empty states, and viewer mode.

QA review of the latest implementation found that the page-level polish improved the list surface but did not meet the change quality bar. The primary issues are:

- status summaries are duplicated between the setup banner and list panel, which makes the page feel noisy rather than intentional
- the New Agent modal still looks like a prototype: raw text inputs, cramped field hierarchy, blank preview space, weak tab/mode affordances, underdesigned Prompt Assistant, underdesigned `skill.md` import, and limited guidance for what the user should do next
- modal content can become long without a strong internal structure, sticky action area, or progressive disclosure

The improvement is a design-quality pass, not a product expansion. The selected skills shape the review lens:

- `ui-ux-pro-max`: use as a high-level UI/UX heuristic pass only, because the installed package is a catalog entry and does not include the full upstream pattern library.
- `redesign-existing-projects`: upgrade the existing interface in place, preserve the framework and behavior, remove generic prototype patterns, and improve hierarchy, spacing, interaction states, and visual polish.
- `ui-a11y`: require WCAG-oriented accessibility checks for focus, labels, semantics, contrast, touch targets, reduced motion, and keyboard flow.

## Goals / Non-Goals

**Goals:**

- Make Agent Management feel like a friendly setup and configuration workspace for AI agents.
- Preserve existing API-backed interactions while improving the presentation layer.
- Keep `agents-hero.png` as a compact setup banner that makes the page more engaging without blocking the table flow.
- Keep the Agent table as the primary list and tracking surface while improving scan density for filters, status, and actions.
- Remove duplicated summary regions and make each visible metric or control have one clear home.
- Add an Agent Info Popup opened from row selection so users can inspect an agent profile and configure the selected agent from a richer surface.
- Make New Agent feel like a polished creation workspace, not a raw form inside a dialog.
- Make modal-heavy flows usable, attractive, and accessible across desktop and narrow screens.
- Keep tests anchored to accessible names, roles, labels, and visible text.

**Non-Goals:**

- No backend route, Prisma schema, worker, OpenClaw, or shared contract change is planned.
- No new Agent Management lifecycle capability is introduced.
- No task assignment, task execution, workflow orchestration, workspace provisioning, runtime monitoring, task history, or execution result UI is introduced.
- No new production dependency is planned.
- No redesign of unrelated modules.
- No implementation of marketplace skill runtime behavior inside the product.

## Decisions

### Decision 1: Use an in-place setup workspace refinement instead of a full redesign

Refine the existing page structure instead of replacing the Agent Management feature with a new app shell. The implementation should reuse the existing React components, API client, state transitions, table flow, dialogs, and test selectors wherever practical.

Alternative considered: create a new dashboard surface from scratch. Rejected because the current feature already covers the required Agent setup and configuration interactions, and a rewrite would increase regression risk without adding product value.

### Decision 2: Keep the hero image as a compact setup banner

Keep `agents-hero.png` because it gives Agent Management a distinct and enjoyable visual identity. The hero should become a compact setup banner that introduces the Agent setup experience, highlights the primary create action, and can show small status counts while keeping the toolbar and table reachable early.

Alternative considered: remove the hero entirely in favor of metrics. Rejected because Agent Management is also a setup experience, and the visual asset helps the page feel more inviting. Alternative considered: keep a large marketing-style hero. Rejected because it would still slow repeated table-based configuration work.

### Decision 3: Keep color restrained and multi-tone

The UI should move away from a one-note purple/blue palette. Use neutral surfaces, clear status colors, and a limited accent treatment. Avoid oversized gradients, decorative blobs, and excessive card nesting. Letter spacing should remain `0`.

Alternative considered: add more accent gradients and ornamental treatments for polish. Rejected because the product surface is a SaaS configuration interface, where clarity and restraint matter more than decorative energy.

### Decision 4: Keep the Agent table as the primary list surface

Desktop should keep a real table-like presentation for comparison and scanning. The table should look more polished and friendly through better spacing, selected-row treatment, status badges, hover/focus states, and clear action affordances. Narrow screens should preserve the list-first mental model while avoiding unreadable horizontal overflow.

Alternative considered: replace the table with cards everywhere. Rejected because the user wants to keep the current table-style list. Alternative considered: force horizontal scrolling at all widths. Rejected because it makes lifecycle actions and status comparison hard on mobile and small laptop widths.

### Decision 5: Avoid duplicated summaries and competing hierarchy

The page should not show the same total/enabled/disabled summary twice in the same first-viewport layout. If the setup banner displays compact counts, the list panel should focus on list title, result count, filtering context, and table actions. If implementation moves counts into the list panel, the hero should not repeat them. Repeated metrics are only acceptable when a narrow responsive layout moves the same summary from one region to another, not when both are visible together.

Alternative considered: keep summary counts in both the banner and list card for emphasis. Rejected because the QA screenshots show the duplicate display makes the interface feel cluttered and unresolved.

### Decision 6: Redesign New Agent as a creation workspace

The New Agent modal should be treated as the highest-risk UI surface in this change. It should use a composed layout with:

- a concise header that explains the current creation mode and next step
- mode selection that behaves like a segmented control or step tabs, with clear active/inactive states
- a Template mode with grouped sections for identity, model, responsibilities, context, tools, knowledge, constraints, and review
- input controls styled consistently with the app design rather than default browser controls
- helper text and examples where fields are ambiguous
- a preview panel that is useful even before all fields are complete, for example by showing missing sections, draft structure, or next required inputs instead of a mostly blank box
- a sticky footer or persistent action row for cancel/create/next actions so users do not lose the primary action while scrolling
- polished empty, loading, warning, and validation states

Prompt Assistant should feel like a guided drafting tool: a comfortable textarea, example prompts or structured helper chips if existing behavior allows, clear generate action, pending state, and draft review transition. It must not be a tiny centered textbox in a large empty panel.

Import `skill.md` should feel like an intentional import workflow: styled file picker/drop zone, readable markdown textarea, clear analysis action, validation/error states, and a visible path from parsed draft to review/create. It must not rely on unstyled native file input and textarea controls as the primary presentation.

Alternative considered: only adjust spacing and typography in the existing dialog. Rejected because QA shows the current creation flow remains hard to use and visually unfinished even after page-level improvements.

### Decision 7: Use an Agent Info Popup for row selection

Selecting an Agent row should open an Agent Info Popup rather than a persistent right-side panel. The popup shows list summary immediately, then loads editable configuration through the existing configuration API so instructions and current config can be displayed. The popup is an inspection surface, not an edit form by default.

Manager actions in the popup include configure, rename, duplicate, enable or disable, and delete according to status. Viewer mode shows the same information without mutation actions. The popup must not introduce run, assign task, execute workflow, runtime status, task history, or result-monitoring actions. To avoid modal stacking, actions that need richer editing or confirmation should either transition the popup into the existing flow or close the info popup before opening the configure, rename, or delete dialog.

Alternative considered: use a right-side detail panel. Rejected because the user prefers a popup and because a modal profile view fits the existing modal-heavy Agent Management interaction model. Alternative considered: row click opens edit directly. Rejected because users need a readable profile view before deciding which action to take.

### Decision 8: Treat accessibility as acceptance criteria

The refined UI must preserve or improve semantic dialogs, focus management, keyboard-reachable row menus, visible focus indicators, accessible names, touch targets, status messages, validation association, and reduced-motion behavior.

Alternative considered: treat accessibility as a final QA pass. Rejected because the redesign touches dialogs, menus, buttons, filters, and motion; accessibility needs to shape the requirements before implementation.

### Decision 9: Verify with screenshots and existing behavior

Implementation should include focused component/view tests plus browser verification for the refined Agent Management interactions. Test assertions should target accessible roles/names and user-visible behavior, not fragile CSS class names. The implementation must also capture and inspect screenshots for desktop and narrow viewports covering the list page, Agent Info Popup, Template creation, Prompt Assistant, Import `skill.md`, draft review, and validation/error states before tasks are marked complete.

Alternative considered: only visual inspection. Rejected because the existing page has many mutation and safety paths that can regress during visual cleanup.

## Risks / Trade-offs

- Visual polish regresses existing API behavior -> Keep the state machine and API client behavior unchanged, and run existing test/build commands after implementation.
- New Agent remains a raw form after page-level polish -> Treat New Agent as a dedicated creation workspace and require screenshot review for all creation modes before completion.
- Summary metrics remain duplicated -> Give each count/control one clear home and add a targeted component or browser assertion if practical.
- Responsive layout hides actions or metadata -> Define required visible content and accessible action names for both desktop and narrow screens.
- Agent Info Popup conflicts with existing configure, rename, or delete dialogs -> Avoid stacked modals by closing or transitioning the popup before opening action-specific dialogs.
- Popup improvements break focus or dismissal behavior -> Require dialog focus management, non-mutating close behavior, Escape/close behavior, and keyboard verification.
- Motion polish harms users with motion sensitivity -> Require `prefers-reduced-motion` handling for nonessential animations.
- Shared component edits affect other modules -> Prefer Agent Management-scoped CSS/components. Touch shared layout, toast, or pagination only when the change is clearly reusable and verified.
- Boundary-safe UI copy drifts into Task Orchestration or Workspace Management -> Keep labels and actions limited to Agent profile setup, configuration, lifecycle availability, and `skill.md` import/preview.
- Skill guidance conflicts with repo design constraints -> Use skills as heuristics, but repo OpenSpec, AGENTS.md, and existing product behavior remain the source of truth.

## Migration Plan

1. Implement the setup banner, table polish, and Agent Info Popup behind the existing Agent Management route.
2. Preserve current API calls and request payload behavior.
3. Update focused tests for desktop/narrow layout, accessible row actions, Agent Info Popup focus/dismissal, viewer mode, and mutation safety.
4. Run repository verification commands before marking tasks complete.
5. Rollback is a normal frontend revert because no data, API, or migration change is planned.

## Open Questions

- Resolved: Keep `agents-hero.png` as a compact setup banner rather than removing it or keeping a large decorative hero.
- Resolved: Keep the Agent table as the primary list surface and polish it instead of replacing it with a different desktop layout.
- Resolved: Selecting an Agent row opens an Agent Info Popup, not a right-side panel and not direct edit mode.
- Resolved: Keep shared component changes minimal unless an accessibility or behavior defect directly affects Agent Management acceptance criteria.
