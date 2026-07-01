## Why

Agent Management already supports the main API-backed interactions, but the current interface still reads as a functional prototype rather than a friendly setup and configuration workspace for AI agents. A QA review of the current implementation also shows duplicated summary information and an unimproved New Agent flow whose raw form controls, sparse assistant/import screens, weak hierarchy, and hard-to-scan layout make creation difficult to use.

This change uses the selected UI/UX skills as review inputs to make the page more polished, lively, and approachable while preserving the existing APIs, module boundaries, and familiar Agent table. The proposal now treats the New Agent creation experience as a first-class part of the UI/UX quality bar, not as a secondary modal cleanup.

## What Changes

- Keep `agents-hero.png` as a compact setup banner that gives Agent Management a distinct, engaging visual identity while keeping create actions and list controls easy to reach.
- Keep the Agent table as the primary list and tracking surface, but refine its visual hierarchy, row states, spacing, status badges, row actions, pagination, empty/loading/error states, and mutation feedback.
- Remove duplicated or competing summary displays so users do not see the same enabled/disabled/total counts repeated in multiple nearby regions.
- Add an Agent Info Popup opened from table row selection so users can inspect an agent profile and perform relevant actions without leaving the list context.
- Redesign the New Agent flow as a polished creation workspace with clearer mode selection, guided form sections, helper copy, high-quality controls, useful preview states, an ergonomic assistant screen, and an import screen that feels intentional rather than raw browser defaults.
- Improve the configure/rename/delete modal presentation so existing editing and confirmation flows match the same interaction quality as New Agent.
- Add explicit accessibility requirements for keyboard navigation, focus management, touch targets, contrast, reduced motion, semantic dialogs, and stable accessible names.
- Preserve API-backed list, create, update, rename, duplicate, enable, disable, delete, model catalog, skill preview, assistant draft, and import behavior.
- Keep copy and controls scoped to Agent setup and configuration; do not introduce run, assign task, execute workflow, provision runtime, or task result monitoring actions.
- Keep the work frontend-scoped unless implementation discovers a documented gap in existing shared contracts or Agent Management API responses.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `agent-management-app-shell`: Tighten Agent Management visual hierarchy, setup banner, table presentation, non-duplicated summaries, Agent Info Popup, New Agent creation workspace, modal usability, interaction states, and accessibility acceptance criteria.
- `agent-management-ui-api-integration`: Preserve current API-backed behavior while requiring the refined UI and Agent Info Popup to keep mutation safety, recoverable state, accessible selectors, and browser-verifiable flows intact.

## Impact

- Affected frontend areas:
  - `apps/frontend/src/features/agent-management/*`
  - `apps/frontend/src/features/agent-management/components/*`
  - shared frontend layout/components only if needed for sidebar, toast, pagination, or reusable accessibility behavior
- Affected tests:
  - Agent Management component/view tests for responsive states, accessible controls, row selection, Agent Info Popup, and mutation-safe dialogs
  - E2E/browser checks for list, create/configure, row-opened popup, lifecycle actions, viewer mode, and responsive layout
- APIs: no planned backend API route changes.
- Shared contracts: no planned `@vcp/shared` contract changes.
- Prisma/database: no planned schema or migration changes.
- Out of scope: Workspace provisioning, OpenClaw/runtime status, task assignment, task execution, workflow orchestration, task history, and execution results.
- Dependencies: no planned production dependency changes. Any dependency proposal must be justified separately before implementation.
