## Context

The platform database foundation now defines a shared Prisma schema skeleton for the planned modules. It intentionally avoided deep relations and module-specific fields so teams could align quickly. The next risk is that feature teams will build persistence on top of a schema that still lacks explicit integrity rules for duplicate records, reference ownership, status values, timestamp strategy, and migration safety.

This change hardens the shared database rules without implementing module repositories or feature-specific business behavior.

## Goals / Non-Goals

**Goals:**

- Add shared uniqueness constraints that prevent obvious duplicate cross-module records.
- Keep tenant isolation enforceable through `workspaceId` and workspace-scoped uniqueness where relevant.
- Define a conservative relation policy for foreign keys and cascade behavior.
- Keep the current string timestamp and status approach, while requiring validation against shared contracts or module-owned rules.
- Add contract coverage for uniqueness constraints, unsafe cascades, status defaults, timestamp field consistency, and migration safety.
- Preserve compatibility for existing Agent Management and Subscription Payment persistence.

**Non-Goals:**

- Convert all timestamps to Prisma `DateTime`.
- Convert all status fields to Prisma enums.
- Add full foreign-key graphs across every model.
- Add business fields, repositories, APIs, or seed data for every module.
- Define complete product database readiness or operations runbooks.

## Decisions

### 1. Add targeted unique constraints before module persistence expands

The schema should add uniqueness only where duplication is clearly invalid across modules:

- `WorkspaceMember`: one membership per `workspaceId` and `userId`.
- `Invitation`: avoid duplicate active/pending invitation rows for the same `workspaceId`, `email`, and `status`.
- `Agent`: avoid duplicate agent names inside a workspace.
- `ToolConnection`: avoid duplicate connection rows for a workspace and tool.
- `AgentToolAssignment`: avoid duplicate tool assignment rows for an agent in a workspace.
- `WorkflowStep`: avoid duplicate step orders inside a workflow.
- `TaskRun`: avoid duplicate `jobId` linkage where a task run is tied to a job.
- `KnowledgeAccessGrant`: avoid duplicate agent/document grants inside a workspace.

Alternative considered: wait for every module to define its own constraints. Rejected because duplicate data shapes would spread quickly and be harder to reconcile after module work lands.

### 2. Keep scalar references as the module boundary, add foreign keys only when lifecycle ownership is clear

The existing foundation deliberately uses scalar references such as `workspaceId`, `agentId`, `workflowId`, and `documentId`. This change should keep that contract. Foreign keys may be added only where the referenced record's lifecycle is stable and the owning module agrees on delete behavior.

Alternative considered: add a full Prisma relation graph now. Rejected because cross-module delete semantics are not mature enough, and broad foreign-key graphs can block parallel feature development.

### 3. Avoid broad cascade deletes in foundation migrations

The foundation should not use `ON DELETE CASCADE` across module ownership boundaries. Preferred strategies are explicit soft-delete states, worker cleanup, or `RESTRICT`/manual cleanup decisions in module-specific changes.

Alternative considered: cascade everything from `Workspace`. Rejected because deleting a workspace may require business workflows, audit retention, payment history preservation, or async cleanup.

### 4. Keep strings for timestamps and statuses in this change

The current schema and repository mappers use ISO timestamp strings and status strings. This change should not convert them to `DateTime` or Prisma enums. Instead, contract tests should verify that status fields are intentional and that module logic validates statuses against shared contracts or module-owned status sets.

Alternative considered: migrate to `DateTime` and enums immediately. Rejected because that is a broader mapper/domain migration and should be proposed separately after module owners agree.

### 5. Make migration safety visible

This change should generate an additive migration and test that it does not drop existing tables, columns, or introduce unsafe cascades. For local manual testing, the expected rollback path remains backup/restore, not hand-written down migrations.

Alternative considered: add down migrations for every Prisma change. Rejected because Prisma Migrate in this project is already using forward migrations and local rollback is safer through database backup/restore.

## Risks / Trade-offs

- Adding constraints can fail on dirty local databases -> Mitigate by documenting that local duplicate sample/manual rows must be cleaned before applying the migration.
- Unique constraints may be stricter than a future module needs -> Keep constraints to obvious invariants and defer uncertain cases to owning modules.
- Keeping string timestamps/statuses delays stronger database typing -> Make this an explicit design decision and leave enum/DateTime conversion to a later dedicated change.
- Avoiding foreign keys reduces database-enforced referential integrity -> Compensate with scalar-reference contract tests and module-level validation until lifecycle ownership is mature.
- Migration rollback remains operational rather than automatic -> Require backup/restore notes for manual database testing.

## Migration Plan

1. Inspect current schema constraints and identify missing shared uniqueness guarantees.
2. Add targeted `@@unique` constraints and any supporting indexes without removing existing fields.
3. Add or adjust migration SQL so changes are additive and do not introduce broad cascade deletes.
4. Extend schema contract tests to verify uniqueness constraints, cascade policy, timestamp/status conventions, and preservation of existing persisted fields.
5. Run Prisma validation, contract tests, `npm test`, OpenSpec validation, and `git diff --check`.

Rollback strategy: restore a database backup if local migration testing fails. If already merged and deployed to a shared environment, revert through a new forward migration rather than editing an existing migration.

## Open Questions

- Should `Agent(workspaceId, name)` be case-insensitive at the database level later, or remain enforced by repository logic for now?
- Should `Invitation` uniqueness include all statuses, or only active/pending statuses once module-specific invitation states are finalized?
- Should a later change introduce Prisma enums and `DateTime` fields once module persistence stabilizes?
