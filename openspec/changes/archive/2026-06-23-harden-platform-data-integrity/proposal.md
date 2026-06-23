## Why

The platform database now has a shared Prisma skeleton, but it still leaves important integrity rules implicit. Before feature teams build deeper module persistence on top of it, the project needs explicit data integrity decisions for uniqueness, tenant isolation, reference behavior, status values, timestamps, and migration safety.

## What Changes

- Add database integrity requirements for shared uniqueness constraints that prevent duplicate memberships, assignments, workflow steps, and similar cross-module records.
- Define a conservative relation policy for the foundation schema: use explicit scalar IDs as module contracts and add foreign keys only where lifecycle ownership is clear.
- Decide which fields remain strings for now and which values must be validated by shared contracts or module logic until a future enum/date migration is intentionally proposed.
- Add schema/migration verification that detects missing unique constraints, unsafe cascades, unsupported status defaults, and accidental removal of existing persisted fields.
- Add migration safety expectations for additive migrations, local backup/restore guidance, and schema-only contract checks.
- Defer module-specific business fields, repositories, and domain behavior to each owning module's persistence change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-data-model-boundaries`: Strengthen the existing database boundary requirements with explicit integrity rules, uniqueness constraints, relation/cascade policy, status/timestamp decisions, and migration safety checks.

## Impact

- Affected code:
  - `packages/database/prisma/schema.prisma`
  - `packages/database/prisma/migrations/*`
  - `tests/contract/platform-data-model-boundaries.test.mjs`
  - `openspec/specs/platform-data-model-boundaries/spec.md`
- Affected systems:
  - Prisma schema validation and migration generation
  - Contract tests for shared database integrity
  - Future module persistence work that depends on tenant isolation and uniqueness guarantees
- No frontend behavior or public HTTP API behavior is expected to change in this hardening step.
