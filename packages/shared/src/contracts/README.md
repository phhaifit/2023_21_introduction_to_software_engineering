# Shared Contracts

This folder is the source of truth for cross-module values that all team members must reuse instead of redefining inside feature modules.

Rules:

- Add or rename a contract only through an OpenSpec task or reviewed PR.
- Keep module-specific request/response details inside the owning module.
- Keep shared contracts small: IDs, roles, statuses, events, plans, API response shape, and error codes.
- Run `npm run test:contracts` after changing this folder.

Files:

- `ids.ts`: entity identity names and typed ID helpers.
- `roles.ts`: workspace roles, permissions, and role-permission mapping.
- `plans.ts`: subscription plans and OpenClaw entitlement metadata.
- `statuses.ts`: lifecycle status values used across modules.
- `events.ts`: domain event names and payload contracts.
- `api.ts`: shared API response and error shape.
- `task-orchestration.ts`: task routing and create-task transport contracts.
- `schema.json`: machine-readable contract inventory checked by tests.
