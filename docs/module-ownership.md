# Module Ownership and Team Assignment

Use this document to assign one member to each product capability.

Replace `Member N` with the real team member name before implementation starts.

The architecture foundation is complete and archived. Each member should now work from the active per-module OpenSpec change assigned below.

| Member | Capability | Backend Folder | Frontend Folder | Active OpenSpec Change |
| --- | --- | --- | --- | --- |
| Member 1 | Authentication | `backend/src/modules/authentication` | `frontend/src/features/authentication` | `implement-authentication` |
| Member 2 | Subscription & Payment | `backend/src/modules/subscription-payment` | `frontend/src/features/subscription-payment` | `implement-subscription-payment` |
| Member 3 | Workspace Management | `backend/src/modules/workspace-management` | `frontend/src/features/workspace-management` | `implement-workspace-management` |
| Member 4 | Workspace User Management | `backend/src/modules/workspace-user-management` | `frontend/src/features/workspace-user-management` | `implement-workspace-user-management` |
| Member 5 | Agent Management | `backend/src/modules/agent-management` | `frontend/src/features/agent-management` | `implement-agent-management` |
| Member 6 | Tools & Integration | `backend/src/modules/tools-integration` | `frontend/src/features/tools-integration` | `implement-tools-integration` |
| Member 7 | Workflow Management | `backend/src/modules/workflow-management` | `frontend/src/features/workflow-management` | `implement-workflow-management` |
| Member 8 | Task & Orchestration | `backend/src/modules/task-orchestration` | `frontend/src/features/task-orchestration` | `implement-task-orchestration` |
| Member 9 | Knowledge Base / RAG | `backend/src/modules/knowledge-base-rag` | `frontend/src/features/knowledge-base-rag` | `implement-knowledge-base-rag` |

## Shared Foundation Owners

Before feature work starts, the team lead or rotating reviewers should own these shared areas:

| Area | Path | Responsibility |
| --- | --- | --- |
| Shared contracts | `shared/contracts` | Review ID, role, status, API, and event changes before merge |
| Backend shared infrastructure | `backend/src/shared` | Keep platform abstractions generic |
| Workers | `workers/src/jobs` | Keep slow jobs out of HTTP request handling |
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
