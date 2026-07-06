## Context

The repository already has a shared contract package with base files for IDs, statuses, roles, plans, events, API response shape, Agent Management summaries, Subscription Payment summaries, and Task Orchestration request/response contracts.

Task Orchestration recently added `CreateTaskRequest`, `CreateTaskResponse`, and routing selection types under `packages/shared/src/contracts/task-orchestration.ts`. Those contracts intentionally keep authenticated context fields such as `workspaceId` and `submittedByUserId` out of the request body, which is the right direction and should be preserved as the reference pattern.

Current gaps are convention-level rather than feature-level:

- `ApiResponse` exists, but pagination metadata, validation issue shape, and authorization failure shape are not standardized.
- `EntityId` exists, but not every public summary uses branded `EntityId` consistently yet.
- Status constants exist, but the rule for shared versus module-local statuses is not explicit.
- Public DTO exposure rules are partly documented in README files and tests, but not yet enforced as platform conventions.
- Frontend dependency rules exist in monorepo specs, but shared contract tests do not yet verify that frontend features only depend on public shared contracts for cross-module data.

## Goals / Non-Goals

**Goals:**

- Define the convention layer that all feature-owned contracts must follow.
- Preserve existing Task Orchestration contracts and use them as a precedent for request-body boundaries.
- Add or refine small shared primitives for pagination, validation errors, authorization errors, and public summary rules.
- Extend `schema.json` and contract tests so the conventions are verifiable.
- Keep shared contracts dependency-free and safe for frontend, backend, workers, and tests.

**Non-Goals:**

- Do not create full DTO catalogs for Authentication, Workspace, Workspace User, Tools, Workflow, Knowledge, or Subscription feature behavior.
- Do not implement backend routes, frontend pages, persistence, workers, or queue behavior.
- Do not replace module-owned domain models with shared transport DTOs.
- Do not remove or rewrite Task Orchestration contracts that are already valid.
- Do not migrate Prisma schema or database data.

## Decisions

### Decision 1: Modify `shared-contracts` instead of creating a new capability

`openspec/specs/shared-contracts/spec.md` already defines the shared contract foundation. This change extends that capability with convention requirements instead of creating a duplicate `platform-contract-conventions` spec.

Alternative considered: create a new capability for contract conventions. Rejected because it would split closely related requirements across two specs and make future sync/archive more confusing.

### Decision 2: Add contract primitives, not feature DTO catalogs

This change should add shared primitives and rules such as paginated response shape, validation issue shape, authorization error expectations, and DTO exposure rules. Feature-specific create/update/list DTOs remain owned by the relevant `implement-*` changes.

Alternative considered: define every module's request and response DTO now. Rejected because most modules still lack accepted use cases and route contracts; creating a broad DTO catalog now would either be speculative or force teams into incorrect shapes.

### Decision 3: Preserve Task Orchestration request boundary

Task Orchestration already demonstrates the intended request pattern: public request body includes user-supplied intent, while authenticated context comes from route/middleware/application command. This change should codify that convention and keep `CreateTaskRequest` free of `workspaceId`, `submittedByUserId`, generated IDs, status, and timestamps.

Alternative considered: move all Task Orchestration command fields into shared request DTOs. Rejected because it would expose trusted server-side values to callers and weaken API boundaries.

### Decision 4: Use `schema.json` as a contract inventory, not the source of all behavior

`schema.json` should list stable contract inventory needed by tests and reviewers. TypeScript contract files remain the source for exported types and constants.

Alternative considered: generate TypeScript contracts from `schema.json`. Rejected because generation adds tooling overhead without enough benefit for the current student project scope.

### Decision 5: Enforce conventions with focused static contract tests

The implementation should extend `tests/contract/shared-contracts.test.mjs` or add focused contract tests to verify:

- shared contracts do not import backend, frontend, workers, database, Prisma, Express, or React;
- frontend feature code does not import backend, database, workers, or private module implementation for cross-module data;
- public request DTOs do not accept authenticated context fields unless explicitly documented;
- public summary DTOs do not expose secrets, credentials, tokens, hashes, or infrastructure internals.

Alternative considered: rely only on PR review. Rejected because several modules are developed in parallel and review-only conventions are easy to miss.

## Risks / Trade-offs

- [Risk] Tests based on static source scanning can be too strict or too weak. -> Mitigation: keep checks focused on high-risk imports and field names, and document any intentional exceptions in the owning OpenSpec change.
- [Risk] Branded `EntityId` changes can create TypeScript friction in existing code that still uses plain strings. -> Mitigation: harden shared DTOs incrementally and keep module mapper updates in this change limited to contract-facing code.
- [Risk] Adding pagination primitives before all list routes exist may feel premature. -> Mitigation: define only the reusable envelope shape, not endpoint-specific list DTOs.
- [Risk] Contract tests may flag test-only imports from backend modules. -> Mitigation: scope production dependency checks to `apps/frontend` and `packages/shared`; allow contract tests to import backend modules when they are testing backend behavior directly.

## Migration Plan

1. Update shared API contract primitives and schema inventory.
2. Update README/convention comments where useful.
3. Extend shared contract tests for API shapes, DTO boundaries, and dependency direction.
4. Run `npm run test:contracts`, `npm test`, `openspec validate "establish-platform-contract-conventions" --strict`, `openspec validate --all --strict`, and `git diff --check`.

Rollback is file-level: revert the shared contract changes and related tests. No data migration or runtime state rollback is required.

## Open Questions

- Should module-specific validation issue codes be added to the shared API contract now, or should the shared type allow module-owned string codes?
- Should `SubscriptionPublicSummary` and `TransactionPublicSummary` be converted to branded `EntityId` types in this change, or deferred to `implement-subscription-payment` stabilization?
