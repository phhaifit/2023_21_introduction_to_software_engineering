## Why

Currently, Agent Management uses a mock `RequestContext` and hardcoded workspace IDs. To be production-ready and secure, the module must integrate with the real Workspace and Authentication boundaries to ensure cross-workspace data isolation and enforce Role-Based Access Control (RBAC).

## What Changes

- Implement real `RequestContext` usage across all Agent Management API routes.
- Enforce the `agents:manage` permission for create, update, enable, disable, and delete operations.
- Allow users with Admin/Editor roles to mutate agents, while blocking Viewers and Anonymous users.
- Ensure all queries and mutations are strictly scoped to the user's current `workspaceId`.
- **BREAKING**: API routes will now reject requests with `401 Unauthorized` if unauthenticated, and `403 Forbidden` if the user lacks the required workspace permissions.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `agent-management-http-api`: API routes must enforce authentication and `agents:manage` permission, returning 401 or 403 where applicable.
- `agent-management`: Enforce strict workspace isolation so agents do not leak across workspace boundaries.

## Impact

- **Agent Management API Router**: Will use real authentication middlewares and context extractors instead of mock context.
- **Agent Lifecycle Use Cases**: Will rely on the provided context for `workspaceId` rather than trusting client inputs.
- **Frontend / API Client**: May need to handle 401/403 errors gracefully (already supported by standard UI error handling, but will be activated in practice).
