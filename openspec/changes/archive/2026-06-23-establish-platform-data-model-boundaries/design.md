## Context

The current Prisma schema is intentionally small and only contains models from completed persistence work: `Agent`, `Subscription`, and `Transaction`. The active feature changes for authentication, workspace management, workspace user management, tools integration, workflow management, task orchestration, and knowledge base/RAG still need stable database boundaries before teams add detailed persistence logic.

This change defines the shared data model skeleton only. It does not complete the persistence layer for every feature module.

## Goals / Non-Goals

**Goals:**

- Establish the minimum Prisma models needed for cross-module alignment.
- Document which module owns each foundation model.
- Keep string primary keys aligned with shared `EntityId` kinds such as `userId`, `workspaceId`, `agentId`, and `jobId`.
- Require `workspaceId` on workspace-scoped models.
- Add common indexes for workspace, user, status, and parent-child lookup paths.
- Generate a migration and add schema contract tests that verify the minimum model names and key fields.

**Non-Goals:**

- Implement repositories, use cases, route handlers, frontend behavior, or seed data for every module.
- Add full business fields for each feature before the owning module change needs them.
- Define deep cascading delete behavior across module-owned data.
- Replace existing Agent Management or Subscription Payment domain logic.
- Introduce production database seed data or external service dependencies.

## Decisions

### 1. Use a shared skeleton instead of full module schemas

The foundation schema SHALL include only identity, ownership, status, timestamp, and cross-module reference fields needed for coordination. Module-specific fields stay in the owning feature changes.

Alternative considered: Define full schemas for every future feature now. Rejected because it would front-load uncertain business details and force teams to rewrite fields as feature designs evolve.

### 2. Assign model ownership explicitly

| Model | Owning module | Reason for foundation inclusion |
| --- | --- | --- |
| `User` | Authentication | Provides `userId` references for membership, invitations, subscriptions, and audit ownership. |
| `Workspace` | Workspace Management | Provides the primary tenant boundary. |
| `WorkspaceMember` | Workspace User Management | Connects users to workspaces and shared roles. |
| `Invitation` | Workspace User Management | Supports pending membership flows by email and workspace. |
| `Subscription` | Subscription & Payment | Tracks plan/status for a workspace or account boundary. |
| `Transaction` | Subscription & Payment | Tracks payment outcomes tied to subscriptions. |
| `Agent` | Agent Management | Existing persisted model; remains workspace-scoped. |
| `Tool` | Tools Integration | Provides catalog/tool identity for connections and assignments. |
| `ToolConnection` | Tools Integration | Stores workspace-specific tool connection metadata without raw secrets. |
| `AgentToolAssignment` | Tools Integration | Connects agents to allowed tools. |
| `Workflow` | Workflow Management | Stores workspace workflow identity and status. |
| `WorkflowStep` | Workflow Management | Stores ordered workflow-to-agent references. |
| `Task` | Task & Orchestration | Stores task identity, routing references, and lifecycle state. |
| `TaskRun` | Task & Orchestration | Stores execution attempts for task processing and worker handoff. |
| `Document` | Knowledge Base/RAG | Stores workspace document metadata and ingestion state. |
| `KnowledgeIndex` | Knowledge Base/RAG | Stores vector/index readiness state for documents or collections. |
| `KnowledgeAccessGrant` | Knowledge Base/RAG | Connects agents to allowed documents or indexes. |
| `Job` | Workers/async boundary | Provides a shared async handoff record for provisioning, payments, ingestion, and task execution. |

### 3. Prefer explicit scalar references over deep Prisma relations for the foundation

The skeleton SHOULD use scalar reference fields such as `workspaceId`, `userId`, `agentId`, `workflowId`, `taskId`, `documentId`, `subscriptionId`, and `jobId` as the stable cross-module contract. Prisma relations MAY be added where they do not create module coupling, but the foundation should not rely on cascading behavior across module ownership boundaries.

Alternative considered: Define full relation graphs with cascading deletes for every model. Rejected because it hides cross-module lifecycle decisions inside the ORM before owners have agreed on deletion and archive semantics.

### 4. Use `TaskRun` as the task execution skeleton

The foundation uses `TaskRun` rather than `TaskLog` as the required execution model because it captures cross-module worker attempts and lifecycle status. Detailed task logs remain module-specific and can be added by Task & Orchestration when needed.

Alternative considered: Add both `TaskRun` and `TaskLog`. Rejected because `TaskLog` content and retention rules are not required for cross-module references yet.

### 5. Keep timestamps and statuses consistent with existing conventions

The current Prisma models use string IDs, string statuses, and ISO timestamp strings. This change keeps that convention for the skeleton to avoid broad mapper churn. If later changes introduce Prisma `DateTime` or enums, they should do so deliberately with mapper updates and migration notes.

Alternative considered: Convert existing models to `DateTime` and Prisma enums now. Rejected because that would make this foundation change also a persistence refactor for completed modules.

## Risks / Trade-offs

- Model skeleton becomes too broad -> Keep only cross-module identity, ownership, status, and lookup fields in this change.
- Feature teams need fields not included here -> Add those fields in the owning module's OpenSpec change, not by expanding the foundation ad hoc.
- Existing `Agent`, `Subscription`, or `Transaction` schema behavior changes accidentally -> Contract tests must verify existing model names and key fields remain available.
- Cross-module delete semantics become ambiguous -> Avoid deep cascading behavior in this change and let owners define lifecycle/cleanup rules explicitly.
- Migration may be hard to roll back after feature branches depend on the skeleton -> Keep the migration additive and document rollback as reverting this change before dependent module migrations are applied.

## Migration Plan

1. Update `packages/database/prisma/schema.prisma` with additive skeleton models and indexes.
2. Generate a Prisma migration for the new models and indexes.
3. Update `packages/database/src/index.ts` exports so feature modules can import generated model types.
4. Add schema contract tests that inspect the Prisma schema for required model names and key fields.
5. Validate Prisma with a dummy PostgreSQL URL and run the project test suite.

Rollback strategy: revert the additive migration and schema changes before any downstream feature migration depends on these tables. If downstream migrations already exist, rollback must be coordinated by reverting those dependent changes first.

## Open Questions

- Should `Subscription.workspaceId` become required now, or remain nullable for account-level purchases until Subscription & Payment finalizes ownership?
- Should `Job` live only in Prisma or also gain a shared contract type in a later domain-event/job-catalog change?
