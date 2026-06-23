## ADDED Requirements

### Requirement: Shared Uniqueness Constraints
The database schema SHALL define targeted unique constraints for cross-module records where duplicate rows are clearly invalid.

#### Scenario: Workspace member uniqueness enforced
- **WHEN** the Prisma schema is inspected
- **THEN** `WorkspaceMember` has a uniqueness guarantee for `workspaceId` and `userId`

#### Scenario: Agent workspace name uniqueness enforced
- **WHEN** the Prisma schema is inspected
- **THEN** `Agent` has a uniqueness guarantee that prevents duplicate agent names within the same workspace

#### Scenario: Tool assignment uniqueness enforced
- **WHEN** the Prisma schema is inspected
- **THEN** `AgentToolAssignment` has a uniqueness guarantee that prevents assigning the same tool to the same agent more than once in a workspace

#### Scenario: Workflow step ordering uniqueness enforced
- **WHEN** the Prisma schema is inspected
- **THEN** `WorkflowStep` has a uniqueness guarantee that prevents duplicate `stepOrder` values inside one workflow

#### Scenario: Knowledge grant uniqueness enforced
- **WHEN** the Prisma schema is inspected
- **THEN** `KnowledgeAccessGrant` has a uniqueness guarantee that prevents duplicate document access grants for the same agent inside one workspace

### Requirement: Relation and Cascade Policy
The database foundation SHALL preserve scalar ID references as the cross-module contract and SHALL avoid broad cascading deletes across module ownership boundaries.

#### Scenario: Scalar references remain available
- **WHEN** a model references another module's entity
- **THEN** the scalar ID field such as `workspaceId`, `userId`, `agentId`, `workflowId`, `taskId`, `documentId`, `subscriptionId`, or `jobId` remains available for module contracts

#### Scenario: Unsafe cascade is rejected
- **WHEN** a platform database migration is inspected
- **THEN** it does not include `ON DELETE CASCADE` across module-owned tables unless the design explicitly documents the lifecycle ownership and cleanup behavior

#### Scenario: Delete behavior is explicit
- **WHEN** a module needs to delete, archive, or clean up shared database records
- **THEN** the module defines the lifecycle behavior in its own OpenSpec change instead of relying on implicit foundation cascades

### Requirement: Status and Timestamp Integrity
The database foundation SHALL keep status and timestamp conventions explicit until a dedicated type migration is proposed.

#### Scenario: Timestamp convention remains stable
- **WHEN** the foundation schema is hardened
- **THEN** existing `createdAt`, `updatedAt`, `startedAt`, `completedAt`, and `expiresAt` fields remain compatible with the current string timestamp mappers

#### Scenario: Status fields remain intentional
- **WHEN** a model contains a `status` field
- **THEN** the field has a documented default or is validated by the owning module's domain logic

#### Scenario: Enum conversion deferred
- **WHEN** a developer wants Prisma enums or `DateTime` fields
- **THEN** that conversion is proposed as a separate OpenSpec change with mapper, migration, and compatibility notes

### Requirement: Migration Safety Checks
The platform data model foundation SHALL include automated checks that protect existing persisted fields and detect unsafe migration behavior.

#### Scenario: Existing persisted fields are preserved
- **WHEN** schema contract tests run
- **THEN** required `Agent`, `Subscription`, and `Transaction` fields from existing persistence code are still present

#### Scenario: Unique constraints are verified
- **WHEN** schema contract tests run
- **THEN** required shared unique constraints are verified in the Prisma schema

#### Scenario: Migration avoids destructive operations
- **WHEN** migration SQL for this hardening change is inspected by tests
- **THEN** it does not drop existing tables or columns

#### Scenario: Manual rollback path is documented
- **WHEN** a developer manually applies the hardening migration to a local database
- **THEN** the expected rollback path is backup and restore rather than editing an already-created migration
