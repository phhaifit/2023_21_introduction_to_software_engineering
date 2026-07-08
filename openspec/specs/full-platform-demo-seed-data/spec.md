## Purpose

Define local full-platform demo seed behavior for PostgreSQL-backed manual testing across authenticated project modules.

## Requirements

### Requirement: Full Platform Demo Seed Command
The system SHALL provide an explicit root-level command for seeding a migrated local PostgreSQL database with full-platform demo data.

#### Scenario: Seed command exists
- **WHEN** a developer inspects root npm scripts
- **THEN** a documented command exists for running the full-platform demo seed

#### Scenario: Seed command succeeds after migrations
- **WHEN** Docker PostgreSQL is running and Prisma migrations have been applied
- **THEN** the full-platform demo seed command completes without requiring destructive database reset

#### Scenario: Seed command is idempotent
- **WHEN** the full-platform demo seed command is run more than once
- **THEN** it updates or preserves deterministic demo records without creating duplicate users, memberships, workspaces, agents, subscriptions, workflows, tasks, tools, knowledge records, conversations, or payment records

### Requirement: Demo Authentication and Workspace Data
The full-platform demo seed SHALL create stable authenticated users and workspace access records suitable for manual project testing.

#### Scenario: Demo users are seeded
- **WHEN** the seed completes
- **THEN** the database contains stable active demo users for manager, editor, and viewer-style access checks

#### Scenario: Demo workspace records are seeded
- **WHEN** the seed completes
- **THEN** the database contains deterministic demo workspaces used by the current frontend demo routes and workspace selectors

#### Scenario: Demo workspace membership is seeded
- **WHEN** the seed completes
- **THEN** the demo users have deterministic active workspace memberships and roles for the seeded workspaces

### Requirement: Demo Agent Management Data
The full-platform demo seed SHALL create Agent Management records that support authenticated list, create, configuration, lifecycle, assistant, and downstream selection flows.

#### Scenario: Demo agents are seeded
- **WHEN** the seed completes
- **THEN** the demo workspace contains deterministic enabled and disabled agents with valid names, roles, models, instructions, status, and timestamps

#### Scenario: Demo agent support records are seeded
- **WHEN** the seed completes
- **THEN** related tool assignment and knowledge grant records exist where needed so agent-adjacent screens can render without missing database dependencies

### Requirement: Demo Neighboring Module Data
The full-platform demo seed SHALL create baseline records for neighboring modules that commonly block manual project testing when the database is empty.

#### Scenario: Subscription and payment data are seeded
- **WHEN** the seed completes
- **THEN** the demo workspace has active subscription data, representative transaction history, payment method data, and promo code data suitable for local billing UI checks

#### Scenario: Workflow and task data are seeded
- **WHEN** the seed completes
- **THEN** the database contains deterministic workflows, workflow steps, workflow executions, workflow logs, tasks, task runs, conversations, and chat messages linked to the demo workspace

#### Scenario: Tools data are seeded
- **WHEN** the seed completes
- **THEN** the database contains deterministic tools, tool connections, and agent-tool assignment records for the demo workspace

#### Scenario: Knowledge Base data are seeded
- **WHEN** the seed completes
- **THEN** the database contains deterministic knowledge data sources, documents, chunks, indexes, ingestion jobs, sync scope nodes, sync jobs, sync events, runtime jobs, and active agent document grants for the demo workspace

### Requirement: Demo Seed Boundary
The full-platform demo seed SHALL remain a local/demo fixture and SHALL NOT redefine production module ownership.

#### Scenario: Existing schema is sufficient
- **WHEN** the seed is implemented
- **THEN** it uses existing Prisma models without requiring a new schema migration unless implementation discovers a blocking mismatch

#### Scenario: Incomplete features are not marked complete
- **WHEN** the seed creates data for a partially implemented or provisional module
- **THEN** the module's OpenSpec task status and production readiness remain unchanged

#### Scenario: Production behavior remains separate
- **WHEN** a non-demo user registers or logs in
- **THEN** the seed does not automatically grant that user access to seeded demo workspaces

### Requirement: Optional Local Server Seed Bootstrap
The local API SHALL NOT mutate the PostgreSQL database with demo seed data during normal startup unless a developer explicitly opts in.

#### Scenario: Normal startup does not auto-seed
- **WHEN** the local API starts without the demo seed opt-in setting
- **THEN** it does not run the full-platform demo seed implicitly

#### Scenario: Opt-in startup uses same seed
- **WHEN** the local API starts with the demo seed opt-in setting enabled
- **THEN** it invokes the same idempotent seed logic used by the explicit seed command

### Requirement: Documented PostgreSQL Demo Flow
The project SHALL document the local Docker PostgreSQL flow needed to run the full-platform authenticated demo.

#### Scenario: Developer follows documented flow
- **WHEN** a developer starts Docker PostgreSQL, applies migrations, runs the full-platform seed, and starts the app
- **THEN** the developer can log in with documented demo credentials and manually test Agent Management plus neighboring project pages against PostgreSQL-backed data
