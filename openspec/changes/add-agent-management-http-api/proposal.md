## Why

Agent Management now has lifecycle use cases and a browser app shell, but the UI still cannot call a backend API. This change adds the first HTTP boundary for Agent Management so later UI integration can use real API contracts instead of mock data.

## What Changes

- Add Express-compatible HTTP routes for Agent Management lifecycle operations.
- Expose endpoints for listing, creating, updating, enabling, disabling, and deleting agents within a workspace.
- Use a mock request context boundary for workspace/current-user data until real RBAC integration is implemented.
- Map lifecycle validation and not-found errors into the shared `ApiResponse` shape.
- Add API-level tests for successful and failing Agent Management requests.
- Keep Prisma persistence, real RBAC, frontend API client integration, and OpenClaw runtime writes out of scope.

## Capabilities

### New Capabilities

- `agent-management-http-api`: HTTP API routes and response behavior for Agent Management lifecycle operations.

### Modified Capabilities

- None.

## Impact

- Backend Agent Management module HTTP routing/handler files.
- Shared API response usage via `shared/contracts/api.ts`.
- Package scripts or dependencies if a minimal HTTP server/router dependency is needed.
- Tests covering Agent Management API route behavior, response envelopes, and error mapping.
