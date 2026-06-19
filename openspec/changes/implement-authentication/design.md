## Context

The foundation provides `backend/src/modules/authentication`, `frontend/src/features/authentication`, shared API response contracts, request context placeholders, and RBAC placeholders. Authentication is the first protected platform boundary and must produce a consistent user/session context for all workspace-scoped modules.

## Goals / Non-Goals

**Goals:**
- Implement email/password registration, login, logout, and authenticated request context.
- Keep password storage secure through hashing and never return secrets in API responses.
- Provide frontend screens and route protection for authenticated users.
- Use shared API success/error response shapes.

**Non-Goals:**
- OAuth/social login.
- Password reset and email verification.
- Advanced device management or refresh-token rotation beyond the V1 session/token approach.

## Decisions

1. Use email/password authentication for V1.
   - Rationale: It directly matches the requirements and avoids external OAuth setup during the school project.
   - Alternative considered: OAuth-first login. Rejected for V1 because it adds provider configuration and callback complexity.

2. Store password hashes, never plaintext passwords.
   - Rationale: This is the minimum acceptable security baseline for account credentials.
   - Alternative considered: Demo-only plaintext storage. Rejected because it would teach the wrong implementation pattern.

3. Expose authenticated user data through `RequestContext`.
   - Rationale: Other modules need a consistent way to identify `userId`, `workspaceId`, and roles without importing authentication internals.
   - Alternative considered: Each module parses tokens independently. Rejected because it duplicates security logic.

4. Treat logout as server-side session/token invalidation when the selected session strategy supports it.
   - Rationale: The requirement says backend invalidates the token/session.
   - Alternative considered: Client-only token deletion. Rejected as the only logout behavior because stale tokens may remain valid.

## Risks / Trade-offs

- Token invalidation depends on the final token/session store -> Keep the module behind an auth service interface so the storage strategy can evolve.
- Authentication touches all protected routes -> Add focused contract and integration tests before other modules depend on it.
- Password handling is security-sensitive -> Centralize hashing and credential verification inside the authentication module.
