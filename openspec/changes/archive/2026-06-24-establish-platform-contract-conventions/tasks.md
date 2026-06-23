## 1. Baseline Contract Audit

- [x] 1.1 Inspect existing shared contract files under `packages/shared/src/contracts`.
- [x] 1.2 Confirm existing Task Orchestration request and response contracts remain in scope and must not be rewritten.
- [x] 1.3 Identify public DTOs that still use plain strings for known entity IDs and decide whether to convert them now or document a deferred compatibility note.
- [x] 1.4 Identify current API response, validation error, authorization error, and pagination gaps.

## 2. Shared API And Identity Primitives

- [x] 2.1 Extend `api.ts` with reusable pagination metadata or paginated response helpers.
- [x] 2.2 Extend `api.ts` with a stable validation issue shape for field-level errors.
- [x] 2.3 Confirm authentication and authorization failures can be represented distinctly by shared error codes.
- [x] 2.4 Preserve existing `ApiSuccess<T>`, `ApiFailure`, and `ApiResponse<T>` compatibility.
- [x] 2.5 Keep `EntityId` as the canonical cross-module identifier type.

## 3. Contract Convention Documentation And Inventory

- [x] 3.1 Update `schema.json` with the convention inventory needed by contract tests.
- [x] 3.2 Update shared contracts README with scope, public DTO, request DTO, and dependency rules.
- [x] 3.3 Ensure `index.ts` exports any new shared API primitives.
- [x] 3.4 Avoid adding full feature DTO catalogs for modules whose own `implement-*` changes are still pending.

## 4. Contract Verification

- [x] 4.1 Extend shared contract tests for API envelope, pagination, validation issue, and authorization error conventions.
- [x] 4.2 Add or extend tests that shared contracts do not import backend, frontend, workers, database, Prisma, Express, React, or private app modules.
- [x] 4.3 Add or extend tests that frontend feature code does not import backend, database, workers, or private module implementation files for cross-module data.
- [x] 4.4 Add or extend DTO exposure checks for obvious secret, credential, token, password, hash, private key, and infrastructure fields.
- [x] 4.5 Verify Task Orchestration public request DTOs still exclude `workspaceId`, `submittedByUserId`, generated IDs, lifecycle status, and timestamps.

## 5. Verification

- [x] 5.1 Run `npm run test:contracts`.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Run `openspec validate "establish-platform-contract-conventions" --strict`.
- [x] 5.4 Run `openspec validate --all --strict`.
- [x] 5.5 Run `git diff --check`.
