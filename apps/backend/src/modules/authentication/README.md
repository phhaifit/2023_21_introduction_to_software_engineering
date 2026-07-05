# Authentication Module

Owner: Member 1

## Overview

This module manages user identity, providing core features including Register, Login, Logout, and retrieving the current session (GET me).

## Boundary

- *This module owns:* user registration, login, logout, session authentication, the `users` table (specifically managing the `passwordHash` column), and the `sessions` table.
- *This module does NOT own / references:* RBAC/authorization, workspace management, global fake auth (`x-mock-user`/`x-mock-role`), OAuth, password reset, email verification, and refresh tokens.

## Domain Concepts

- `User { userId, email, displayName?, passwordHash, status, createdAt, updatedAt }`
- `Session { sessionId, userId, tokenHash, createdAt, expiresAt, revokedAt? }`

**Invariants:**
- Session TTL (Time To Live) is 7 days.
- The logout operation is idempotent.
- Expiration time comparison uses the `<=` operator.

## Endpoints

```text
POST /api/auth/register
- Description: Create a new account.
- Request shape: { email, password, displayName? }
- Response shape: { userId, email, displayName, status, createdAt }
- Status code: 201 / 422

POST /api/auth/login
- Description: Authenticate and issue a session token.
- Request shape: { email, password }
- Response shape: { user: {...}, session: { token, expiresAt } }
- Status code: 200 / 401

POST /api/auth/logout
- Description: Invalidate the current session via Authorization header.
- Request shape: Header Authorization: Bearer <token>
- Response shape: { success: true }
- Status code: 200 (idempotent)

GET /api/auth/me
- Description: Return current user information from the session.
- Request shape: Header Authorization: Bearer <token>
- Response shape: { userId, email, displayName }
- Status code: 200 / 401
```

## Architecture Decisions

- Sessions are stored server-side in Postgres (no JWT, no Redis).
- Passwords are hashed using the bcryptjs algorithm with a salt of 12.
- Session tokens are hashed using SHA-256; the raw token is returned exactly once during login, and the DB only stores the `tokenHash`.
- The `InvalidCredentialsError` uses a single generic message to prevent user enumeration attacks.
- The auth session middleware runs at the router-level on the `/me` endpoint. It runs in parallel with fake auth and does not gate other modules.

## Auth Session Middleware Flow

1. Receive request with `Authorization: Bearer <token>` header.
2. Hash the token using SHA-256.
3. Look up the `sessions` table using the `tokenHash`.
4. Check if the session is revoked or expired.
5. Load the corresponding user.
6. Merge user information into the request context (preserving `requestId` and current fake auth info).

## DB Ownership

- Authentication owns the `users` table (adding the `passwordHash` column) and the `sessions` table.
- Entities are imported via `@vcp/database`; relative imports across packages are strictly prohibited.
- Do not access or mutate tables owned by other modules.

## Local Development

- The `DATABASE_URL` environment variable must be set (pointing to the `vcp-pg` Postgres container).
- If this variable is missing, the application falls back to an in-memory repository (data will be lost upon server restart).
- Note: Setting `$env:DATABASE_URL` in PowerShell is not persistent across different terminal sessions.

## Assumptions & Limitations

- (a) Authentication does not gate the entire app (Direction B, feature operates independently via the Account section, and other modules continue using fake auth).
- (b) `displayName` exists in the domain, but the Prisma schema DOES NOT currently have this column -> the value will be empty when queried via Prisma.
- (c) The frontend uses **react-router** (with the `/authentication` route), NOT state-based routing.
- (d) Out of scope: OAuth, password reset, email verification, and refresh tokens.

## OpenSpec Validation

Validation result:
`openspec validate implement-authentication --strict` -> valid.
