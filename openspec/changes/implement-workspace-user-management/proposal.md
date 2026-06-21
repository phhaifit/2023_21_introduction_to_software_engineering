## Why

Company workspaces need collaboration controls so admins can invite users and assign appropriate access levels. This change defines workspace membership and RBAC behavior.

## What Changes

- Add member invitation by email for workspace admins.
- Add workspace role assignment using `admin`, `editor`, and `viewer`.
- Add member list and access management.
- Add member removal.
- Enforce workspace-scoped authorization for protected module actions.

## Capabilities

### New Capabilities
- `workspace-user-management`: Workspace invitations, member list, role assignment, member removal, and workspace-scoped RBAC enforcement.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/workspace-user-management`
- Frontend feature: `apps/frontend/src/features/workspace-user-management`
- Shared infrastructure: `apps/backend/src/shared/rbac`, `apps/backend/src/shared/auth`
- Shared contracts: workspace roles and permission names
- Cross-module impact: feature modules check permissions through shared RBAC, not member-management internals
