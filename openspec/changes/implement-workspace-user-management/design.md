## Context

Workspace user management owns collaboration inside a workspace. The foundation has standardized roles as `admin`, `editor`, and `viewer`, and shared RBAC placeholders already exist under backend shared infrastructure.

## Goals / Non-Goals

**Goals:**
- Invite members to a workspace by email.
- List workspace members and their roles.
- Assign and update roles using the shared role set.
- Remove workspace members.
- Enforce permission checks through shared RBAC helpers.

**Non-Goals:**
- Organization-wide identity administration.
- Complex custom roles or per-field permissions.
- Email delivery infrastructure beyond a demo-safe invitation flow.

## Decisions

1. Use the foundation role set: `admin`, `editor`, and `viewer`.
   - Rationale: It keeps RBAC understandable and consistent across modules.
   - Alternative considered: Separate `member` and `editor` roles. Rejected because the foundation consolidated them into `editor`.

2. Keep invitation state inside the workspace user module.
   - Rationale: Invitations are membership lifecycle data, not authentication account data.
   - Alternative considered: Create user accounts immediately for invited emails. Rejected because invitation acceptance and existing-account matching should remain flexible.

3. Expose authorization through shared RBAC, not private member queries.
   - Rationale: Feature modules need permission checks without depending on membership internals.
   - Alternative considered: Each module queries workspace membership directly. Rejected because it duplicates access-control logic.

4. Require admins for member management actions.
   - Rationale: The requirements define Admin as the role with member-management authority.

## Risks / Trade-offs

- Invitation emails may not be available in the demo -> Provide a visible pending invitation record and optionally log/send a mock invite link.
- RBAC bugs can expose data -> Cover admin/editor/viewer scenarios in tests.
- Member removal can affect active sessions -> Permission checks should use current membership state on protected workspace actions.
