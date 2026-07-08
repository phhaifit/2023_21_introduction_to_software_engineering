## ADDED Requirements

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
