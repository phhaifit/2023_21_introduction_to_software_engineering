# Module Ownership and Team Assignment

Use this document to assign one member to each product capability.

Replace `Member N` with the real team member name before implementation starts.

The architecture foundation is complete and archived. Each member should now work from the active per-module OpenSpec change assigned below.

Before coding, each member must follow `docs/team-module-implementation-guide.md` to confirm read order, allowed files, API route rows, shared contract impact, Prisma impact, domain event impact, tests, and PR handoff notes.

| Member | Capability | Backend Folder | Frontend Folder | Active OpenSpec Change |
| --- | --- | --- | --- | --- |
| Member 1 | Authentication | `apps/backend/src/modules/authentication` | `apps/frontend/src/features/authentication` | `implement-authentication` |
| Member 2 | Subscription & Payment | `apps/backend/src/modules/subscription-payment` | `apps/frontend/src/features/subscription-payment` | `implement-subscription-payment` |
| Member 3 | Workspace Management | `apps/backend/src/modules/workspace-management` | `apps/frontend/src/features/workspace-management` | `implement-workspace-management` |
| Member 4 | Workspace User Management | `apps/backend/src/modules/workspace-user-management` | `apps/frontend/src/features/workspace-user-management` | `implement-workspace-user-management` |
| Member 5 | Agent Management | `apps/backend/src/modules/agent-management` | `apps/frontend/src/features/agent-management` | `implement-agent-management` |
| Member 6 | Tools & Integration | `apps/backend/src/modules/tools-integration` | `apps/frontend/src/features/tools-integration` | `implement-tools-integration` |
| Member 7 | Workflow Management | `apps/backend/src/modules/workflow-management` | `apps/frontend/src/features/workflow-management` | `implement-workflow-management` |
| Member 8 | Task & Orchestration | `apps/backend/src/modules/task-orchestration` | `apps/frontend/src/features/task-orchestration` | `implement-task-orchestration` |
| Member 9 | Knowledge Base / RAG | `apps/backend/src/modules/knowledge-base-rag` | `apps/frontend/src/features/knowledge-base-rag` | `implement-knowledge-base-rag` |

## Shared Foundation Owners

Before feature work starts, the team lead or rotating reviewers should own these shared areas:

| Area | Path | Responsibility |
| --- | --- | --- |
| Shared contracts | `packages/shared/src/contracts` | Review ID, role, status, API, and event changes before merge |
| Backend shared infrastructure | `apps/backend/src/shared` | Keep platform abstractions generic |
| Workers | `apps/workers/src/jobs` | Keep slow jobs out of HTTP request handling |
| Contract tests | `tests/contract` | Ensure contract changes stay valid |
| E2E tests | `tests/e2e` | Add integrated flows after feature modules exist |

## Branch Naming

Suggested branch format:

```text
feature/<capability>
```

Examples:

```text
feature/authentication
feature/agent-management
feature/knowledge-base-rag
```

## Handoff Rule

Each member's PR must state:

- capability name
- OpenSpec change name
- tasks completed
- tests run
- contracts changed, if any

Use `docs/team-module-implementation-guide.md` for the full per-module checklist before requesting review.
