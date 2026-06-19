# Backend Shared Infrastructure

This folder contains platform-level interfaces reused by capability modules.

Shared infrastructure must stay generic and must not contain feature-specific business logic.

Folders:

- `auth`: request identity context produced by the authentication module.
- `rbac`: workspace role and permission checks.
- `db`: database connection and migration abstractions.
- `events`: domain event bus contracts.
- `openclaw`: runtime adapter boundary for OpenClaw instances.
- `logging`: structured logging and secret redaction helpers.
