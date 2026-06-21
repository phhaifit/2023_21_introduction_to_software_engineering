## Why

The platform exists to create and manage virtual company workspaces backed by OpenClaw runtime instances. This change defines workspace listing, creation, detail loading, and deletion.

## What Changes

- Add workspace list with status and timestamps.
- Add workspace creation with name and selected runtime configuration.
- Trigger OpenClaw provisioning through the runtime adapter and worker boundary.
- Add workspace detail view that aggregates configuration, agents, workflows, and tools.
- Add workspace deletion that removes metadata and requests OpenClaw runtime cleanup.

## Capabilities

### New Capabilities
- `workspace-management`: Workspace lifecycle, OpenClaw provisioning requests, workspace details, and runtime cleanup coordination.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/workspace-management`
- Frontend feature: `apps/frontend/src/features/workspace-management`
- Worker job: `apps/workers/src/jobs/openclaw-provisioning`
- Shared infrastructure: OpenClaw runtime adapter, events, database, logging
- Related modules consume workspace context but do not import workspace internals
