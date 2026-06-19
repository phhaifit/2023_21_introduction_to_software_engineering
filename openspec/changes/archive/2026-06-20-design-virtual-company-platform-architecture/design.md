## Context

The platform virtualizes a company workspace by combining a web product, backend control plane, and one OpenClaw runtime instance per workspace. The requirements in `docs/requirements.md` describe nine core domains that map cleanly to nine parallel team ownership areas: authentication, subscription and payment, workspace management, workspace user management, agent management, tools and integration, workflow management, task orchestration, and knowledge base/RAG.

This change is the foundation baseline only. It defines architecture, contracts, skeleton folders, infrastructure boundaries, and team workflow. It intentionally does not define detailed feature behavior such as login, agent CRUD, payment checkout, workflow execution, or RAG ingestion. Those behaviors should be implemented through separate per-module OpenSpec changes after the foundation is agreed.

The architecture must let each member build a core requirement independently while still converging into one coherent system. The safest approach for a student team is a modular monolith with vertical slices: one deployable backend for shared operational simplicity, but each domain owns its routes, service layer, data access, tests, and UI pages. External integrations and slow jobs run through workers behind stable contracts.

### Core Requirement Analysis

| Owner area | Primary responsibility | Must own | Depends on by contract only |
| --- | --- | --- | --- |
| Authentication | Identify users and maintain secure sessions | users, password hashes, sessions/tokens, current-user API | none |
| Subscription & Payment | Decide what resources a user/workspace may consume | plans, subscriptions, transactions, payment webhooks, upgrade entitlement | authentication, workspace-management events |
| Workspace Management | Create and operate OpenClaw-backed workspaces | workspace metadata, lifecycle state, OpenClaw container provisioning | authentication, subscription entitlements |
| Workspace User Management | Share a workspace with roles | invitations, memberships, RBAC checks | authentication, workspace-management |
| Agent Management | Configure virtual employees inside a workspace | agent records, role/model/instruction config, `skill.md` generation | workspace membership, workspace runtime |
| Tools & Integration | Connect tools and assign them to agents | tool catalog, OAuth/API-key credentials, tool-agent assignments | workspace membership, agent identity |
| Workflow Management | Model repeatable multi-agent flows | workflow definitions, steps, routing graph, execution trigger | agent identity, tool assignments, task execution contract |
| Task & Orchestration | Execute user requests through agents/workflows | task runs, routing decisions, context handoff, final result aggregation | agents, workflows, tools, knowledge retrieval |
| Knowledge Base / RAG | Provide company context to agents | documents, sync jobs, chunks, embeddings, vector indexes, knowledge permissions | workspace membership, agent identity |

### High-Level Architecture

```text
Web Client
  -> Backend API (modular vertical slices)
      -> Auth Module
      -> Billing Module
      -> Workspace Module
      -> Membership/RBAC Module
      -> Agent Module
      -> Tool Integration Module
      -> Workflow Module
      -> Task Orchestration Module
      -> Knowledge/RAG Module
  -> Background Workers
      -> OpenClaw provisioner
      -> payment webhook processor
      -> document ingestion/vectorization
      -> task execution/orchestration
  -> Shared Infrastructure
      -> relational database
      -> queue/cache
      -> object storage
      -> vector database
      -> secrets vault/encrypted credential store
      -> OpenClaw runtime/container engine
```

### Suggested Repository Layout

```text
frontend/
  src/features/<capability>/
backend/
  src/modules/<capability>/
  src/shared/auth/
  src/shared/rbac/
  src/shared/db/
  src/shared/events/
  src/shared/openclaw/
workers/
  src/jobs/
shared/
  contracts/
  types/
tests/
  e2e/
  contract/
```

Each capability should expose its behavior through API handlers and service methods, not by importing another member's internal data-access code. Shared DTOs, event names, role constants, and status enums live in `shared/contracts`.

## Goals / Non-Goals

**Goals:**

- Provide a clear architecture foundation for the full OpenClaw-based virtual company platform.
- Split future implementation into nine bounded capabilities that match the nine team members.
- Define the minimum shared contracts needed before implementation starts: IDs, roles, lifecycle states, API boundaries, and domain events.
- Keep first implementation simple enough for a course project while preserving realistic production concerns such as secrets, RBAC, async jobs, and tenant isolation.
- Make OpenClaw runtime provisioning an internal adapter so the rest of the product is not tightly coupled to container details.
- Document module ownership, OpenSpec usage, and PR rules so the team can work from one source of truth.

**Non-Goals:**

- Do not implement feature behavior in this change.
- Do not keep feature-level specs such as `authentication` or `agent-management` inside this architecture-foundation change.
- Do not split the backend into many independently deployed microservices for the first version.
- Do not build a full visual workflow canvas unless time remains after the core workflow CRUD and execution contracts work.
- Do not support cross-workspace data sharing in the first version.
- Do not process real payments or connect production third-party credentials during the course-project foundation phase.

