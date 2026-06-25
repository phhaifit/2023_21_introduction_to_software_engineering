## ADDED Requirements

### Requirement: Paginated Agent Listing
The system SHALL support offset-based pagination for the agent list endpoint.

#### Scenario: Default pagination
- **WHEN** a client requests the agent list without pagination parameters
- **THEN** the system returns the first page with a default page size of 20 and includes pagination metadata (`page`, `pageSize`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`)

#### Scenario: Custom page and page size
- **WHEN** a client requests page 2 with pageSize 10
- **THEN** the system returns agents 11-20 (offset 10, limit 10) with accurate pagination metadata

#### Scenario: Page beyond total
- **WHEN** a client requests a page number that exceeds the total number of pages
- **THEN** the system returns an empty data array with pagination metadata showing the correct `totalItems` and `totalPages`

### Requirement: Text Search
The system SHALL support case-insensitive substring search across agent name and role fields.

#### Scenario: Search by name
- **WHEN** a client provides a `search` query parameter with value `"research"`
- **THEN** the system returns only agents whose name or role contains `"research"` (case-insensitive)

#### Scenario: Empty search result
- **WHEN** a client provides a `search` query parameter that matches no agents
- **THEN** the system returns an empty data array with `totalItems: 0`

### Requirement: Status Filtering
The system SHALL support filtering agents by one or more statuses via query parameter.

#### Scenario: Filter by single status
- **WHEN** a client provides `status=enabled`
- **THEN** the system returns only agents with status `enabled`

#### Scenario: Filter by multiple statuses
- **WHEN** a client provides `status=enabled,disabled`
- **THEN** the system returns agents with status `enabled` or `disabled`

#### Scenario: Default status filter
- **WHEN** a client omits the `status` query parameter
- **THEN** the system defaults to filtering by `enabled` and `disabled` (excluding `deleted`), preserving backward compatibility

### Requirement: Configurable Sort
The system SHALL support configurable sort order for the agent list.

#### Scenario: Sort by name ascending
- **WHEN** a client provides `sortBy=name&sortOrder=asc`
- **THEN** the system returns agents sorted alphabetically by name in ascending order

#### Scenario: Sort by updatedAt descending
- **WHEN** a client provides `sortBy=updatedAt&sortOrder=desc`
- **THEN** the system returns agents sorted by last update time with most recent first

#### Scenario: Default sort
- **WHEN** a client omits sort parameters
- **THEN** the system defaults to `sortBy=createdAt&sortOrder=asc`, preserving backward compatibility

#### Scenario: Invalid sort field rejected
- **WHEN** a client provides a `sortBy` value that is not one of `name`, `createdAt`, `updatedAt`, `status`
- **THEN** the system rejects the request with a validation error

### Requirement: Paginated Response Envelope
The system SHALL return the agent list in the `ApiPaginatedSuccess` envelope defined in shared contracts.

#### Scenario: Response shape
- **WHEN** the agent list endpoint returns results
- **THEN** the response body conforms to `{ data: AgentListItem[], meta: { pagination: ApiPaginationMeta } }`
