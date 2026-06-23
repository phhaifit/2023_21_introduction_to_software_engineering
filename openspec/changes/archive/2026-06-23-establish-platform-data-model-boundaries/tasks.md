## 1. Schema Baseline Review

- [x] 1.1 Inspect the current Prisma schema and confirm existing `Agent`, `Subscription`, and `Transaction` key fields remain supported.
- [x] 1.2 Map each required skeleton model to its owning module using the ownership table in `design.md`.
- [x] 1.3 Confirm which fields are foundation-level and defer module-specific business fields to owning feature changes.

## 2. Prisma Skeleton Implementation

- [x] 2.1 Add or update Prisma models for `User`, `Workspace`, `WorkspaceMember`, `Invitation`, `Subscription`, `Transaction`, `Agent`, `Tool`, `ToolConnection`, `AgentToolAssignment`, `Workflow`, `WorkflowStep`, `Task`, `TaskRun`, `Document`, `KnowledgeIndex`, `KnowledgeAccessGrant`, and `Job`.
- [x] 2.2 Use string primary keys aligned with shared `EntityId` kinds.
- [x] 2.3 Add `workspaceId` to workspace-scoped models and scalar cross-module reference fields for parent entities.
- [x] 2.4 Add lifecycle `status` fields only where the model needs shared filtering or worker coordination.
- [x] 2.5 Add indexes for `workspaceId`, `userId`, `status`, and parent identifiers such as `workflowId`, `taskId`, `documentId`, `agentId`, and `subscriptionId`.
- [x] 2.6 Avoid broad cascading deletes across module ownership boundaries unless explicitly justified in `design.md`.

## 3. Migration And Database Package Exports

- [x] 3.1 Generate an additive Prisma migration for the skeleton tables and indexes.
- [x] 3.2 Update `packages/database/src/index.ts` to export generated model types needed by feature modules.
- [x] 3.3 Run Prisma validation with a dummy PostgreSQL `DATABASE_URL`.

## 4. Contract Tests

- [x] 4.1 Add a schema contract test that verifies all required model names exist.
- [x] 4.2 Verify required key fields, workspace fields, scalar parent references, and indexes for the skeleton models.
- [x] 4.3 Verify existing `Agent`, `Subscription`, and `Transaction` model exports remain available.
- [x] 4.4 Ensure schema-only contract coverage does not require a live database connection.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `openspec validate "establish-platform-data-model-boundaries" --strict`.
- [x] 5.3 Run `git diff --check`.
- [x] 5.4 Run `openspec validate --all --strict` before handoff or PR.
