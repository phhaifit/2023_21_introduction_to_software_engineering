## 1. Baseline Integrity Audit

- [x] 1.1 Inspect the current Prisma schema for existing indexes, unique constraints, status fields, timestamp fields, and scalar references.
- [x] 1.2 Identify local data cleanup risks before adding constraints, especially duplicate sample/manual rows in `virtual_company_dev`.
- [x] 1.3 Confirm existing Agent Management and Subscription Payment persisted fields remain in scope and must not be removed.

## 2. Schema Hardening

- [x] 2.1 Add targeted unique constraints for `WorkspaceMember(workspaceId, userId)`, `Agent(workspaceId, name)`, `ToolConnection(workspaceId, toolId)`, `AgentToolAssignment(workspaceId, agentId, toolId)`, `WorkflowStep(workflowId, stepOrder)`, and `KnowledgeAccessGrant(workspaceId, documentId, agentId)`.
- [x] 2.2 Add an invitation uniqueness rule that prevents duplicate invitations within the same workspace, email, and status.
- [x] 2.3 Add a task-run uniqueness rule for `jobId` when a task run is tied to a worker job, or document why the schema cannot enforce that safely yet.
- [x] 2.4 Preserve scalar reference fields used as module contracts.
- [x] 2.5 Avoid broad `ON DELETE CASCADE` behavior across module-owned tables.
- [x] 2.6 Keep existing string timestamp and status conventions unless a separate type migration is proposed.

## 3. Migration And Local Safety

- [x] 3.1 Generate an additive Prisma migration for the hardening constraints.
- [x] 3.2 Ensure the migration does not drop existing tables or columns.
- [x] 3.3 Document the local manual-test rollback path as backup and restore before applying the migration.
- [x] 3.4 Run Prisma validation with a dummy PostgreSQL `DATABASE_URL`.

## 4. Contract Tests

- [x] 4.1 Extend the platform data model contract test to verify required unique constraints.
- [x] 4.2 Verify migration SQL does not include destructive drops or unsafe cascade deletes.
- [x] 4.3 Verify status and timestamp fields remain compatible with current string-based mappers.
- [x] 4.4 Verify existing `Agent`, `Subscription`, and `Transaction` fields remain available.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `openspec validate "harden-platform-data-integrity" --strict`.
- [x] 5.3 Run `git diff --check`.
- [x] 5.4 Run `openspec validate --all --strict` before handoff or PR.
