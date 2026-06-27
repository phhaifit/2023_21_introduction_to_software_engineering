## Why

The platform exists to create and manage virtual company workspaces backed by OpenClaw runtime instances. This change implements workspace listing, creation, detail loading, and deletion with async provisioning lifecycle coordination.

## What Changes

- Add workspace list, create, detail, and delete routes with async `202 Accepted` responses.
- Resolve subscription entitlement before provisioning; backend never trusts frontend-supplied resource limits.
- Coordinate provisioning/deprovisioning through a durable operation record and outbox worker.
- Add idempotency via `WorkspaceCommandReceipt` with mandatory `Idempotency-Key` header for create and delete.
- Add `WorkspaceVisibilityProjection` for list queries; authoritative access always uses `WorkspaceAccessQueryPort`.
- Add bounded bootstrap creator access while owner membership is pending.
- Publish Workspace domain events through outbox. Consumers dedupe via `ProcessedDomainEvent` inbox policy.

## Capabilities

### New Capabilities

- `workspace-management`: Workspace lifecycle, provisioning coordination, idempotency, visibility projection, and event publishing.

### Modified Capabilities

- `shared-contracts`: Workspace public DTOs, lifecycle statuses, error codes, cursor pagination envelope, versioned event payloads, and idempotency contract.
- `platform-data-model-boundaries`: Workspace schema, `WorkspaceProvisioningOperation`, outbox, `WorkspaceCommandReceipt`, `WorkspaceVisibilityProjection`, `ProcessedDomainEvent`.
- `api-route-boundaries`: Four milestone 1 Workspace routes with `Idempotency-Key` requirement on POST and DELETE.

## Impact

- Backend module: `apps/backend/src/modules/workspace-management`
- Frontend feature: `apps/frontend/src/features/workspace-management`
- Shared contracts: Workspace DTOs, statuses, event envelopes, error codes
- Related modules consume workspace context but do not import workspace internals
