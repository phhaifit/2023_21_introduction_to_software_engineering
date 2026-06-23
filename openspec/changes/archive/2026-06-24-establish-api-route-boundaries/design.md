## Context

The repository already has a modular monolith foundation, shared API envelope contracts, shared DTO exposure rules, Prisma schema boundaries, and module ownership documentation. Feature progress is uneven:

- Agent Management has implemented backend API routes under `/api/workspaces/:workspaceId/agents`, a frontend API client, tests, RBAC checks, and optional Prisma persistence.
- Subscription & Payment has backend routes under `/api/subscriptions`, but the current router uses a `success` response shape and needs documented alignment with the shared `ApiResponse` convention before production use.
- Task & Orchestration has a detailed route foundation for `POST /api/workspaces/:workspaceId/tasks`, but it does not yet implement HTTP handlers.
- Authentication, Workspace Management, Workspace User Management, Tools & Integration, Workflow Management, and Knowledge Base / RAG still have active OpenSpec changes with unchecked implementation tasks and mostly skeleton module folders or frontend prototype work.

Phase 4 therefore needs to define route ownership and API boundaries without taking over each module owner's implementation work.

## Goals / Non-Goals

**Goals:**

- Produce a reviewed route matrix that lists method, path, owner module, auth requirement, workspace scoping, request contract reference, response contract reference, and current status.
- Normalize common API rules for `/api` prefixing, workspace scoping, route parameter ownership, shared response envelopes, pagination metadata, validation errors, authentication errors, authorization errors, and owner modules.
- Confirm already implemented Agent Management routes as the canonical Agent API boundary.
- Document Subscription & Payment routes as existing but requiring shared-envelope alignment in its module implementation.
- Give each module owner a stable checklist for implementing endpoints route-by-route after this matrix is accepted.

**Non-Goals:**

- Do not implement controllers, routers, use cases, repositories, workers, Prisma migrations, frontend API clients, or Postman execution behavior.
- Do not define every field of every feature request body before the owning module's OpenSpec change introduces the final public contract.
- Do not change existing runtime behavior in Agent Management or Subscription & Payment.
- Do not make the Postman collection a source of truth; it can mirror the accepted matrix only if useful.

## Decisions

### Use a Documentation-Backed API Matrix

Create a canonical matrix document, likely `docs/api/module-api-contracts.md`, with one section per module. Each route row will include:

- method
- path
- owner module
- auth requirement
- workspace scoping rule
- request contract reference
- response contract reference
- status: `implemented`, `provisional-existing`, or `planned`
- notes for handoff, async worker delegation, or security constraints

Alternative considered: add every route as TypeScript constants in `@vcp/shared`. Rejected for this change because many modules have not finalized request DTOs yet, and the goal is route ownership, not runtime routing implementation.

### Keep Workspace-Scoped Business APIs Under Workspace Routes

Workspace-owned data uses `/api/workspaces/:workspaceId/...` so the route parameter remains the tenant locator. The request body must not accept trusted context fields such as `workspaceId`, `userId`, `submittedByUserId`, generated IDs, lifecycle status, timestamps, or infrastructure fields unless a module-specific OpenSpec change documents an exception.

Alternative considered: use module-root routes for every capability, such as `/api/agents` or `/api/tasks`. Rejected because the platform architecture already treats `workspaceId` as the primary tenant boundary for workspace-owned data.

### Keep Authentication And Billing Outside Workspace Routes

Authentication routes use `/api/auth/...` because they create or resolve user/session context before a workspace is selected. Subscription & Payment keeps `/api/subscriptions/...` because the current implementation is user/subscription-centered and may later coordinate workspace provisioning through events or workers.

Alternative considered: force subscriptions under `/api/workspaces/:workspaceId/subscriptions`. Rejected for this change because the existing feature uses user-owned subscription state and the final workspace provisioning handoff belongs to Subscription & Payment plus Workspace Management module changes.

### Treat Existing Routes According To Their Current Maturity

Agent Management routes are documented as `implemented` because they have router, frontend client, and tests. Subscription & Payment routes are documented as `provisional-existing` because they exist but must be brought into the shared envelope convention. Task & Orchestration's `POST /api/workspaces/:workspaceId/tasks` is documented as `planned` unless an implementation PR lands before this change is applied.

Alternative considered: mark every route as planned. Rejected because reviewers need to see where the codebase already has API behavior and where the matrix is only a future contract.

### Verify The Matrix With Lightweight Contract Tests

Add a focused documentation/contract test that checks the matrix exists, includes every capability owner, includes required common route rules, and records existing route status for Agent Management and Subscription & Payment. The test should not require a running server.

Alternative considered: write full HTTP tests for every route. Rejected because most routes are intentionally not implemented in this change.

## Risks / Trade-offs

- API matrix becomes stale -> Add a contract test and require module PRs to update the matrix when they add or change public routes.
- Route names are accepted before request DTOs are final -> Use contract references and owner notes instead of inventing detailed request fields for modules that have not implemented their public DTOs.
- Subscription & Payment shape conflicts with shared `ApiResponse` -> Mark it as `provisional-existing` and keep the alignment work in the Subscription & Payment module scope.
- Matrix is mistaken for implemented behavior -> Include explicit route status and keep this change out of runtime controller code.
- Nested routes may blur module ownership -> Each route row must name the owner module, and cross-module data access must use APIs, DTOs, domain events, or public shared contracts.
