## ADDED Requirements

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
The system SHALL expose an endpoint for listing active agents in a workspace.

#### Scenario: Agents listed
- **WHEN** a client sends `GET /api/workspaces/:workspaceId/agents`
- **THEN** the response contains enabled and disabled agents for that workspace

#### Scenario: Deleted agents omitted
- **WHEN** a workspace has deleted agents
- **THEN** the listing response does not include deleted agents

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

### Requirement: Mock Workspace Request Context
The system SHALL provide a mock request context boundary for Agent Management API tests and local use before real RBAC integration exists.

#### Scenario: Mock context supplies workspace
- **WHEN** an Agent Management API route receives a workspace-scoped request
- **THEN** the route resolves a request context with the route `workspaceId` and a mock current user

### Requirement: Workspace Scoped API Access
The system SHALL scope every Agent Management API operation to the workspace in the request.

#### Scenario: Cross-workspace agent not found
- **WHEN** a client requests or mutates an agent id that belongs to another workspace
- **THEN** the response does not expose that agent and uses `agent.not_available`
