## Context

Agent Management has completed 3 phases (App Shell, HTTP API, UI↔API). The current architecture is hexagonal/ports-and-adapters:

- **Port:** `AgentRepository` interface (`save`, `findById`, `listByWorkspace`, `existsByName`)
- **Current Adapter:** `InMemoryAgentRepository` — data is lost on restart
- **Use cases:** `AgentLifecycleUseCases` depends only on the `AgentRepository` interface
- **Composition root:** `local-agent-management-server.ts` initializes repository + use cases + Express router
- **Domain model:** `Agent` is a plain TypeScript type (not a class), factory function `createAgent` creates instances, `EntityId<K>` is a branded string

The repository does not have any Prisma schema files yet.

## Goals / Non-Goals

**Goals:**
- Initialize Prisma schema with the `Agent` model mapped accurately to the existing domain type.
- Implement `PrismaAgentRepository` to satisfy the `AgentRepository` interface, replicating all behaviors of `InMemoryAgentRepository`.
- 2-way Mapper between Prisma record and domain `Agent` type.
- Workspace isolation: all queries are scoped by `workspaceId`.
- `save` acts as an upsert (using Prisma `upsert`).
- `existsByName` compares in a case-insensitive manner (using Prisma `mode: 'insensitive'`).
- `listByWorkspace` sorts by `createdAt` ascending, supports status filters.
- Deleted agents (`status = 'deleted'`) do not appear in `listByWorkspace` when not explicitly filtered.
- Server restart retains data.
- Integration tests verify all behaviors directly against the test database.

**Non-Goals:**
- Do not change the `Agent` domain model or `AgentStatus`.
- Do not change the HTTP API contracts.
- Do not implement real RBAC — continue using mock request contexts.
- Do not call Docker/OpenClaw directly.
- Do not migrate data from in-memory to database (fresh start).

## Decisions

### 1. Prisma Schema — Model `Agent`

```prisma
model Agent {
  agentId      String @id
  workspaceId  String
  name         String
  role         String
  model        String
  instructions String
  status       String @default("enabled")
  createdAt    String
  updatedAt    String

  @@index([workspaceId])
  @@map("agents")
}
```

**Rationale:**
- `agentId` is the primary key (domain already uses `EntityId<"agentId">`).
- `workspaceId` has a separate index to optimize scoped queries.
- `status`, `createdAt`, `updatedAt` use `String` instead of Prisma DateTime/enum because the domain type already uses ISO strings and union types.
- `@@map("agents")` sets a clear table name.

### 2. Mapper Pattern

File: `backend/src/modules/agent-management/infrastructure/prisma-agent-mapper.ts`

- `toDomain(record: PrismaAgent): Agent` — casts a Prisma row to the domain `Agent` type.
- `toPrismaCreate(agent: Agent): PrismaAgentCreateInput` — maps domain to Prisma input.
- Deep conversion is not needed because the domain type is a plain object and fields share the same types.

### 3. PrismaAgentRepository

File: `backend/src/modules/agent-management/infrastructure/prisma-agent-repository.ts`

- Receives `PrismaClient` via constructor injection.
- `save`: uses `prisma.agent.upsert({ where: { agentId }, create: ..., update: ... })`.
- `findById`: `prisma.agent.findFirst({ where: { agentId, workspaceId } })`.
- `listByWorkspace`: `prisma.agent.findMany({ where: { workspaceId, status: { in: filters.statuses } }, orderBy: { createdAt: 'asc' } })`.
- `existsByName`: `prisma.agent.findFirst({ where: { workspaceId, name: { equals: name.trim(), mode: 'insensitive' } } })`.

### 4. Composition Root Update

File: `backend/src/local-agent-management-server.ts`

- Import `PrismaClient` and `PrismaAgentRepository` dynamically.
- Initialize `PrismaClient`, pass it into `PrismaAgentRepository` if the `DATABASE_URL` exists.
- Type `LocalAgentManagementRuntime.repository` changes to `AgentRepository` (interface) rather than the specific `InMemoryAgentRepository`.
- Seed data logic continues to use `repository.save()` (as the interface supports it), but runs only for the in-memory mode.

### 5. Test Strategy

- **Domain/lifecycle/API tests:** Remain on `InMemoryAgentRepository` — no changes.
- **Prisma integration tests:** New file `tests/contract/agent-management-persistence.test.mjs`:
  - Test all 4 methods: `save` (create + update), `findById`, `listByWorkspace`, `existsByName`.
  - Test workspace isolation: an agent in workspace A is not visible from workspace B.
  - Test status filtering: deleted agents are filtered out by default.
  - Test case-insensitive `existsByName`.
  - Test `listByWorkspace` ordering.
  - Use a separate test database PostgreSQL (env `DATABASE_URL`).
  - Setup/teardown: `prisma.agent.deleteMany()` before/after each test block.
  - Skip gracefully when `DATABASE_URL` is not provided.

## Risks / Trade-offs

- **Risk:** PostgreSQL is unavailable in CI/CD or local dev.
  **Mitigation:** Tests skip gracefully. Added `.env.example` to document `DATABASE_URL` requirement.
- **Risk:** Prisma `mode: 'insensitive'` only works with certain database providers.
  **Mitigation:** PostgreSQL has built-in support; if switching DBs later, this will need review.
- **Trade-off:** Using `String` for `status`/`createdAt`/`updatedAt` instead of Prisma native types.
  **Rationale:** Maintains consistency with domain types, preventing complex conversion between layers.