## Decisions

### Decision 1: Use a Modular Monolith with Vertical Slices

Implement one backend application with separate modules per capability. Each module owns routes, service logic, repositories, validation, and tests. The frontend mirrors the same feature folders.

Rationale: the team can work in parallel without the operational overhead of nine services, distributed deployment, service discovery, and cross-service debugging.

Alternative considered: microservices per requirement. This gives stronger isolation but is too expensive for initial delivery and makes local development harder.

### Decision 2: Treat Workspace as the Main Tenant Boundary

All business entities after login must be scoped by `workspaceId`: members, agents, tools, workflows, tasks, documents, vector indexes, and OpenClaw runtime metadata.

Rationale: this prevents accidental data leakage between virtual companies and gives every module a common access-control key.

Alternative considered: user-owned resources only. This fails once multiple members collaborate inside the same workspace.

### Decision 3: Put OpenClaw Behind a Workspace Runtime Adapter

Workspace creation should write metadata first, enqueue a provisioning job, and let a worker create/start the OpenClaw container. The workspace lifecycle uses states such as `pending`, `running`, `failed`, `stopping`, and `deleted`.

Rationale: container startup can be slow or fail. Async provisioning keeps the UI responsive and gives the workspace team a stable contract even if the underlying runtime changes.

Alternative considered: create the OpenClaw instance synchronously in the HTTP request. This is simpler but risks timeouts and poor failure recovery.

### Decision 4: Establish Contract-First APIs and Events

Before feature implementation, agree on shared entities and events:

- Identity: `userId`, `workspaceId`, `memberId`, `agentId`, `toolId`, `workflowId`, `taskId`, `documentId`.
- Roles: `admin`, `editor`, `viewer`.
- Plans: `standard`, `premium`.
- Workspace states: `pending`, `running`, `failed`, `stopping`, `deleted`.
- Agent states: `enabled`, `disabled`, `deleted`.
- Task states: `queued`, `running`, `requires_action`, `succeeded`, `failed`, `cancelled`.

Important domain events:

- `subscription.activated`
- `subscription.upgraded`
- `workspace.provisioning_requested`
- `workspace.running`
- `workspace.deleted`
- `member.invited`
- `agent.created`
- `agent.updated`
- `tool.connected`
- `workflow.published`
- `task.submitted`
- `task.completed`
- `knowledge.document_uploaded`
- `knowledge.index_ready`

Rationale: events let modules coordinate without direct internal dependencies.

### Decision 5: Centralize Authorization Checks

Authentication answers "who is the user"; workspace RBAC answers "what may this user do in this workspace." All write operations inside a workspace must check membership and role.

Suggested rule matrix:

| Capability action | Admin | Editor/Member | Viewer |
| --- | --- | --- | --- |
| View workspace data | yes | yes | yes |
| Manage agents/workflows/tools/tasks | yes | yes | no |
| Upload/manage knowledge | yes | yes | no |
| Manage members | yes | no | no |
| Delete workspace | yes | no | no |
| Billing/subscription | owner/admin | no | no |

Rationale: duplicating authorization logic inside each module will create inconsistent permissions. A shared RBAC middleware/service gives every team member the same contract.

### Decision 6: Store Credentials Through a Secure Credential Boundary

Tool/API credentials must never be returned to the frontend after creation. The tools module stores encrypted credentials or references to a secret store and returns only metadata such as provider, status, and last validation time.

Rationale: tools and integration are high-risk because they hold external API keys and OAuth tokens.

Alternative considered: store credentials as plain database fields for speed. This is not acceptable even in a demo because it normalizes unsafe handling.

### Decision 7: Use Workers for Slow or External Processes

Use background jobs for OpenClaw provisioning, payment webhook reconciliation, document ingestion, vector embedding, external data sync, and long-running task orchestration.

Rationale: these processes are naturally asynchronous and must be retryable.

### Decision 8: Separate Workflow Definition from Task Execution

Workflow Management owns reusable workflow definitions. Task Orchestration owns actual task runs and can execute either a direct agent request, a selected workflow, or an automatic routing decision.

Rationale: this avoids circular ownership between the workflow owner and the orchestration owner. Workflows describe the plan; tasks execute it.

### Decision 9: Knowledge Access is Permissioned by Workspace and Agent

The RAG module must enforce both workspace scope and agent-document permission before retrieval. Agents must not query every document in the workspace by default.

Rationale: internal company knowledge can include sensitive HR, finance, sales, and customer data.

### Decision 10: Standardize on a TypeScript Full-Stack Baseline

Use TypeScript across frontend, backend, shared contracts, workers, and tests.

Foundation stack decisions:

- Frontend: React with Vite.
- Backend: Node.js with Express for the first implementation.
- ORM / database access: Prisma with PostgreSQL.
- Unit and contract tests: Vitest where TypeScript test execution is needed; current foundation contract checks may stay as lightweight Node scripts until dependencies are installed.
- E2E tests: Playwright.

