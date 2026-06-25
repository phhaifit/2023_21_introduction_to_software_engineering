## MODIFIED Requirements

### Requirement: Agent Listing Endpoint
The system SHALL expose an HTTP endpoint for listing workspace agents with query support.

#### Scenario: Paginated list with query parameters
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents` with optional query parameters `search`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize`
- **THEN** the system returns a paginated response in `ApiPaginatedSuccess` envelope with matching agents and pagination metadata

#### Scenario: Default query behavior
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents` without query parameters
- **THEN** the system returns page 1 with pageSize 20, status filter `["enabled", "disabled"]`, sorted by `createdAt` ascending, preserving backward compatibility

## ADDED Requirements

### Requirement: Agent Rename Endpoint
The system SHALL expose an HTTP endpoint for renaming an agent.

#### Scenario: Rename agent
- **WHEN** a client sends `PATCH /api/workspaces/:workspaceId/agents/:agentId/name` with body `{ "name": "<new-name>" }` and `agents:manage` permission
- **THEN** the system renames the agent and returns the updated `AgentPublicSummary`

#### Scenario: Rename validation failure
- **WHEN** a client sends a rename request with an empty name or a name already used by another agent
- **THEN** the system returns a 422 validation error

### Requirement: Agent Duplicate Endpoint
The system SHALL expose an HTTP endpoint for duplicating an agent.

#### Scenario: Duplicate agent
- **WHEN** a client sends `POST /api/workspaces/:workspaceId/agents/:agentId/duplicate` with `agents:manage` permission
- **THEN** the system creates a cloned agent with a unique auto-generated name and returns the new agent's `AgentPublicSummary`

#### Scenario: Duplicate not-found agent
- **WHEN** a client sends a duplicate request for a non-existent agent
- **THEN** the system returns a 404 not-found error
