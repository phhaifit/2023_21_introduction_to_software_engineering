## Purpose

Define workspace-scoped HTTP contracts for Agent Management lifecycle operations and shared response behavior.
## Requirements
### Requirement: Agent Management Route Registration
The system SHALL provide workspace-scoped HTTP routes for Agent Management lifecycle operations.

#### Scenario: Routes are mounted
- **WHEN** the backend Agent Management API router is registered
- **THEN** clients can call routes under `/api/workspaces/:workspaceId/agents`

### Requirement: Agent Management API Response Envelope
The system SHALL return Agent Management HTTP responses using the shared `ApiResponse` contract.

#### Scenario: Successful response returned
- **WHEN** an Agent Management API request succeeds
- **THEN** the response body includes `ok: true`, `data`, and `meta` with request metadata

#### Scenario: Failure response returned
- **WHEN** an Agent Management API request fails with a known lifecycle error
- **THEN** the response body includes `ok: false`, `error`, and `meta` with request metadata

### Requirement: Agent Listing Endpoint
The system SHALL expose an HTTP endpoint for listing workspace agents with query support.

#### Scenario: Paginated list with query parameters
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents` with optional query parameters `search`, `status`, `sortBy`, `sortOrder`, `page`, `pageSize`
- **THEN** the system returns a paginated response in `ApiPaginatedSuccess` envelope with matching agents and pagination metadata

#### Scenario: Default query behavior
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents` without query parameters
- **THEN** the system returns page 1 with pageSize 20, status filter `["enabled", "disabled"]`, sorted by `createdAt` ascending, preserving backward compatibility

### Requirement: Agent Creation Endpoint
The system SHALL expose an endpoint for creating agents in a workspace.

#### Scenario: Agent created through API
- **WHEN** a client sends `POST /api/workspaces/:workspaceId/agents` with valid name, role, model, and instructions
- **THEN** the response creates the agent in that workspace and returns its public summary

#### Scenario: Invalid create payload rejected
- **WHEN** a client sends missing or invalid create payload fields
- **THEN** the response uses `validation.invalid_input` and includes validation details

### Requirement: Agent Update Endpoint
The system SHALL expose an endpoint for updating agent configuration.

#### Scenario: Agent updated through API
- **WHEN** a client sends `PATCH /api/workspaces/:workspaceId/agents/:agentId` with valid role, model, and instructions
- **THEN** the response persists the updated configuration and returns the agent public summary

#### Scenario: Missing agent update rejected
- **WHEN** a client updates an agent that does not exist in the workspace
- **THEN** the response uses `agent.not_available`

### Requirement: Agent Activation Endpoints
The system SHALL expose endpoints for enabling and disabling agents.

#### Scenario: Agent disabled through API
- **WHEN** a client sends `POST /api/workspaces/:workspaceId/agents/:agentId/disable`
- **THEN** the response marks the agent disabled and returns the agent public summary

#### Scenario: Agent enabled through API
- **WHEN** a client sends `POST /api/workspaces/:workspaceId/agents/:agentId/enable`
- **THEN** the response marks the agent enabled and returns the agent public summary

### Requirement: Agent Deletion Endpoint
The system SHALL expose an endpoint for deleting agents.

#### Scenario: Agent deleted through API
- **WHEN** a client sends `DELETE /api/workspaces/:workspaceId/agents/:agentId`
- **THEN** the response marks the agent deleted and returns the agent public summary

### Requirement: Workspace Scoped API Access
The system SHALL scope every Agent Management API operation to the workspace in the request, and strictly enforce authentication and authorization.

#### Scenario: Cross-workspace agent not found
- **WHEN** a client requests or mutates an agent id that belongs to another workspace
- **THEN** the response does not expose that agent and uses `agent.not_available`

#### Scenario: Unauthenticated request rejected
- **WHEN** a client makes an API request without a valid authentication token
- **THEN** the response is rejected with a `401 Unauthorized` HTTP status

#### Scenario: Unauthorized mutation rejected
- **WHEN** a client without the `agents:manage` permission (e.g., Viewer) attempts to create, update, enable, disable, or delete an agent
- **THEN** the response is rejected with a `403 Forbidden` HTTP status

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

### Requirement: Agent Model Catalog Endpoint
The system SHALL expose a workspace-scoped endpoint for reading selectable agent execution models.