Rationale: TypeScript gives shared type contracts across frontend/backend/workers, React + Vite is lightweight for a student team, Express is familiar and easy to onboard, Prisma reduces database boilerplate, and Playwright covers end-to-end user flows.

Alternative considered: Next.js full-stack. It is productive, but the project needs a clearer split between frontend, backend API, and workers for OpenClaw provisioning and long-running orchestration.

### Decision 11: Use Docker Compose for Local and Demo Runtime

Use Docker Compose for local development and course demo deployment. Docker Compose should run PostgreSQL, Redis or a queue-compatible service, Qdrant, and OpenClaw-related runtime dependencies where practical.

Rationale: Docker Compose is much simpler than Kubernetes for a course project and matches the need to run OpenClaw/container-backed workspace instances locally.

Alternative considered: Kubernetes. It is better for production orchestration, but it adds operational complexity that would distract from the software engineering goals.

### Decision 12: Use Sandbox/Mock Payment in the First Version

Use a payment provider adapter with sandbox or mock payment behavior for the first version. Do not process real money during the course demo.

The default path is:

- implement a `mock-payment` or sandbox adapter first;
- keep the provider boundary compatible with Stripe-like checkout/webhook semantics;
- only add a real provider if the course explicitly requires it.

Rationale: subscription entitlement and upgrade flows matter to the architecture; real payment processing does not.

### Decision 13: Use Qdrant and an Embedding Adapter for RAG

Use Qdrant as the default vector database for local/demo use, behind a vector-store adapter. Use an embedding adapter so the team can start with mock/local embeddings and later plug in a real embedding provider.

Rationale: Qdrant runs easily in Docker, has a clear vector-search model, and keeps RAG work testable without hard-wiring one model provider into the foundation.

### Decision 14: Implement One Representative Quick Integration First

Use Telegram as the first representative quick integration because it is simple to demo with a bot-token/template flow. Keep Zalo, Facebook Messenger, and Slack as catalog placeholders or stretch goals.

Rationale: the project needs to prove the integration architecture and tool assignment flow before supporting many providers. Telegram has lower setup complexity for a student demo.

### Decision 15: Keep `editor` and `member` as One Role for V1

Use exactly three workspace roles in the first version: `admin`, `editor`, and `viewer`. Treat the requirement's `Editor/Member` wording as the single `editor` role.

Rationale: separate `editor` and `member` roles would create permission complexity without a clear requirement-level difference.

### Decision 16: Keep Multi-Agent Orchestration Minimal for V1

The first implementation should support:

- direct agent routing;
- selected sequential workflow execution;
- a simple automatic router that chooses among enabled agents;
- logged handoff records as trace data.

Full autonomous agent-to-agent negotiation is out of scope for the first version.

Rationale: the system needs a reliable demoable orchestration path before complex multi-agent autonomy.

## Risks / Trade-offs

- [Risk] Parallel members accidentally change shared contracts independently -> Mitigation: keep `shared/contracts` small, review contract changes first, and require contract tests for API/event payloads.
- [Risk] Modular monolith boundaries degrade into tangled imports -> Mitigation: enforce module public interfaces and avoid cross-module repository imports.
- [Risk] OpenClaw provisioning fails or takes longer than expected -> Mitigation: async lifecycle states, retry jobs, failure reason fields, and UI status polling.
- [Risk] Payment and workspace resource upgrades become inconsistent -> Mitigation: process payment webhooks idempotently and trigger a single `subscription.upgraded` event for workspace resizing.
- [Risk] Credentials leak through logs or API responses -> Mitigation: secret redaction, encrypted storage, no credential readback, and safe logging helpers.
- [Risk] RAG ingestion is too heavy for the initial deadline -> Mitigation: start with file upload plus manual indexing, then add external sync connectors later.
- [Risk] Multi-agent orchestration scope expands too much -> Mitigation: define a minimal run protocol first: selected agent, selected workflow, or automatic router with logged steps.

## Migration Plan

1. Approve the architecture and capability split.
2. Create shared contracts for IDs, roles, statuses, API DTOs, and event names.
3. Scaffold the frontend/backend/workers/shared layout.
4. Implement infrastructure foundations: database schema migration setup, auth middleware, RBAC middleware, queue/worker runner, and OpenClaw adapter interface.
5. Let each team member implement their capability behind the agreed route and event contracts.
6. Integrate end-to-end flow in this order: authentication -> subscription -> workspace creation -> membership -> agent/tool/workflow setup -> task run -> knowledge retrieval.
7. Add contract tests first, then feature tests and e2e happy-path tests.

Rollback strategy for implementation: because this change only creates planning artifacts, rollback is removing the OpenSpec change directory. During implementation, each capability should be merged behind route-level and UI-level feature completeness checks.

## Open Questions

- None for the foundation baseline. The previous open questions are answered in Decisions 10-16.

Future per-module changes may reopen provider choices if implementation evidence shows a better course-project fit.
