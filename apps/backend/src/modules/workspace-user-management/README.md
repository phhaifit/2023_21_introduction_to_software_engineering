# Workspace User Management Module

Owner: Member 4

OpenSpec change: `implement-workspace-user-management`

Current OpenSpec status: in progress, 0/14 tasks checked as of 2026-07-08.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own invitations, memberships, role assignments, member list, and access removal.
- Maintain role state used by shared RBAC checks.
- Do not own authentication credentials or workspace lifecycle.

Current implementation:

- `createWorkspaceUserManagementRouter()` is mounted at `/api/workspaces/:workspaceId`.
- `createAcceptInvitationRouter()` is mounted at `/api/invitations`.
- Member routes include list, role update, removal, and host transfer.
- Invitation routes include create, update, delete, resend, and public accept.
- Admin-request routes include create, approve, and reject.
- Frontend member management exists under `apps/frontend/src/features/workspace-user-management`.

Known documentation/spec gap:

- The active OpenSpec checklist still shows 0/14 tasks complete even though code and UI exist.
- Treat the module as implemented-in-code but not OpenSpec-complete until tasks, focused tests, and handoff docs are reconciled.
- Browser integration depends on Authentication because workspace-member pages are protected by `RequireAuth`.
