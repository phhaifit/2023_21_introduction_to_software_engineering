# Shared Contracts

This folder is the source of truth for cross-module values that all team members must reuse instead of redefining inside feature modules.

Rules:

- Add or rename a contract only through an OpenSpec task or reviewed PR.
- Keep module-specific domain commands, repository inputs, and private implementation details inside the owning module.
- Keep shared contracts small: IDs, roles, statuses, events, plans, API response shape, public summaries, and cross-module request/response DTOs.
- Add feature-specific request/response DTOs only when another module, frontend, backend, or worker boundary needs that public transport shape.
- Do not expose secrets, credentials, tokens, password hashes, private keys, raw integration config, generated IDs, status, timestamps, or authenticated context fields in public request DTOs.
- Keep trusted context such as `workspaceId`, `userId`, and `submittedByUserId` in route parameters, middleware context, or application commands unless the owning OpenSpec change documents a specific exception.
- Frontend feature code must use `@vcp/shared` for cross-module data shapes and must not import backend, database, worker, or private app module implementation files.
- Shared contract files must not import backend, frontend, workers, database, Prisma, Express, React, or app-private modules.
- Shared lifecycle statuses belong in `statuses.ts` only when multiple modules or a frontend/backend boundary consume them. Module-local statuses stay with the owning module until they become cross-module.
- Run `npm run test:contracts` after changing this folder.

Files:

- `ids.ts`: entity identity names and typed ID helpers.
- `roles.ts`: workspace roles, permissions, and role-permission mapping.
- `plans.ts`: subscription plans and OpenClaw entitlement metadata.
- `statuses.ts`: lifecycle status values used across modules.
- `events.ts`: domain event names and payload contracts.
- `api.ts`: shared API response, pagination, validation issue, and error shape.
- `task-orchestration.ts`: task routing and create-task transport contracts.
- `schema.json`: machine-readable contract inventory checked by tests.
