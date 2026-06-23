# Knowledge Base / RAG Codex Guide

## How To Work On This Feature

Work only inside the Knowledge Base / RAG boundary unless the user explicitly
asks for broader integration. This module prepares internal and external
knowledge sources for future RAG use; it does not implement final answer
generation.

Before each task, read:

1. `AGENTS.md`
2. `docs/openspec-team-guide.md`
3. `docs/module-ownership.md`
4. `docs/pr-checklist.md`
5. `docs/knowledge-base-rag-context.md`
6. `openspec/changes/implement-knowledge-base-rag/proposal.md`
7. `openspec/changes/implement-knowledge-base-rag/design.md`
8. `openspec/changes/implement-knowledge-base-rag/specs/knowledge-base-rag/spec.md`
9. `openspec/changes/implement-knowledge-base-rag/tasks.md`
10. The README in the relevant frontend, backend, or worker Knowledge Base path.

## Allowed Directories

- `apps/frontend/src/features/knowledge-base-rag`
- `apps/backend/src/modules/knowledge-base-rag`
- `apps/workers/src/jobs/document-ingestion`
- `docs/knowledge-base-rag-context.md`
- `docs/knowledge-base-rag-codex-guide.md`
- `openspec/changes/implement-knowledge-base-rag` only when the task changes
  documented scope, requirements, or task status.

## Forbidden Directories Unless Explicitly Requested

- `apps/frontend/src/features/agent-management`
- `apps/backend/src/modules/agent-management`
- Other frontend feature folders.
- Other backend module folders.
- `tests/contract/agent-management-*`
- `tests/component/agent-management-*`
- `tests/e2e/agent-management.spec.ts`
- `packages/shared/src/contracts`
- Package dependency files.
- Build, Vite, Vitest, Playwright, Prisma, and backend runtime config.
- OpenSpec archive folders.
- `.local-docs`

## Keep PRs Under 500 LOC

- Implement one sub-issue at a time.
- Prefer one page/component plus one CSS file per frontend slice.
- Use local mock data for prototype screens until backend work is assigned.
- Avoid broad refactors, shared abstractions, app-shell rewrites, and routing
  changes.
- Update checkboxes only after implementation and verification are complete.

## Avoid Breaking Agent Management

- Do not edit Agent Management files.
- Do not replace the current app shell without checking existing tests.
- Existing tests may assert that `App.tsx` renders Agent Management.
- If a Knowledge Base demo entry point is needed, use a minimal integration that
  preserves existing Agent Management behavior.

## Issue #36 Guidance

Scope only:

- Main Knowledge Base / RAG layout container.
- Header/title area.
- Local navigation between placeholder views.
- Required nav items: Documents, Upload Documents, Data Sources,
  Synchronization Scope, Processing Status.
- Active navigation state.
- Placeholder content for each view.
- Basic styling consistent with the existing frontend.
- No real API calls.

Out of scope:

- Detailed document table.
- Upload logic.
- File validation logic.
- Selected files table.
- Data source connection logic.
- Synchronization tree.
- Manual or automated sync logic.
- Processing job table.
- Backend integration.
- External APIs.
- Functional test cases, test report, or demo script.

Recommended implementation shape for #36:

- `knowledge-base-rag-page.tsx` for local state and placeholder views.
- `knowledge-base-rag-view.css` for feature-prefixed styling.
- Optional README update if decisions change.
- No `react-router` dependency.
- No backend or worker changes.

Do not mark OpenSpec task `3.1` complete for #36 unless the implemented scope
actually includes document list and upload UI beyond placeholder navigation.

## Later Screen Tickets

- Add `knowledge-base-rag-mock-data.ts` when mock rows or source fixtures are
  needed.
- Add `knowledge-base-rag-view.ts` only when a framework-agnostic view model
  removes real duplication or improves tests.
- Add API client code only when backend endpoints exist or are explicitly mocked
  for a scoped prototype.
- Keep upload validation, sync scope, and status tables in separate sub-issues.

## Naming Conventions

- Folder: `knowledge-base-rag`.
- Components: `KnowledgeBaseRagPage`.
- Files: `knowledge-base-rag-page.tsx`, `knowledge-base-rag-view.css`,
  `knowledge-base-rag-mock-data.ts`, `knowledge-base-rag-view.ts`.
- CSS classes: prefix with `knowledge-base-rag-`.
- Test names later: prefix with `knowledge-base-rag`.

## Styling Conventions

- Use plain CSS imported by the feature component.
- Match the existing frontend: light background, white cards, gray borders,
  compact spacing, 6-8px radius, and the existing blue accent.
- Keep layouts responsive with grid/flex and avoid nested cards.
- Keep placeholder text concise and product-specific.

## Testing Expectations

- For documentation-only tasks, report that no tests were run if no code changed.
- For #36 UI code, run at minimum `npm run build` and `git diff --check`.
- For later behavior, add focused component tests in `tests/component`.
- For shared contracts, run `npm run test:contracts`; avoid contract changes
  without review.
- For PR handoff, attempt `openspec validate "implement-knowledge-base-rag"`
  and `openspec validate --all --strict` when the CLI is available.

## Risks And Anti-Patterns

- Mixing upload, sync, table, and backend work into issue #36.
- Adding React Router for a local placeholder screen.
- Calling real APIs from prototype screens before backend scope exists.
- Editing Agent Management to make room for this module.
- Changing shared contracts for local UI placeholder needs.
- Writing synchronous ingestion inside HTTP handlers.
- Letting vector database details leak into frontend or other modules.

## Future Sub-Issue Checklist

- Confirm branch and dirty files with `git status --short --branch`.
- Re-read this guide and the active OpenSpec change.
- Identify the exact sub-issue scope and out-of-scope list.
- Touch only Knowledge Base / RAG-owned files.
- Keep UI, backend, worker, and contract work separated by ticket.
- Add tests with implemented behavior when tests are in scope.
- Run the smallest relevant validation commands.
- Report files changed, commands run, known gaps, and whether other modules were
  untouched.

## Final Response Checklist

- State the concrete files changed.
- State validation commands and outcomes.
- Confirm no other feature modules were modified.
- Confirm no dependencies were added.
- Confirm no implementation code was added when the task was documentation-only.
- Do not commit unless explicitly asked.
