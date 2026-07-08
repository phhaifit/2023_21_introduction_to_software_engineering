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
- `POST /skill-preview` renders `skill.md` content for an editable draft without saving an agent.
- `POST /assistant/draft` generates an editable draft through the server-side LLM provider chain.
- `POST /assistant/import-skill` analyzes pasted or uploaded `skill.md` Markdown and returns an editable draft.
- `GET /models` returns the server-side model catalog for the creation flow.
- `GET /:agentId/skill.md` downloads the generated Markdown artifact for enabled or disabled agents.
- `GET /:agentId/configuration` returns active editable configuration for the edit form.
- `PATCH /:agentId` updates role, model, and instructions.
- `PATCH /:agentId/name` renames an active agent.
- `POST /:agentId/duplicate` creates a copy in the same workspace.
- `POST /:agentId/enable` and `POST /:agentId/disable` change availability.
- `DELETE /:agentId` marks an agent as deleted.
- Every response uses the shared `ApiResponse` envelope; list and mutation routes expose only public agent summaries.
- The configuration route is the only route that returns private `instructions`; it never returns generated skill content.

Current integration status:

- The router now runs behind the shared workspace context middleware in the local development server.
- Real authentication middleware populates `context.user` from a Bearer token.
- Fake local auth only activates when a caller sends `x-mock-user`, so API-level tests that bypass login must provide this header explicitly.
- The frontend `/agents` route is protected by `RequireAuth` but still passes `DEMO_WORKSPACE_ID` into `AgentManagementPage`.
- `apps/backend/src/local-agent-management-server.ts` is a development-only composition root. Without `DATABASE_URL`, it uses resettable in-memory seed data. With `DATABASE_URL`, it uses the Prisma repository through `@vcp/database`.
- KB/RAG provides the internal `knowledge.retrieve` boundary and a local-demo
  ask route for grounded deterministic answers from actively assigned
  documents. Production OpenClaw/tool registration is not wired in this
  module.
- Tools Integration is not implemented yet; Agent Management validates requested tool intent through an injected catalog port and must not create tool credentials or assignments directly.
