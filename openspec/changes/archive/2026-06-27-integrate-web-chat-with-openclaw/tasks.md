## 1. Backend API Routing

- [x] 1.1 Create Task Orchestration Express API router (`apps/backend/src/modules/task-orchestration/api/task-orchestration-router.ts`)
- [x] 1.2 Implement endpoint `POST /api/workspaces/:workspaceId/executions/start` invoking `execute10StepStartFlow`
- [x] 1.3 Implement endpoint `POST /api/workspaces/:workspaceId/executions/:taskId/cancel` invoking `forwardCancellation`
- [x] 1.4 Implement endpoint `GET /api/workspaces/:workspaceId/executions/:taskId/state` invoking `getExposedState`

## 2. Backend Server Registration

- [x] 2.1 Instantiate `OpenClawHttpSSETransport` pointing to `http://127.0.0.1:18789` in `local-agent-management-server.ts`
- [x] 2.2 Inject transport into `OpenClawTaskExecutionAdapter` and initialize `OpenClawExecutionOrchestrator`
- [x] 2.3 Mount the Task Orchestration Express API router into the Express application

## 3. Frontend Chat Integration

- [x] 3.1 Update Web UI chat service/hook to communicate with `POST /api/workspaces/:workspaceId/executions/start` and handle Server-Sent Events (SSE) stream

## 4. Verification

- [x] 4.1 Verify end-to-end integration and run validation commands (`npm test`, `openspec validate`)
