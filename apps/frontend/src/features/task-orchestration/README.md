# Task & Orchestration Feature

Owner: Member 8

## Current Frontend Scope

- Prompt/task submission.
- Agent/workflow routing controls.
- Conversation sidebar and task-turn navigation.
- Task run status, processing timeline, logs, partial output, failure, cancellation, and final result display.
- Final result display.

## Current Runtime Flow

The default UI provider is `HttpTaskOrchestrationProvider`.

Current submit flow:

```text
TaskOrchestrationPage
  -> HttpTaskOrchestrationProvider.createTask
  -> POST /api/workspaces/workspace-product-demo/tasks
  -> receive backend Task ID and Work ID
  -> POST /api/workspaces/workspace-product-demo/executions/start
  -> subscribe EventSource /api/workspaces/workspace-product-demo/executions/:taskId/stream
  -> reduce runtime events into CreatedTaskRecord snapshots
```

The provider waits for `/tasks` so the backend owns Task/Work identity, then returns a local `CreatedTaskRecord` immediately after scheduling `/executions/start` asynchronously. That keeps the UI able to subscribe to the event stream before execution lifecycle events arrive.

## Providers

- `HttpTaskOrchestrationProvider`: default runtime provider for the local backend/OpenClaw Gateway path.
- `LocalTaskOrchestrationTestProvider`: deterministic in-browser provider used by tests or injected runtime dependencies.

## Routing Catalog

The default routing catalog client reads:

- `GET /api/workspaces/:workspaceId/agents`
- `GET /api/workspaces/:workspaceId/workflows`

The local test catalog still provides deterministic agent/workflow options for component tests.

## Persistence Boundary

`POST /api/workspaces/:workspaceId/tasks` uses the backend `CreateTaskService` and Task/TaskRun repository implementations to create the task intent and first work attempt. `/executions/*` still owns live OpenClaw execution state and SSE event projection in memory.
