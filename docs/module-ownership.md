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

## Current Status Snapshot

Last refreshed from `master` commit `56e15b4` on 2026-07-08.

| Capability | OpenSpec State | Code State | Integration Notes |
| --- | --- | --- | --- |
| Authentication | `implement-authentication` complete, 15/15 tasks | Backend routes, session middleware, frontend auth guard, and auth UI are implemented | Protected app routes now redirect unauthenticated browser sessions to `/authentication`; old E2E tests must create a real session before using app-shell links. |
| Subscription & Payment | `implement-subscription-payment` in progress, 0/15 tasks | Backend router, frontend billing page, plans, checkout/upgrade/cancel, promo, saved-method, VNPay, and Stripe-oriented endpoints exist | OpenSpec checklist and module README lag behind code; treat payment-provider behavior as provisional until tasks/specs/tests are reconciled. |
| Workspace Management | `implement-workspace-management` complete, 15/15 tasks | Workspace list/create/detail/delete routes and UI are implemented | Runtime provisioning is bridged locally through the development composition root. |
| Workspace User Management | `implement-workspace-user-management` in progress, 0/14 tasks | Backend membership/invitation/admin-request routes, frontend members page, and invitation accept flows exist | Checklist and API docs were stale; integration now depends on auth/session setup and role-aware E2E coverage. |
| Agent Management | Archived OpenSpec specs are the source of truth; active `implement-agent-management` is already archived | Backend API, frontend page, model catalog, assistant draft/import, `skill.md`, runtime profile, persistence, and local runtime composition exist | Main integration blocker is auth/workspace context: local contract tests need explicit `x-mock-user`, while browser E2E must log in before opening `/agents`. |
| Tools & Integration | `implement-tools-integration` in progress, 0/16 tasks | Placeholder module only; no live router is mounted | Keep tool catalog/credential/assignment behavior out of Agent Management until this module exposes public APIs. |
| Workflow Management | `implement-workflow-management` complete, 16/16 tasks | Backend workflow routes, frontend pages, validation, and execution handoff exist | API matrix now tracks live route names; Workflow still delegates execution to Task & Orchestration. |
| Task & Orchestration | Archived task/OpenClaw changes complete for the current route family | Task creation, OpenClaw execution start/state/stream/cancel, conversations, and KB/RAG ask bridge are implemented | In-memory execution state remains a local/runtime limitation; OpenClaw Gateway setup is an external dependency for live demos. |
| Knowledge Base / RAG | `implement-knowledge-base-rag` in progress, 40/41 tasks | Upload, validation, ingestion, durable queue, Google Drive OAuth/sync, retrieval, RAG answer, grants, and task-chat bridge are implemented | Only OpenSpec validation checkbox remains unchecked in tasks, but `openspec validate --all --strict` passed in the latest review. |

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
