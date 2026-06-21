# Agent Management Module

Owner: Member 5

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own agent listing, creation, editing, status changes, and `skill.md` generation.
- Publish agent creation/update events for orchestration and tool assignment.
- Do not execute tasks; task runs belong to Task & Orchestration.

Public contract:

- Other modules consume `AgentPublicSummary` from `@vcp/shared/contracts/agent-management.ts`.
- The public summary includes `agentId`, `workspaceId`, `name`, `role`, `model`, `status`, and `updatedAt`.
- The public summary intentionally excludes private configuration fields such as `instructions`.

Lifecycle rules:

- New agents default to `enabled`.
- `enabled` agents are selectable for new task or workflow execution.
- `disabled` agents remain visible in active lists but are not selectable for new work.
- `deleted` agents are retained as lifecycle records, excluded from active lists, and cannot be re-enabled.
- Create and update flows generate `skill.md` content from canonical stored fields through the application boundary.

HTTP API:

- Mount `createAgentManagementRouter()` at `/api/workspaces/:workspaceId/agents`.
- `GET /` lists enabled and disabled agents.
- `POST /` creates an agent.
- `GET /:agentId/configuration` returns active editable configuration for the edit form.
- `PATCH /:agentId` updates role, model, and instructions.
- `POST /:agentId/enable` and `POST /:agentId/disable` change availability.
- `DELETE /:agentId` marks an agent as deleted.
- Every response uses the shared `ApiResponse` envelope; list and mutation routes expose only public agent summaries.
- The configuration route is the only route that returns private `instructions`; it never returns generated skill content.

Current integration limitation:

- The router derives workspace and current-user data from a mock request-context boundary.
- Real authentication and production workspace membership resolution remain outside the local development composition.
- `apps/backend/src/local-agent-management-server.ts` is a development-only composition root. Without `DATABASE_URL`, it uses resettable in-memory seed data. With `DATABASE_URL`, it uses the Prisma repository through `@vcp/database`.
