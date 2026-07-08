## Context

Agent Management was implemented and verified before Authentication became the enforced route boundary. The current app shell protects `/agents` with `RequireAuth`, but the Agent Management API client can still use raw `fetch`, so browser requests can reach `/api/workspaces/:workspaceId/agents` without an `Authorization` header.

The backend now resolves authenticated user context before workspace-scoped routes. Workspace context then requires an active membership before Agent Management handlers can run. With PostgreSQL enabled, the demo database can also miss the stable demo user, workspace membership, agent records, and neighboring module records that the earlier in-memory/local runtime partially provided.

This change stabilizes Agent Management in the authenticated app and provides a complete local PostgreSQL seed for project-wide manual testing. The seed is a demo/test fixture, not proof that incomplete feature modules have met their OpenSpec requirements.

## Goals / Non-Goals

**Goals:**

- Ensure Agent Management frontend requests include the active authentication token by default.
- Provide an idempotent full-platform local/demo PostgreSQL seed for project-wide manual testing.
- Keep the demo identity, workspaces, memberships, agents, subscriptions, workflows, tasks, tools, and KB/RAG records aligned enough that incomplete neighboring modules do not block Agent Management integration.
- Verify the protected route behavior with focused automated tests.
- Document the local Docker PostgreSQL migrate/seed/demo flow.

**Non-Goals:**

- Implement a full Prisma-backed Workspace User Management repository.
- Replace `DEMO_WORKSPACE_ID` with a dynamic current-workspace selector.
- Redesign the Agent Management UI.
- Change the Agent Management public API route paths.
- Update current E2E coverage or introduce a shared authenticated E2E fixture.
- Add new production dependencies.
- Change the Prisma schema unless implementation discovers a blocking schema mismatch.

## Decisions

1. Use `authorizedFetch` as the default Agent Management frontend transport.
   - Rationale: Authentication already stores the active token in the shared frontend auth storage key, and other feature clients already use `authorizedFetch`.
   - Alternative considered: Pass the token through every Agent Management page component. Rejected because it spreads auth transport concerns into presentation code.
   - Implementation note: `createAgentManagementApiClient` must still accept an injected `fetchImplementation` so existing focused tests can inspect request behavior without depending on browser storage.

2. Seed a stable demo identity instead of relying on ad hoc registered users.
   - Rationale: A deterministic demo login avoids the current mismatch where a registered DB user can authenticate but may not be a member of `workspace-product-demo`.
   - Seed target: `local-dev-user` with `dev@local.test` and the documented local password, plus additional role-specific users for permission checks.
   - Alternative considered: Automatically grant every registered user access to the demo workspace. Rejected because it weakens the workspace membership boundary and hides authorization bugs.

3. Seed complete platform demo data with existing Prisma models.
   - Rationale: The project needs a stable local database baseline for manual testing across modules while several features remain incomplete or partially integrated.
   - Seed target: demo users, workspaces, active workspace memberships, invitations, agents, subscriptions, transactions, payment methods, promo codes, tools, tool connections, agent tool assignments, workflows, workflow steps, workflow executions/logs, tasks, task runs, conversations/messages, KB/RAG data sources, documents, chunks, indexes, sync/ingestion/runtime jobs, document grants, and generic jobs where useful.
   - Alternative considered: Seed only Agent Management data. Rejected because neighboring module pages can still conflict with the demo when their required database rows are absent.

4. Use an explicit seed command as the primary entry point.
   - Rationale: `npm run seed:platform-demo` gives developers a visible, repeatable command after migrations and avoids hidden writes during every server start.
   - Local bootstrap decision: the local server may call the same seed only when an explicit development flag is set, for example `VCP_SEED_DEMO_ON_START=true`.
   - Alternative considered: Always seed on `npm run dev`. Rejected because automatic writes hide missing setup and can surprise developers inspecting local database state.

5. Keep Workspace User Management Prisma persistence as follow-up.
   - Rationale: The immediate integration failure can be resolved by aligning the demo identity and membership used by the local runtime. Implementing the complete repository belongs to the `implement-workspace-user-management` lane and can exceed a small demo integration PR.
   - Follow-up: Add a Prisma-backed Workspace User Management repository and make workspace context resolution read persisted `workspace_members` as the source of truth.

6. Keep `DEMO_WORKSPACE_ID` for this change.
   - Rationale: Replacing it requires authenticated workspace selection across app shell, Workspace Management, Agent Management, and several other feature pages. That is a separate product integration step.
   - Follow-up: Replace route-level demo workspace wiring with selected/current workspace state after Workspace Management and Workspace User Management agree on the public contract.

7. Make the seed idempotent.
   - Rationale: Developers should be able to run migrate/seed repeatedly against Docker PostgreSQL without duplicate records or destructive resets.
   - Alternative considered: `prisma migrate reset` as the normal demo path. Rejected because it destroys local data and is unsafe as the default integration instruction.

8. Do not update E2E in this change.
   - Rationale: Current E2E files are not consistently auth-aware, and migrating all protected-module E2E coverage would broaden this change beyond the Agent Management conflict fix.
   - Alternative considered: Create a shared authenticated Playwright fixture now. Rejected because it would force unrelated modules to absorb auth/test rewrites before Agent Management conflict resolution is stable.

## Risks / Trade-offs

- Demo seed could mask missing production onboarding behavior -> Keep the seed explicitly local/demo-only and document that production workspace creation/membership remains separate.
- Full demo data can make incomplete modules look more complete than they are -> Document seed records as test fixtures and keep feature readiness tied to OpenSpec/tasks/tests.
- Keeping `DEMO_WORKSPACE_ID` means the app is still not fully multi-workspace-ready -> Call this out as follow-up and avoid claiming complete workspace selection.
- Workspace membership can remain split between local runtime memory and database during this slice -> Keep user IDs aligned now, then move to the Prisma WUM repository in a later change.
- Not updating E2E leaves browser automation red for protected pages -> Record this as an explicit known gap instead of blocking this integration seed change.

## Migration Plan

1. Apply existing Prisma migrations to the local Docker PostgreSQL database.
2. Run `npm run seed:platform-demo`.
3. Start the local API and frontend.
4. Log in with the seeded demo credentials.
5. Open `/agents` and neighboring project pages for manual verification against seeded data.

Rollback for local data is backup/restore or dropping the local Docker volume. No production data migration is introduced by this change.

## Resolved Decisions

- Seed entry point: provide `npm run seed:platform-demo` as the required path; local server bootstrap is opt-in only.
- Seed breadth: create full-platform demo data using existing schema tables so project-wide manual testing is possible.
- E2E scope: do not update current E2E coverage in this change; keep E2E fixture cleanup as follow-up after Agent Management auth/seed conflict is resolved.
