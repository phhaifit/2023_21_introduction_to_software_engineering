# Agent Management Module

Owner: Member 5

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own agent listing, creation, editing, status changes, and `skill.md` generation.
- Publish agent creation/update events for orchestration and tool assignment.
- Do not execute tasks; task runs belong to Task & Orchestration.

Public contract:

- Other modules consume `AgentPublicSummary` from `shared/contracts/agent-management.ts`.
- The public summary includes `agentId`, `workspaceId`, `name`, `role`, `model`, `status`, and `updatedAt`.
- The public summary intentionally excludes private configuration fields such as `instructions`.

Lifecycle rules:

- New agents default to `enabled`.
- `enabled` agents are selectable for new task or workflow execution.
- `disabled` agents remain visible in active lists but are not selectable for new work.
- `deleted` agents are retained as lifecycle records, excluded from active lists, and cannot be re-enabled.
- Create and update flows generate `skill.md` content from canonical stored fields through the application boundary.
