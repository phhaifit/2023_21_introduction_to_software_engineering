## Why

The current shared database schema only covers the modules that have already implemented persistence, so the remaining feature teams do not have stable cross-module model boundaries to build against. This change establishes a minimum Prisma schema skeleton now so future module work can align on ownership, IDs, workspace scoping, and common lookup fields without each team redefining foundation tables differently.

## What Changes

- Define the platform-wide data model boundary for the minimum shared Prisma models required by the planned modules.
- Add ownership guidance for authentication, workspace, membership, subscription, agent, tool, workflow, task, knowledge, and worker job models.
- Require string IDs aligned with shared `EntityId` kinds and `workspaceId` for workspace-scoped entities.
- Require common indexes for workspace, user, status, and parent-model lookups used across modules.
- Require a generated migration, Prisma validation, and schema contract tests that verify required model names and key fields.
- Defer module-specific business fields and behavior to the owning feature changes.

## Capabilities

### New Capabilities

- `platform-data-model-boundaries`: Defines the minimum shared Prisma schema skeleton, model ownership rules, tenant scoping, and schema verification requirements for cross-module database alignment.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/database/prisma/schema.prisma`
  - `packages/database/prisma/migrations/*`
  - `packages/database/src/index.ts`
  - `tests/contract/*database*` or a new schema contract test
- Affected systems:
  - Prisma validation and migration generation
  - Database package exports
  - Feature module persistence work that depends on shared model names and keys
- No API route or frontend behavior changes are expected in this foundation change.
