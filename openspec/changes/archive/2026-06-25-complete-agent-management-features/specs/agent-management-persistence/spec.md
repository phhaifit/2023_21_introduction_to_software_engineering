## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Count Query
The system SHALL support counting agents matching query filters without fetching full records.

#### Scenario: Count by workspace with filters
- **WHEN** the repository receives a count query with workspace ID and optional search/status filters
- **THEN** the repository returns the total number of matching agents as an integer
