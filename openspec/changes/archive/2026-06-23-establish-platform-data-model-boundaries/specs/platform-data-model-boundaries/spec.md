## ADDED Requirements

### Requirement: Platform Model Ownership
The platform data model foundation SHALL define an ownership boundary for every shared Prisma model included in the schema skeleton.

#### Scenario: Ownership boundaries are documented
- **WHEN** a developer reviews the change design before implementation
- **THEN** the design identifies the owning module for `User`, `Workspace`, `WorkspaceMember`, `Invitation`, `Subscription`, `Transaction`, `Agent`, `Tool`, `ToolConnection`, `AgentToolAssignment`, `Workflow`, `WorkflowStep`, `Task`, `TaskRun`, `Document`, `KnowledgeIndex`, `KnowledgeAccessGrant`, and `Job`

#### Scenario: Feature team adds module-specific fields
- **WHEN** a feature team needs fields beyond identity, ownership, status, timestamps, and cross-module references
- **THEN** those fields are added by the owning module's OpenSpec change instead of expanding the foundation without review

### Requirement: Minimum Prisma Schema Skeleton
The database package SHALL define the minimum shared Prisma models required for cross-module alignment.

#### Scenario: Required models exist
- **WHEN** the Prisma schema is inspected
- **THEN** it contains models named `User`, `Workspace`, `WorkspaceMember`, `Invitation`, `Subscription`, `Transaction`, `Agent`, `Tool`, `ToolConnection`, `AgentToolAssignment`, `Workflow`, `WorkflowStep`, `Task`, `TaskRun`, `Document`, `KnowledgeIndex`, `KnowledgeAccessGrant`, and `Job`

#### Scenario: Existing persisted models remain available
- **WHEN** existing Agent Management and Subscription Payment persistence code imports generated Prisma model types
- **THEN** `Agent`, `Subscription`, and `Transaction` remain exported from the database package

### Requirement: Shared Identity and Tenant Fields
The schema skeleton SHALL use string primary keys aligned with shared `EntityId` kinds and SHALL include `workspaceId` on workspace-scoped entities.

#### Scenario: Entity identifiers align with shared contracts
- **WHEN** a skeleton model is inspected
- **THEN** its primary identifier is a `String` field named with the matching shared ID kind such as `userId`, `workspaceId`, `memberId`, `agentId`, `toolId`, `workflowId`, `taskId`, `documentId`, `subscriptionId`, `transactionId`, or `jobId`

#### Scenario: Workspace-scoped entities include tenant boundary
- **WHEN** a workspace-scoped model is inspected
- **THEN** the model contains a `workspaceId` field

#### Scenario: Cross-module references are scalar fields
- **WHEN** a model references an entity owned by another module
- **THEN** the schema exposes the reference as a scalar ID field that can be used without importing private module implementation code

### Requirement: Shared Lookup Indexes
The schema skeleton SHALL include indexes for common workspace, user, status, and parent-child lookup paths.

#### Scenario: Workspace lookup index exists
- **WHEN** a model contains a `workspaceId` field
- **THEN** the schema includes an index that supports lookup by `workspaceId`

#### Scenario: User lookup index exists
- **WHEN** a model contains a `userId` field
- **THEN** the schema includes an index that supports lookup by `userId`

#### Scenario: Status lookup index exists
- **WHEN** a model contains a `status` field used for lifecycle filtering
- **THEN** the schema includes an index that supports lookup by `status` or by `workspaceId` plus `status`

#### Scenario: Parent lookup index exists
- **WHEN** a model is scoped by a parent identifier such as `workflowId`, `taskId`, `documentId`, `agentId`, or `subscriptionId`
- **THEN** the schema includes an index that supports the parent lookup

### Requirement: Additive Migration
The data model boundary change SHALL provide a generated Prisma migration for the skeleton schema.

#### Scenario: Migration exists
- **WHEN** the change is implemented
- **THEN** `packages/database/prisma/migrations/*/migration.sql` includes additive table and index changes for the skeleton models

#### Scenario: Deep cross-module cascade behavior is avoided
- **WHEN** the migration is inspected
- **THEN** it does not introduce broad cascading deletes across module ownership boundaries unless the design explicitly justifies the lifecycle behavior

### Requirement: Schema Verification
The data model boundary change SHALL include automated verification for the skeleton schema.

#### Scenario: Prisma schema validates
- **WHEN** Prisma validation is run with a dummy PostgreSQL `DATABASE_URL`
- **THEN** the schema validates successfully

#### Scenario: Schema contract test runs
- **WHEN** the contract test suite runs
- **THEN** it verifies the required model names and key fields for the platform data model skeleton

#### Scenario: Full project tests run
- **WHEN** the change is ready for review
- **THEN** the project test suite passes without requiring a live database for schema-only contract coverage
