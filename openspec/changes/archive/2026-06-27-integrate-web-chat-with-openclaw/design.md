## Context

The Task & Orchestration module provides the foundational engine for routing and tracking task executions in virtual workspaces. While the domain logic, `OpenClawTaskExecutionAdapter`, `OpenClawHttpSSETransport`, and `OpenClawExecutionOrchestrator` are fully established and robustly tested, the local Express server (`local-agent-management-server.ts`) does not currently expose REST API endpoints for Task Orchestration. Consequently, the React web UI chat cannot establish a real connection to the running OpenClaw Docker container on port 18789.

## Goals / Non-Goals

**Goals:**
- Design an Express router (`apps/backend/src/modules/task-orchestration/api/task-orchestration-router.ts`) to handle execution initiation (`POST /start`), cancellation (`POST /cancel`), and status monitoring (`GET /state`).
- Register `OpenClawHttpSSETransport` and `OpenClawExecutionOrchestrator` within `local-agent-management-server.ts`.
- Ensure the network transport correctly establishes HTTP POST requests and Server-Sent Events (SSE) subscriptions to `http://127.0.0.1:18789`.

**Non-Goals:**
- Exclude any direct administration, container lifecycle provisioning, or raw secret management of the OpenClaw runtime from Task & Orchestration.
- Exclude modifications to external modules (Agent Management, Workflow Management, Authentication, Subscription).

## Decisions

- **Express Router Architecture**: Implement `createTaskOrchestrationRouter` adhering to existing Express conventions in the repository. It will accept `StartExecutionCommand` payloads, invoke `execute10StepStartFlow`, and expose Server-Sent Events (SSE) streaming headers for real-time chat updates.
- **Dependency Injection in Server**: Instantiate `OpenClawHttpSSETransport` pointing to `http://127.0.0.1:18789`, inject it into `OpenClawTaskExecutionAdapter`, and provide it to `OpenClawExecutionOrchestrator` within `createLocalAgentManagementRuntime()`.
- **RBAC & Scoping Validation**: Ensure all requests derive principal authorization from `req.context` and validate workspace scoping to enforce strict multi-tenant security boundaries.

## Risks / Trade-offs

- **Risk: OpenClaw Docker Container Offline** → Mitigation: `OpenClawHttpSSETransport` implements comprehensive error catch blocks, returning normalized `execution-runtime-unavailable` failures rather than crashing the backend server.
- **Risk: SSE Stream Disconnections** → Mitigation: The adapter implements snapshot reconciliation, duplicate event protection, and stale event filtering to preserve canonical state consistency.
