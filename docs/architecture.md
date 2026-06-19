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

## Module Boundaries

Each capability owns one backend module and one frontend feature folder:

| Capability | Backend | Frontend |
| --- | --- | --- |
| Authentication | `backend/src/modules/authentication` | `frontend/src/features/authentication` |
| Subscription & Payment | `backend/src/modules/subscription-payment` | `frontend/src/features/subscription-payment` |
| Workspace Management | `backend/src/modules/workspace-management` | `frontend/src/features/workspace-management` |
| Workspace User Management | `backend/src/modules/workspace-user-management` | `frontend/src/features/workspace-user-management` |
| Agent Management | `backend/src/modules/agent-management` | `frontend/src/features/agent-management` |
| Tools & Integration | `backend/src/modules/tools-integration` | `frontend/src/features/tools-integration` |
| Workflow Management | `backend/src/modules/workflow-management` | `frontend/src/features/workflow-management` |
| Task & Orchestration | `backend/src/modules/task-orchestration` | `frontend/src/features/task-orchestration` |
| Knowledge Base / RAG | `backend/src/modules/knowledge-base-rag` | `frontend/src/features/knowledge-base-rag` |

## Dependency Rule

Capability modules may depend on:

- `shared/contracts`
- `backend/src/shared/*`
- their own module files

Capability modules must not depend on another module's private repositories, services, or UI internals.

## Shared Contracts

Shared contracts are defined in `shared/contracts`.

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

## OpenClaw Boundary

OpenClaw runtime operations must go through:

```text
backend/src/shared/openclaw/runtime-adapter.ts
```

Feature modules should request runtime work through the workspace module or worker jobs rather than calling Docker/OpenClaw directly.

## Async Boundary

Use workers for slow or retryable tasks:

- OpenClaw provisioning
- payment callback reconciliation
- document ingestion/vectorization
- long-running task execution

HTTP requests should create state and enqueue work instead of waiting for slow external systems.
