## Why

Feature teams are implementing modules at uneven speeds, and several modules still lack stable public API route ownership. Without a shared API contract matrix, teams can accidentally invent conflicting paths, request shapes, response envelopes, workspace scoping rules, and ownership assumptions.

This change establishes route boundaries before more controllers are added so implementation PRs can follow a reviewed route, method, owner, auth, tenancy, and contract reference.

## What Changes

- Define a platform API route matrix covering Authentication, Workspace Management, Workspace Members, Agent Management, Subscription & Payment, Tools & Integration, Workflow Management, Task & Orchestration, and Knowledge Base / RAG.
- Define common API route rules for `/api` prefixing, workspace scoping, authenticated context, shared response envelopes, pagination, validation errors, and owner modules.
- Confirm existing Agent Management routes under `/api/workspaces/:workspaceId/agents` as already implemented route boundaries.
- Confirm existing Subscription & Payment routes under `/api/subscriptions` as provisional existing route boundaries that must align with the shared `ApiResponse` envelope before production use.
- Define route ownership only; do not implement controllers, services, repositories, Prisma logic, workers, or frontend API clients in this change.
- Add or update documentation for the API matrix so module owners can implement endpoints route-by-route after the matrix is accepted.
- Add lightweight verification that the route matrix exists and does not conflict with existing shared contract conventions.

## Capabilities

### New Capabilities

- `api-route-boundaries`: Defines the platform API route matrix, route ownership, common HTTP boundary rules, workspace scoping expectations, auth requirements, request/response contract references, and shared error expectations.

### Modified Capabilities

- None.

## Impact

- Affected planning artifacts: `openspec/changes/establish-api-route-boundaries`.
- Affected documentation: likely `docs/api/module-api-contracts.md`; the existing Postman collection may be updated only if it helps reviewers inspect the accepted route matrix.
- Affected tests: contract/documentation checks may be added under `tests/contract` to verify the matrix remains present and aligned with common route rules.
- Affected API behavior: no runtime behavior changes in this change. Existing Agent Management and Subscription & Payment APIs remain untouched except for documented boundary status.
- Dependencies: no new production dependency.
