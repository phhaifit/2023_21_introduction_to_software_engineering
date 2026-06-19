# Authentication Module

Owner: Member 1

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own user registration, login, logout, password hashing, and current-user context.
- Expose authenticated user identity to downstream modules through shared request context.
- Do not own workspace-level authorization; use the RBAC shared module for that.
