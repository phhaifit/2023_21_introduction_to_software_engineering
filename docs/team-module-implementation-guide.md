# Team Module Implementation Guide

Use this guide before implementing module endpoints, persistence, shared contracts, workers, or UI behavior.

OpenSpec is the source of truth. Do not start from memory, README feature summaries, or chat context alone.

## Read Before Coding

Read these files in order:

1. `README.md`
2. `docs/requirements.md`
3. `docs/architecture.md`
4. `docs/module-ownership.md`
5. `docs/api/module-api-contracts.md`
6. `docs/openspec-team-guide.md`
7. `docs/pr-checklist.md`
8. `openspec/specs/platform-architecture/spec.md`
9. `openspec/specs/project-skeleton/spec.md`
10. `openspec/specs/shared-contracts/spec.md`
11. `openspec/specs/platform-data-model-boundaries/spec.md`
12. `openspec/specs/api-route-boundaries/spec.md`
13. Your active module change under `openspec/changes/implement-*`

For your active change, read:

- `proposal.md`
- `design.md`
- every `spec.md` under the change
- `tasks.md`

## Start a Module Task

1. Pull the latest `master`.
2. Confirm your assigned module in `docs/module-ownership.md`.
3. Confirm the route rows for your module in `docs/api/module-api-contracts.md`.
4. Pick one task from your module change's `tasks.md`.
5. Create a branch for that task.
6. Implement only the selected task and only inside the allowed module boundary.
7. Add focused tests for the behavior implemented in that task.
8. Run verification commands before requesting review.

Recommended branch pattern:

```text
feature/<capability>/<task-short-name>
test/<capability>/<task-short-name>
docs/<capability>/<task-short-name>
```

## Module Boundary Rules

You may edit files in:

- Your backend module under `apps/backend/src/modules/<capability>`
- Your frontend feature under `apps/frontend/src/features/<capability>`
- Your active OpenSpec change under `openspec/changes/<change-name>`
- Tests directly related to your module behavior
- Shared files only when the active OpenSpec task explicitly requires it

You may import:

- `@vcp/shared`
- `@vcp/database` from backend or worker code only
- `apps/backend/src/shared/*`
- files inside your own module

You must not import:

- another module's private service
- another module's private repository
- another module's private UI component
- Prisma internals by relative path
- backend, database, or worker files from frontend code

If you need another module's data, use a public API, DTO, domain event, adapter, or shared contract.

## Per-Module Checklist

Copy this checklist into your planning notes or PR description and fill it in for each implementation slice.

```md
## Module Scope

- Capability:
- Active OpenSpec change:
- Selected task:
- Backend folder:
- Frontend folder:
- API matrix section:

## Allowed Files

- [ ] Backend changes stay inside the assigned module or approved shared boundary.
- [ ] Frontend changes stay inside the assigned feature or approved app shell boundary.
- [ ] Tests are focused on the implemented behavior.
- [ ] OpenSpec task updates match completed and verified work.

## API Boundary

- [ ] Route exists in `docs/api/module-api-contracts.md`.
- [ ] Method and path match the matrix.
- [ ] Workspace-scoped routes use `/api/workspaces/:workspaceId/...`.
- [ ] Request body does not accept trusted context such as `workspaceId`, `userId`, `submittedByUserId`, generated IDs, status, or timestamps.
- [ ] Successful responses use `ApiResponse`, `ApiSuccess`, or `ApiPaginatedSuccess`.
- [ ] Failures use shared error expectations for validation, authentication, authorization, not-found, and unexpected errors.

## Shared Contracts

- [ ] No shared contract change is needed.
- [ ] If a shared contract change is needed, the current contract gap is documented.
- [ ] Shared DTOs do not expose secrets, credentials, hashes, private config, raw infrastructure fields, or server-owned mutation fields.
- [ ] Contract tests are added or updated when shared contracts change.

## Prisma and Persistence

- [ ] No Prisma schema change is needed.
- [ ] If a Prisma schema change is needed, it matches the data model boundary spec.
- [ ] Backend code uses `@vcp/database` exports instead of relative Prisma imports.
- [ ] Migration and Prisma validation commands are documented in the PR.

## Domain Events and Workers

- [ ] No cross-module event or worker handoff is needed.
- [ ] If an event is needed, it uses the shared domain event naming and payload rules.
- [ ] Slow or retryable work is delegated to worker boundaries instead of blocking HTTP requests.

## Tests and Verification

- [ ] Unit/service tests cover business behavior.
- [ ] Contract tests cover public boundaries when routes, contracts, schema, or docs change.
- [ ] Component or E2E tests cover user-visible frontend behavior when relevant.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `openspec validate "<change-name>" --strict` passes.
- [ ] `openspec validate --all --strict` passes.
- [ ] `git diff --check` passes.

## Out of Scope

- [ ] No unrelated module behavior is implemented.
- [ ] No private cross-module imports are introduced.
- [ ] No new production dependency is added without approval.
- [ ] No `.local-docs/` file is staged or committed.
```

## Shared Boundary Change Rule

Before changing `packages/shared/src/contracts`, `@vcp/shared` exports, Prisma schema, API route boundaries, or domain events:

1. Explain why the current boundary is insufficient.
2. Confirm the active OpenSpec task requires the change.
3. Update the relevant spec or design artifact.
4. Add or update focused contract tests.
5. Run the relevant validation command.
6. Ask another module owner to review.

## Required Commands

Run these before requesting review:

```bash
npm test
npm run build
openspec validate "<change-name>" --strict
openspec validate --all --strict
git diff --check
```

Run these when relevant:

```bash
npm run test:contracts
npm run prisma -- validate
npm run prisma -- migrate deploy
npm run test:e2e
```

## PR Handoff

Every PR must state:

- capability name
- OpenSpec change name
- selected task
- scope implemented
- out-of-scope items
- shared contracts changed, if any
- Prisma schema or migration changed, if any
- API route rows affected
- domain events or worker handoffs affected
- tests and commands executed
- known gaps or follow-up tasks
