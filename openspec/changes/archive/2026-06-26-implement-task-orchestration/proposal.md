## Why

The existing OpenSpec change describes the Task & Orchestration module at a planning level but does not yet define enough implementation detail for a stable, demonstrable, and testable PA5 prototype. This implementation establishes an interactive chatbot-style task workspace aligned with the PA4 prototype to demonstrate the complete user-facing task lifecycle from task submission through routing, processing, result delivery, cancellation, and failure using deterministic mock data and simulated orchestration without depending on external services.

## What Changes

- Implement an interactive chatbot-style task workspace layout with a recent-session/task-history sidebar area, workspace header, conversation area, and new task composer.
- Add prompt validation rejecting empty or whitespace-only submissions.
- Support Auto-routing, Specific Agent (from mock registry), and Predefined Workflow (from mock registry) routing modes.
- Generate a unique Task ID and Work ID for every accepted task.
- Display consistent task lifecycle states: Pending, In-Progress, Completed, Failed, and Canceled.
- Simulate the orchestration pipeline using deterministic local data, displaying processing steps, timeline events, execution logs, and simulated partial/streamed task output.
- Support controlled cancellation for Pending and In-Progress tasks, stopping active timers and streaming.
- Support deterministic failure via `FAIL_SIMULATION:` trigger, displaying explicit error information and preventing terminal tasks from continuing processing or transitioning to Completed.
- Provide clear empty, loading, active, completed, canceled, and failed UI states.
- Establish the Task & Orchestration Module Foundation defining aggregate ownership, tenant/submitter identity from authenticated request context, authoritative routing invariants, and separation of public shared contracts (`@vcp/shared`) from private domain/persistence types.

## Capabilities

### New Capabilities
- `task-orchestration`: Covers the interactive chatbot-style task workspace, task identity generation, routing mode selection, mock orchestration pipeline, lifecycle state machine, simulated result streaming, controlled cancellation, deterministic failure handling, and production module foundation boundaries.

### Modified Capabilities

## Impact

- **Frontend Workspace & Layout**: Introduces the Task & Orchestration route shell, task composer, routing selector, status badges, timeline view, log list, streaming/completed result views, processing detail modal, and cancellation dialog.
- **State Management & Mock Services**: Introduces module-local domain types, deterministic seed data (4 mock agents, 2 mock workflows, demo prompts), centralized timings, and a mock orchestration service/controller.
- **Shared Boundary & Architecture**: References `EntityId` types and `TaskStatus` from `@vcp/shared`, defining public API DTO contracts (`POST /api/workspaces/:workspaceId/tasks`), unversioned vs proposed version 1 domain events, and Prisma persistence mapping (`TaskRun` to `TaskWork`) for future backend integration without exposing Prisma internals to frontend or public contracts.
