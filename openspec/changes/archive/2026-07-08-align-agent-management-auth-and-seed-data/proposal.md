## Why

Agent Management was completed before Authentication became the enforced boundary for protected workspace routes. The current local demo can render the authenticated shell, but Agent Management API calls may still omit the bearer token, and a PostgreSQL-backed demo database can lack the required workspace membership, agents, and neighboring module data needed for project-wide manual verification.

This change aligns Agent Management with the completed Authentication flow and creates a complete local platform demo seed so incomplete or partially integrated modules do not block Agent Management integration and project demo preparation.

## What Changes

- Make the Agent Management frontend API client send authenticated requests by default while preserving test injection support.
- Add an idempotent `npm run seed:platform-demo` path for PostgreSQL that creates complete local demo records across the implemented/provisional project modules.
- Seed stable demo users, workspaces, memberships/roles, agents, subscriptions/payment records, workflows, tasks/conversations, tools/tool assignments, and KB/RAG records using the existing Prisma schema.
- Keep seed execution explicit by default; local server bootstrap may call the same seed only through an opt-in development flag.
- Update Agent Management integration tests to cover the real protected-route behavior:
  - missing authentication returns `401 auth.unauthorized`
  - authenticated non-member returns `403 auth.forbidden`
  - authenticated active member can list and mutate seeded demo agents
- Document the local Docker PostgreSQL migration and full-platform seed flow needed for project-wide manual testing.
- Keep E2E migration out of this change; Agent Management conflict resolution should not be blocked by unrelated protected-module E2E rewrites.
- Keep the existing `DEMO_WORKSPACE_ID` route wiring for this change so the demo can be stabilized without expanding into full workspace selection.
- Treat a Prisma-backed Workspace User Management repository and replacement of `DEMO_WORKSPACE_ID` with authenticated workspace selection as follow-up work if they exceed the demo integration scope.

## Capabilities

### New Capabilities

- `full-platform-demo-seed-data`: Defines complete local/demo PostgreSQL seed requirements for project-wide manual testing.

### Modified Capabilities

- `agent-management-ui-api-integration`: Agent Management browser API calls must participate in the authenticated frontend request flow.
- `agent-management-http-api`: Protected Agent Management API behavior must be verified with unauthenticated, authenticated non-member, and authenticated active-member scenarios.

## Impact

- Frontend: `apps/frontend/src/features/agent-management` API client and focused component/API-client tests.
- Backend/local runtime: explicit full-platform seed entry point plus optional opt-in development bootstrap through the local composition root.
- Database: uses existing Prisma models without requiring a schema change.
- Tests: contract/runtime tests for auth, membership, seed idempotency, and seeded Agent Management access. E2E updates are out of scope for this change.
- Documentation: local PostgreSQL/Docker migrate/seed runbook for project-wide manual testing.