#### Scenario: Model catalog endpoint
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents/models`
- **THEN** the response returns selectable model catalog entries in the shared API response envelope

#### Scenario: Model catalog unauthorized
- **WHEN** an unauthenticated client requests the model catalog
- **THEN** the response is rejected with a shared unauthorized error

### Requirement: Skill Preview Endpoint
The system SHALL expose a workspace-scoped endpoint for previewing generated `skill.md` content from a draft payload.

#### Scenario: Skill preview endpoint
- **WHEN** a client sends a valid draft payload to `POST /api/workspaces/:workspaceId/agents/skill-preview`
- **THEN** the response returns generated Markdown content without creating or updating an agent

#### Scenario: Invalid preview rejected
- **WHEN** a client sends missing or invalid draft fields to the preview endpoint
- **THEN** the response uses `validation.invalid_input` and does not persist data

### Requirement: Skill Download Endpoint
The system SHALL expose a workspace-scoped endpoint for downloading an existing agent's `skill.md`.

#### Scenario: Skill download endpoint
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents/:agentId/skill.md` for an active or disabled agent in the workspace
- **THEN** the response returns a Markdown file generated from the current agent configuration

#### Scenario: Skill download not found
- **WHEN** a client requests a deleted, missing, or cross-workspace agent skill artifact
- **THEN** the response uses an Agent Management not-available error and exposes no private configuration

### Requirement: Assistant Draft Endpoint
The system SHALL expose a workspace-scoped endpoint for generating an editable agent draft from a natural-language description.

#### Scenario: Prompt assistant endpoint
- **WHEN** a manager sends a valid prompt to `POST /api/workspaces/:workspaceId/agents/assistant/draft`
- **THEN** the response returns an editable draft, clarifying questions when needed, validation warnings, and provider metadata

#### Scenario: Assistant provider failure
- **WHEN** all configured LLM providers fail for the draft endpoint
- **THEN** the response returns a retryable Agent Management error and does not create an agent

### Requirement: Skill Import Analysis Endpoint
The system SHALL expose a workspace-scoped endpoint for analyzing free-form Markdown `skill.md` imports.

#### Scenario: Skill import analysis endpoint
- **WHEN** a manager sends Markdown content to `POST /api/workspaces/:workspaceId/agents/assistant/import-skill`
- **THEN** the response returns an editable draft extracted from the Markdown, warning metadata, and provider metadata without creating an agent

#### Scenario: Empty skill import rejected
- **WHEN** a manager sends empty Markdown content to the import endpoint
- **THEN** the response uses `validation.invalid_input`

### Requirement: Assistant Endpoint Authorization
The system SHALL require `agents:manage` permission for assistant draft generation, skill import analysis, and skill preview mutation-like actions.

#### Scenario: Viewer cannot generate assistant draft
- **WHEN** a viewer requests assistant draft generation or skill import analysis
- **THEN** the response is rejected with a shared forbidden error

### Requirement: Agent Management Protected Route Integration
The Agent Management HTTP API SHALL distinguish missing authentication, missing workspace membership, and authorized workspace access.

#### Scenario: Missing authentication is rejected
- **WHEN** a client calls an Agent Management workspace route without a valid authentication token
- **THEN** the response uses HTTP `401` with `auth.unauthorized`

#### Scenario: Authenticated non-member is rejected
- **WHEN** a client calls an Agent Management workspace route with a valid authentication token for a user who is not an active member of the route workspace
- **THEN** the response uses HTTP `403` with `auth.forbidden`

#### Scenario: Authenticated active member can list agents
- **WHEN** a client calls `GET /api/workspaces/:workspaceId/agents` with a valid authentication token for an active member of that workspace
- **THEN** the response returns the workspace-scoped paginated agent list

#### Scenario: Authenticated manager can mutate agents
- **WHEN** a client calls an Agent Management mutation route with a valid authentication token for a workspace member who has `agents:manage`
- **THEN** the mutation is evaluated by the Agent Management use case and returns the shared API success or domain failure response

### Requirement: Local Fake Auth Remains Explicit
The local API SHALL keep fake auth separate from the normal browser authentication path.

#### Scenario: Fake auth requires explicit header
- **WHEN** a local test or tool sends `x-mock-user`
- **THEN** the local API may synthesize request context for that explicit test or tool request

#### Scenario: Browser requests exercise real auth
- **WHEN** a browser request does not send `x-mock-user`
- **THEN** the local API relies on the normal authentication token flow instead of silently creating a fake user
