## Why

Agent Management currently uses `InMemoryAgentRepository` — all agent data disappears when the server restarts. To move towards production and support upcoming phases (skill writer, RBAC, e2e), we need real persistent storage via Prisma + PostgreSQL.

## What Changes

- Add Prisma model `Agent` to `prisma/schema.prisma` (the repository does not have a Prisma schema file yet).
- Install `prisma` + `@prisma/client` dependencies.
- Run Prisma migration to create the `agents` table in PostgreSQL.
- Implement `PrismaAgentRepository` to satisfy the `AgentRepository` interface (4 methods: `save`, `findById`, `listByWorkspace`, `existsByName`).
- Add a mapper to convert between Prisma records and the domain `Agent` type.
- Update the composition root `local-agent-management-server.ts` to inject `PrismaAgentRepository` at runtime instead of `InMemoryAgentRepository` when the database URL is present.
- Keep `InMemoryAgentRepository` for domain/unit tests.
- Soft-delete: `status = 'deleted'` is kept as is in the current domain; `listByWorkspace` filters by status.
- Scope all queries by `workspaceId` — workspace isolation is mandatory.
- `save` acts as an upsert (insert-or-update).
- `existsByName` compares strings in a case-insensitive, trimmed manner.
- `listByWorkspace` sorts by `createdAt` ascending, supporting optional status filtering.
- Server restart no longer loses data.
- Add repository integration tests for `PrismaAgentRepository` to cover all behaviors.

## Capabilities

### New Capabilities
- `agent-management-persistence`: Durable storage for Agent entities via Prisma ORM — including schema, migration, repository implementation, Prisma-to-domain mapper, workspace-scoped queries, and integration tests.

### Modified Capabilities
_(None — persistence changes are an implementation detail and do not change spec-level behavior of the domain or HTTP API.)_

## Impact

- **Database**: Creates `prisma/schema.prisma` with the `Agent` model and generates migration files.
- **Dependencies**: Adds `prisma` (devDependency) and `@prisma/client` (runtime).
- **Backend composition root**: `local-agent-management-server.ts` switches to using `PrismaAgentRepository` for runtime; type `LocalAgentManagementRuntime.repository` changes to `AgentRepository`.
- **Tests**: Adds an integration test suite for `PrismaAgentRepository`; domain, lifecycle, and API tests continue to use `InMemoryAgentRepository`.
- **Local dev**: `npm run dev` needs `DATABASE_URL` pointing to a PostgreSQL instance.
