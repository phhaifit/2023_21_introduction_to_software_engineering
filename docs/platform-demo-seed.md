# Full Platform Demo Seed

This runbook prepares a local PostgreSQL-backed demo database for authenticated manual testing across the current project modules.

The seed is a local/demo fixture. It does not mark incomplete module OpenSpec tasks complete, and it does not replace production onboarding, workspace creation, billing, or member-management behavior.

## Docker PostgreSQL Flow

Start PostgreSQL:

```bash
docker compose up -d postgres
docker compose ps
```

Apply the existing Prisma migrations:

```bash
npm run prisma -- migrate deploy
```

Seed full-platform demo data:

```bash
npm run seed:platform-demo
```

Start the local app:

```bash
npm run dev
```

Open the frontend at `http://127.0.0.1:5173`, then log in with:

```text
Email: dev@local.test
Password: Password123!
```

Additional seeded accounts for manual authorization checks:

```text
editor@local.test / Password123!
viewer@local.test / Password123!
nonmember@local.test / Password123!
```

`nonmember@local.test` is intentionally not a member of the seeded demo workspaces.

## Seeded Demo Scope

The seed creates deterministic records for:

- demo users and active workspace memberships
- `workspace-product-demo` plus neighboring demo workspaces used by current frontend demo selectors
- enabled and disabled Agent Management records
- subscriptions, transactions, payment methods, and promo codes
- tools, tool connections, and agent-tool assignments
- workflows, workflow steps, workflow executions, workflow logs
- tasks, task runs, jobs, conversations, and chat messages
- KB/RAG data sources, documents, chunks, indexes, ingestion jobs, sync scope, sync jobs, sync events, runtime jobs, and agent document grants

The command is idempotent. Running it multiple times updates or preserves the same deterministic records instead of requiring `prisma migrate reset`.

## Optional Startup Seed

Normal API startup does not seed PostgreSQL.

For a local-only convenience path, opt in explicitly:

```bash
VCP_SEED_DEMO_ON_START=true npm run dev:api
```

This uses the same seed logic as `npm run seed:platform-demo`.

## Current Follow-ups

Keep these outside the current Agent Management auth/seed integration scope unless a later OpenSpec change expands it:

- Add a Prisma-backed Workspace User Management repository so workspace context can use persisted `workspace_members` directly.
- Replace `DEMO_WORKSPACE_ID` route wiring with authenticated current-workspace selection across the app shell and protected modules.
- Add a shared authenticated Playwright fixture before rewriting the current protected-page E2E tests.
