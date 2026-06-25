# Capability: Agent Management Persistence

## Purpose
TBD: Provides durable storage for Agent entities using Prisma and PostgreSQL.
## Requirements
### Requirement: Agent Database Schema
The system SHALL define a Prisma model for the Agent entity that maps all domain attributes to a relational database table.

#### Scenario: Agent table created
- **WHEN** Prisma migrations are applied
- **THEN** a database table `agents` exists with columns for `agentId`, `workspaceId`, `name`, `role`, `model`, `instructions`, `status`, `createdAt`, and `updatedAt`

#### Scenario: Workspace index exists
- **WHEN** the database schema is inspected
- **THEN** an index on `workspaceId` is present for efficient scoped queries

### Requirement: Persistent Agent Save
The system SHALL persist an Agent to the database when the repository `save` method is called, using upsert semantics.

#### Scenario: New agent is saved
- **WHEN** `save` is called with an Agent whose `agentId` does not yet exist in the database
- **THEN** a new record is inserted with all domain attributes

#### Scenario: Existing agent is updated
- **WHEN** `save` is called with an Agent whose `agentId` already exists in the database
- **THEN** the existing record is updated with the new attribute values

#### Scenario: Saved agent is returned
- **WHEN** `save` completes
- **THEN** the returned Agent matches the input domain object

### Requirement: Persistent Agent Lookup
The system SHALL retrieve an Agent from the database scoped by both `workspaceId` and `agentId`.

#### Scenario: Agent found in workspace
- **WHEN** `findById` is called with a valid `workspaceId` and `agentId` that exist in the database
- **THEN** the repository returns the matching domain Agent object

#### Scenario: Agent not found in workspace
- **WHEN** `findById` is called with an `agentId` that does not exist, or belongs to a different workspace
- **THEN** the repository returns `null`

### Requirement: Persistent Agent Listing
The system SHALL support search, sort, and pagination in the agent repository.

#### Scenario: Search query
- **WHEN** the repository receives a list query with a `search` term
- **THEN** the repository filters agents whose `name` or `role` contains the search term (case-insensitive substring match)

#### Scenario: Configurable sort
- **WHEN** the repository receives a list query with `sortBy` and `sortOrder` parameters
- **THEN** the repository orders results by the specified field and direction

#### Scenario: Paginated results
- **WHEN** the repository receives a list query with `page` and `pageSize` parameters
- **THEN** the repository returns a result object containing the page of agents and total count for pagination metadata

#### Scenario: Default query behavior
- **WHEN** the repository receives a list query without search, sort, or pagination parameters
- **THEN** the repository defaults to status filter `["enabled", "disabled"]`, sort by `createdAt` ascending, page 1 with pageSize 20

### Requirement: Persistent Agent Name Uniqueness Check
The system SHALL check for the existence of an agent name within a workspace using case-insensitive, trimmed comparison.

#### Scenario: Exact name exists
- **WHEN** `existsByName` is called with a name that matches an existing agent in the workspace
- **THEN** the repository returns `true`

#### Scenario: Case-insensitive match
- **WHEN** `existsByName` is called with a name differing only in case from an existing agent
- **THEN** the repository returns `true`

#### Scenario: Name does not exist
- **WHEN** `existsByName` is called with a name not present in the workspace
- **THEN** the repository returns `false`

#### Scenario: Same name in different workspace
- **WHEN** `existsByName` is called for workspace A with a name that only exists in workspace B
- **THEN** the repository returns `false`

### Requirement: Data Durability Across Restarts
The system SHALL retain all agent data across server restarts.

#### Scenario: Server restart preserves data
- **WHEN** an agent is saved and the server process restarts
- **THEN** the agent is still retrievable from the repository after restart

### Requirement: Count Query
The system SHALL support counting agents matching query filters without fetching full records.

#### Scenario: Count by workspace with filters
- **WHEN** the repository receives a count query with workspace ID and optional search/status filters
- **THEN** the repository returns the total number of matching agents as an integer

