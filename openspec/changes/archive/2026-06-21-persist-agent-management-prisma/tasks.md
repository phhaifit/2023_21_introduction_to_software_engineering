## 1. Prisma Setup

- [x] 1.1 Install dependencies `prisma` (devDependency) and `@prisma/client` (runtime)
- [x] 1.2 Create `prisma/schema.prisma` with PostgreSQL datasource and `Agent` model (fields: `agentId` @id, `workspaceId`, `name`, `role`, `model`, `instructions`, `status`, `createdAt`, `updatedAt`; index on `workspaceId`; `@@map("agents")`)
- [x] 1.3 Run `npx prisma migrate dev` (or `migrate diff`) to create a migration and generate the Prisma client

## 2. Mapper

- [x] 2.1 Create file `backend/src/modules/agent-management/infrastructure/prisma-agent-mapper.ts` with two functions: `toDomain(record) → Agent` and `toPrismaCreate(agent) → PrismaCreateInput`
- [x] 2.2 Write unit tests for the mapper to ensure accurate conversion between Prisma record and the domain Agent type

## 3. PrismaAgentRepository

- [x] 3.1 Create file `backend/src/modules/agent-management/infrastructure/prisma-agent-repository.ts` implementing the `AgentRepository` interface
- [x] 3.2 Implement `save` using Prisma `upsert` (insert-or-update)
- [x] 3.3 Implement `findById` scoped by `workspaceId` + `agentId`
- [x] 3.4 Implement `listByWorkspace` scoped by `workspaceId`, optional `statuses` filter, sorting by `createdAt` ascending
- [x] 3.5 Implement `existsByName` with case-insensitive trimmed comparison (Prisma `mode: 'insensitive'`)

## 4. Integration Tests

- [x] 4.1 Create test file `tests/contract/agent-management-persistence.test.mjs`
- [x] 4.2 Test `save`: inserting a new agent → record exists in DB
- [x] 4.3 Test `save`: updating an existing agent → record is updated
- [x] 4.4 Test `findById`: agent belongs to the correct workspace → returns domain Agent
- [x] 4.5 Test `findById`: agent does not exist or belongs to another workspace → returns `null`
- [x] 4.6 Test `listByWorkspace`: returns only agents in the correct workspace, ordered by `createdAt` ascending
- [x] 4.7 Test `listByWorkspace`: filter by `statuses` → returns only agents with matching status
- [x] 4.8 Test `listByWorkspace`: deleted agents are excluded when filtering by `['enabled', 'disabled']`
- [x] 4.9 Test `existsByName`: returns `true` for exact match and case-insensitive match; returns `false` for nonexistent names or names in another workspace

## 5. Composition Root Update

- [x] 5.1 Update `local-agent-management-server.ts`: dynamically import `PrismaClient` + `PrismaAgentRepository` and inject into `AgentLifecycleUseCases` if `DATABASE_URL` is provided
- [x] 5.2 Change type `LocalAgentManagementRuntime.repository` to `AgentRepository` interface
- [x] 5.3 Update seed logic to use `repository.save()` via interface, and restrict it to running only for `InMemoryAgentRepository`

## 6. Verification

- [x] 6.1 Run `npm test` — all existing and new tests pass
- [x] 6.2 Run `npm run build` — build is successful
- [x] 6.3 Run `openspec validate "persist-agent-management-prisma"` — passes
- [x] 6.4 Run `openspec validate --all --strict` — all pass
- [x] 6.5 Run `git diff --check` — no trailing whitespace
