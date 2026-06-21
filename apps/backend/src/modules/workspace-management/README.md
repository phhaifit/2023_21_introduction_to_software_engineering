# Workspace Management Module

Owner: Member 3

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own workspace metadata, lifecycle state, detail summaries, deletion, and runtime provisioning requests.
- Use the OpenClaw runtime adapter instead of direct container calls.
- Require subscription entitlement and RBAC checks before write operations.
