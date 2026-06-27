## Why

The Task & Orchestration module currently possesses a fully verified core execution adapter (`OpenClawTaskExecutionAdapter`), HTTP/SSE network transport (`OpenClawHttpSSETransport`), and orchestrator (`OpenClawExecutionOrchestrator`). However, the local development backend server (`local-agent-management-server.ts`) does not yet expose an Express API Router for Task Orchestration, leaving the Web UI chat without a real endpoint to communicate with the physical OpenClaw Docker runtime (listening on port 18789). This change bridges the final gap by wiring up the Express router, registering the network transport in the backend server, and enabling end-to-end web chat interactions.

## What Changes

- Create a dedicated Express API router for Task Orchestration (`task-orchestration-router.ts`) providing standard REST endpoints (`POST /api/workspaces/:workspaceId/executions/start`, `POST /api/workspaces/:workspaceId/executions/:taskId/cancel`, and `GET /api/workspaces/:workspaceId/executions/:taskId/state`).
- Register `OpenClawHttpSSETransport` configured to communicate with `http://127.0.0.1:18789` in `local-agent-management-server.ts`.
- Initialize `OpenClawExecutionOrchestrator` within `createLocalAgentManagementRuntime()` and mount the new Task Orchestration router.
- Preserve all existing architectural boundaries, ensuring Task & Orchestration continues to act strictly as an observability projection consumer and does not provision or administer OpenClaw infrastructure directly.

## Capabilities

### New Capabilities

- `task-orchestration-http-api`: Establishes the Express API router contracts and endpoints for initiating, cancelling, and observing task executions via HTTP and Server-Sent Events (SSE).

### Modified Capabilities

- `openclaw-task-execution`: Updates the runtime wiring requirements to mandate registering the concrete `OpenClawHttpSSETransport` and `OpenClawExecutionOrchestrator` within the local backend server.

## Impact

- **Backend API**: Adds `/api/workspaces/:workspaceId/executions/*` routes to `local-agent-management-server.ts`.
- **Frontend Chat**: Connects the existing React Web UI to real backend endpoints for task execution.
- **System Architecture**: Bridges the local web server directly with the physical OpenClaw Docker container without breaking responsibility boundaries.
