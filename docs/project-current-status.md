# Project Current Status

Last refreshed: 2026-07-08

Source baseline:

- Branch: `docs/project-current-status-agent-integration`
- Master commit reviewed: `56e15b4`
- Source of truth: OpenSpec artifacts plus live code under `apps/`, `packages/`, and `tests/`
- Protected local documents: `.local-docs/` was not inspected

## Executive Summary

The project has a usable modular-monolith foundation with real backend/frontend
surfaces for Authentication, Workspace Management, Agent Management, Workflow
Management, Task & Orchestration, Knowledge Base/RAG, Workspace User Management,
and Subscription & Payment. The main gap is no longer "missing code" for most
modules; it is alignment between OpenSpec checklists, API documentation,
automated tests, and the new authenticated runtime flow.

For the demo, treat Agent Management as feature-complete at module level but not
yet fully integrated into the authenticated workspace-selection flow. The page is
behind `RequireAuth`, still receives `DEMO_WORKSPACE_ID`, and local API tests now
need an explicit mock-auth header when they bypass login.

## OpenSpec Progress

| Change | Progress | Status | Notes |
| --- | ---: | --- | --- |
| `implement-authentication` | 15/15 | complete | Auth UI, routes, session context, and route guard are implemented. |
| `implement-workspace-management` | 15/15 | complete | Workspace CRUD and local OpenClaw provisioning bridge are implemented. |
| `implement-workflow-management` | 16/16 | complete | Workflow CRUD, validation, UI, and execution handoff are implemented. |
| `display-openclaw-progress-chat` | 7/7 | complete | OpenClaw progress projection is complete but not archived. |
| `integrate-openclaw-gateway-control-protocol` | 8/8 | complete | Gateway Control protocol fallback is implemented. |
| `implement-knowledge-base-rag` | 40/41 | in progress | Code is broad and active; final OpenSpec validation checkbox remains unchecked. |
| `implement-subscription-payment` | 0/15 | in progress | Code exists, but tasks/specs are not reconciled with the implementation. |
| `implement-workspace-user-management` | 0/14 | in progress | Code exists, but tasks/specs are not reconciled with the implementation. |
| `implement-tools-integration` | 0/16 | in progress | Still a placeholder; no live Tools Integration router is mounted. |

## Runtime Composition

Current local backend composition mounts these route families:

```text
/api/auth
/api/workspaces
/api/workspaces/:workspaceId/agents
/api/subscriptions
/api/workspaces/:workspaceId/members
/api/workspaces/:workspaceId/invitations
/api/workspaces/:workspaceId/admin-requests
/api/invitations
/api/workspaces/:workspaceId/tasks
/api/workspaces/:workspaceId/executions
/api/workspaces/:workspaceId/conversations
/api/workspaces/:workspaceId/workflows
/api/workspaces/:workspaceId/knowledge
```

Tools Integration routes are still planned and are not mounted.

The local server uses real auth middleware first. Fake auth only activates when
tests or tools send `x-mock-user`. This is correct for browser auth behavior but
breaks older local-runtime tests that expected anonymous demo access.

## Module Status

| Module | Implemented | Still Needs Attention |
| --- | --- | --- |
| Authentication | Register, login, logout, `/me`, session context, frontend auth state, protected routes | E2E fixtures must log in before opening protected pages. |
| Workspace Management | Workspace list/create/detail/delete, local provisioning bridge, workspace routes | Demo should use a real selected workspace instead of hard-coded defaults where possible. |
| Agent Management | List/create/edit/rename/duplicate/enable/disable/delete, model catalog, assistant draft/import, skill preview/download, runtime profile, persistence | Replace `DEMO_WORKSPACE_ID` with authenticated workspace selection; update local-runtime test auth headers; verify browser E2E after login. |
| Tools & Integration | Placeholder README only | Must implement catalog, credentials, masking, assignments, and public query boundary before Agent Management can assign tools. |
| Workflow Management | List/create/detail/edit/delete, execution handoff, stream route, validation against Agent summaries | API docs previously used older planned route names; keep docs synced with live routes. |
| Task & Orchestration | Task creation, OpenClaw start/state/stream/cancel, conversations, KB/RAG ask bridge | Live OpenClaw Gateway availability and auth remain demo environment dependencies. |
| Subscription & Payment | Plans, usage, checkout, upgrade, callback, promo, renewal, payment method, cancel, VNPay/Stripe-oriented routes, frontend billing page | OpenSpec tasks and README still need reconciliation before claiming spec-complete status. |
| Workspace User Management | Members, invitations, admin requests, accept invite, role updates, host transfer, frontend members page | OpenSpec tasks and README still need reconciliation before claiming spec-complete status. |
| Knowledge Base / RAG | Upload, parsing, queue, Google Drive OAuth/sync, retrieval, answer generation, grants, processing UI, task chat integration | Final OpenSpec task checkbox and production-provider/demo environment evidence need explicit closeout. |

