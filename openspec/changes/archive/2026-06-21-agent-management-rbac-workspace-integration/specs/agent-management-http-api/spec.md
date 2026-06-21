## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Mock Workspace Request Context
**Reason**: Replacing mock context with real Workspace and Authentication integration.
**Migration**: Use the actual `RequestContext` provided by the authentication middleware.
