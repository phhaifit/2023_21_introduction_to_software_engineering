# Workspace Management Module

Owner: Member 3

## Responsibility

Owns workspace metadata, lifecycle state, detail summaries, deletion flow, and runtime provisioning requests.
Does **not** manage users or billing — those are handled by `workspace-user-management` and `subscription-payment`.

## Runtime Status Model

```
pending → running  (OpenClaw provisioned successfully)
pending → failed   (OpenClaw provisioning error)
running → stopping → deleted  (deletion requested)
failed  → stopping → deleted  (deletion of failed workspace)
```

| Status    | Meaning                                     |
|-----------|---------------------------------------------|
| `pending` | Workspace saved; OpenClaw provisioning queued |
| `running` | Container live, `runtimeUrl` available       |
| `failed`  | Provisioning error, `failureReason` set      |
| `stopping`| Deletion in-flight; cleanup worker running   |
| `deleted` | Hard-deleted from OpenClaw; no longer accessible |

## Public Contracts (`@vcp/shared`)

Exported from `@vcp/shared/contracts/workspace-management.ts`:

- `WorkspaceSummaryDto` — list item (id, name, status, plan, timestamps)
- `WorkspaceDetailDto` — extends summary with runtimeUrl, agentCount, workflowCount, toolCount
- `CreateWorkspaceRequest` — `{ name, plan }`
- `WorkspaceDeleteAckDto` — `{ workspaceId, status: "stopping" }`

## Domain Events

| Event name                         | Published by       | Consumed by       |
|------------------------------------|--------------------|-------------------|
| `workspace.provisioning_requested` | `createWorkspace`  | OpenClaw provision worker |
| `workspace.deleted`                | `deleteWorkspace`  | OpenClaw delete worker    |

## Module Boundaries

- **Allowed**: import `@vcp/shared`, `@vcp/database` (read-model counts only)
- **Not allowed**: import other module's private services/repositories
- Worker jobs are wired via dependency injection at startup — they do not import backend module internals

## RBAC

- `workspace:delete` permission required for delete — admin role only

## Key Files

```
domain/workspace.ts                         — entity, factory, business rules, DTO mappers
application/workspace-repository.ts         — port interface
application/workspace-use-cases.ts          — list, detail, create, delete
infrastructure/prisma-workspace-mapper.ts   — DB row ↔ domain
infrastructure/prisma-workspace-repository.ts
api/workspace-management-router.ts          — Express routes (GET/, POST/, GET/:id, DELETE/:id)
api/api-response.ts
```
