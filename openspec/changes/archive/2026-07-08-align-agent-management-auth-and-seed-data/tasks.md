## 1. Frontend Auth Transport

- [x] 1.1 Update the Agent Management API client to use the shared authenticated request mechanism by default.
- [x] 1.2 Preserve injected fetch support for focused client tests and non-browser test harnesses.
- [x] 1.3 Add or update API-client tests proving list and mutation requests include auth through the default transport and still expose `auth.unauthorized` / `auth.forbidden` failures.

## 2. Full Platform Demo Seed

- [x] 2.1 Add an idempotent root seed command, `npm run seed:platform-demo`, for migrated local PostgreSQL databases.
- [x] 2.2 Seed stable demo users, demo workspaces, active workspace memberships, invitations, and role coverage for manager/editor/viewer-style manual checks.
- [x] 2.3 Seed deterministic Agent Management data, including enabled/disabled agents and any related tool/knowledge records needed by agent-adjacent screens.
- [x] 2.4 Seed neighboring module data for subscription/payment, workflow, task/conversation, tools/integration, and KB/RAG using existing Prisma models.
- [x] 2.5 Ensure repeated seed runs do not duplicate seeded records and do not require `prisma migrate reset`.
- [x] 2.6 Add an opt-in local server bootstrap path that invokes the same seed logic only when an explicit development setting is enabled.
- [x] 2.7 Align local runtime workspace context with the seeded demo identity so authenticated demo requests can pass membership checks without implicit fake auth.

## 3. Integration Tests

- [x] 3.1 Update Agent Management local-runtime tests to assert unauthenticated requests return `401 auth.unauthorized`.
- [x] 3.2 Add or update coverage for authenticated non-member access returning `403 auth.forbidden`.
- [x] 3.3 Add or update coverage for the seeded authenticated active member listing and mutating Agent Management records.
- [x] 3.4 Add or update seed idempotency coverage for representative seeded records across project modules.
- [x] 3.5 Keep current E2E coverage out of scope and document that shared authenticated E2E fixture cleanup is a follow-up.

## 4. Documentation and Verification

- [x] 4.1 Document the Docker PostgreSQL migrate/seed/start/login flow for the full-platform authenticated demo.
- [x] 4.2 Document follow-up scope for a Prisma Workspace User Management repository and replacing `DEMO_WORKSPACE_ID` with authenticated workspace selection.
- [x] 4.3 Run `npm test`.
- [x] 4.4 Run `npm run build`.
- [x] 4.5 Run `openspec validate "align-agent-management-auth-and-seed-data" --strict`.
- [x] 4.6 Run `openspec validate --all --strict`.
- [x] 4.7 Run `npm run prisma -- validate`.
- [x] 4.8 Run `git diff --check`.
