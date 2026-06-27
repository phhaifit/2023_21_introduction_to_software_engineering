# Virtual Company Platform Architecture

This project uses a modular monolith with vertical slices.

The platform has one deployable backend, but the code is divided by product capability so nine team members can work in parallel without depending on each other's internal implementation.

## Runtime View

```text
Web Client
  -> Backend API
      -> capability modules
      -> shared auth/RBAC/db/events/openclaw/logging
  -> Workers
      -> OpenClaw provisioning
      -> payment webhook reconciliation
      -> document ingestion
      -> task execution
  -> Infrastructure
      -> database
      -> queue/cache
      -> object storage
      -> vector database
      -> secret storage
      -> OpenClaw runtime/container engine
```

## Workspace Layout

The repository is an NPM Workspaces monorepo:

| Workspace | Package | Responsibility |
| --- | --- | --- |
| `apps/frontend` | `@vcp/frontend` | React + Vite application |
| `apps/backend` | `@vcp/backend` | Express API development server and backend modules |
| `apps/workers` | `@vcp/workers` | Background job entry points |
| `packages/shared` | `@vcp/shared` | Shared contracts, IDs, roles, statuses, events, and API shapes |
| `packages/database` | `@vcp/database` | Prisma schema, migrations, generated client access, and database exports |

Root scripts remain the team entrypoint. Use `npm run dev`, `npm test`, `npm run build`, and `npm run prisma -- <command>` from the repository root.

## Module Boundaries

Each capability owns one backend module and one frontend feature folder:

| Capability | Backend | Frontend |
| --- | --- | --- |
| Authentication | `apps/backend/src/modules/authentication` | `apps/frontend/src/features/authentication` |
| Subscription & Payment | `apps/backend/src/modules/subscription-payment` | `apps/frontend/src/features/subscription-payment` |
| Workspace Management | `apps/backend/src/modules/workspace-management` | `apps/frontend/src/features/workspace-management` |
| Workspace User Management | `apps/backend/src/modules/workspace-user-management` | `apps/frontend/src/features/workspace-user-management` |
| Agent Management | `apps/backend/src/modules/agent-management` | `apps/frontend/src/features/agent-management` |
| Tools & Integration | `apps/backend/src/modules/tools-integration` | `apps/frontend/src/features/tools-integration` |
| Workflow Management | `apps/backend/src/modules/workflow-management` | `apps/frontend/src/features/workflow-management` |
| Task & Orchestration | `apps/backend/src/modules/task-orchestration` | `apps/frontend/src/features/task-orchestration` |
| Knowledge Base / RAG | `apps/backend/src/modules/knowledge-base-rag` | `apps/frontend/src/features/knowledge-base-rag` |

## Dependency Rule

Capability modules may depend on:

- `@vcp/shared`
- `apps/backend/src/shared/*`
- their own module files

Capability modules must not depend on another module's private repositories, services, or UI internals.

## Shared Contracts

Shared contracts are defined in `packages/shared/src/contracts` and imported through `@vcp/shared`.

They include:

- entity ID names
- workspace roles
- permissions
- subscription plans
- lifecycle statuses
- API response and error shape
- domain event names and payload contracts

Run this after changing contracts:

```bash
npm run test:contracts
```

## Database Boundary

Prisma schema and migrations live in `packages/database/prisma`. Backend and worker code must use `@vcp/database` exports instead of importing Prisma files through relative paths.

Run Prisma from the root so npm delegates to the database workspace:

```bash
npm run prisma -- validate
npm run prisma -- migrate deploy
```

## OpenClaw Boundary

OpenClaw runtime operations must go through:

```text
apps/backend/src/shared/openclaw/runtime-adapter.ts
```

Feature modules should request runtime work through the workspace module or worker jobs rather than calling Docker/OpenClaw directly.

### Real Network Transport Boundary
Task & Orchestration utilizes an `OpenClawNetworkTransport` boundary (HTTP POST for lifecycle commands and Server-Sent Events for real-time stream subscription) to connect to externally resolved OpenClaw runtimes. Incoming raw provider events are processed through `OpenClawRawEventMapper` to parse DTOs, validate required fields, apply automated security redactions (`sanitizeObservabilityPayload`), and enforce duplicate/stale event protections without provisioning containers or managing secrets directly.

## Async Boundary

Use workers for slow or retryable tasks:

- OpenClaw provisioning
- payment callback reconciliation
- document ingestion/vectorization
- long-running task execution

HTTP requests should create state and enqueue work instead of waiting for slow external systems.
