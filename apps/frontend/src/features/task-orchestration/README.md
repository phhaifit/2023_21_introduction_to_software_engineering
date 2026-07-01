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
  -> generate frontend Task ID and Work ID
  -> POST /api/workspaces/demo_workspace_1/executions/start
  -> subscribe EventSource /api/workspaces/demo_workspace_1/executions/:taskId/stream
  -> reduce runtime events into CreatedTaskRecord snapshots
```

The provider returns a local `CreatedTaskRecord` immediately so the UI can subscribe to the event stream before backend events arrive.

## Providers

- `HttpTaskOrchestrationProvider`: default runtime provider for the local backend/OpenClaw Gateway path.
- `LocalTaskOrchestrationTestProvider`: deterministic in-browser provider used by tests or injected runtime dependencies.

## Routing Catalog

The default routing catalog client reads:

- `GET /api/workspaces/:workspaceId/agents`
- `GET /api/workspaces/:workspaceId/workflows`

The local test catalog still provides deterministic agent/workflow options for component tests.

## Important Current Gap

The UI does not currently call `POST /api/workspaces/:workspaceId/tasks`. It uses the execution API path directly. The backend `CreateTaskService` and Prisma `Task`/`TaskRun` schema are the foundation for a future persisted create-task path, but they are not the active UI submission path today.