## Latest Verification Snapshot

The latest full review after pulling `master` produced:

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | completed | `npm audit` still reports 4 vulnerabilities; lockfile was restored after npm metadata churn. |
| `npm run build` | passed | Vite reports a large chunk warning. |
| `openspec validate --all --strict` | passed | 57/57 OpenSpec items validated. |
| `npm run prisma -- validate` | passed | Prisma schema is valid. |
| `git diff --check` | passed | No whitespace errors. |
| `npm test` | failed | Fails at `tests/contract/agent-management-local-runtime.test.mjs` because the request now receives `401 auth.unauthorized` without `x-mock-user`. |
| `npm run test:e2e` | failed | Agent E2E lands on the login screen because protected routes now require authentication; later tests fail after the dev server stops. |

## Agent Management Integration Report

Agent Management is ready as a control-plane module, but integration work should
focus on auth/workspace wiring and cross-module public boundaries.

Current Agent Management flow:

```text
Authenticated app shell
  -> /agents
  -> AgentManagementPage(workspaceId = DEMO_WORKSPACE_ID)
  -> /api/workspaces/:workspaceId/agents
  -> createWorkspaceContextMiddleware
  -> Agent Management use cases/repository
```

Current issue:

```text
Browser E2E without login
  -> / redirects to /authentication
  -> "Agents" link is unavailable

Contract test without x-mock-user
  -> GET /api/workspaces/workspace-product-demo/agents
  -> 401 auth.unauthorized
```

Confirmed behavior from the latest review:

- Without auth or mock header, the agent list API returns `401`.
- With `x-mock-user: local-dev-user`, the same endpoint returns `200` and the seeded demo agents.
- The frontend app shell is intentionally protected by `RequireAuth`.

Recommended integration sequence:

1. Update Agent Management local-runtime test setup to send `x-mock-user` for
   API-level demo-runtime checks.
2. Update Playwright E2E fixtures to register/login or seed an authenticated
   session before opening `/agents`.
3. Replace direct `DEMO_WORKSPACE_ID` wiring in app routes with current
   authenticated workspace selection once Workspace Management and Workspace
   User Management expose the stable frontend context.
4. Keep tool assignment out of Agent Management until Tools Integration exposes
   a public catalog/assignment API.
5. Keep knowledge grants owned by KB/RAG; Agent Management may preserve user
   intent and call public KB/RAG grant APIs only after a scoped OpenSpec change.

## Demo Notes

For tonight's demo, the safest storyline is:

- Start with Authentication to show the platform now has real protected routes.
- Open Workspace Management and explain workspace context is the tenant boundary.
- Show Agent Management as the mature module: list, create, assistant/import,
  model selection, `skill.md`, enable/disable/delete.
- Explain integration limitation clearly: the UI route still uses the demo
  workspace ID while the backend now enforces auth/workspace context.
- Show KB/RAG and Task Orchestration only with prepared local environment values
  if the needed provider/OpenClaw services are available.

## Immediate Risks

- OpenSpec and code state are not aligned for Subscription and Workspace User
  Management; do not present them as OpenSpec-complete.
- Tools Integration is not implemented; any Agent tool assignment demo would be
  speculative.
- The test suite is not green until Agent Management runtime auth and E2E login
  setup are fixed.
- `npm audit` reports vulnerabilities in dependencies; do not run forced
  dependency upgrades during demo preparation without a separate review.
