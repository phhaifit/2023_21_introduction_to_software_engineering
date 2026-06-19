## Why

Users need a secure way to register, sign in, maintain sessions, and sign out before they can access workspace-scoped platform features. This change establishes the authentication module as the entry point for all protected workflows.

## What Changes

- Add email/password registration with validation and password hashing.
- Add login that issues a session or access token.
- Add logout that invalidates the active session or token.
- Add frontend authentication screens and route guards for protected areas.
- Integrate authenticated request context with shared backend infrastructure.

## Capabilities

### New Capabilities
- `authentication`: User registration, login, logout, session/token lifecycle, and authenticated request context.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `backend/src/modules/authentication`
- Frontend feature: `frontend/src/features/authentication`
- Shared infrastructure: `backend/src/shared/auth`, `backend/src/shared/rbac`
- Shared contracts: API response/error conventions from `shared/contracts`
