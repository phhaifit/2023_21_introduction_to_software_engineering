## 1. Implement Non-Blocking Execution Start & SSE Lifecycle Synchronization

- [x] 1.1 Update `HttpTaskOrchestrationProvider.createTask` in `apps/frontend/src/features/task-orchestration/model/task-orchestration-provider.ts` to execute the execution start HTTP request asynchronously using `setTimeout`, removing `await`.
- [x] 1.2 Update `HttpTaskOrchestrationProvider.subscribeToTaskEvents` in `apps/frontend/src/features/task-orchestration/model/task-orchestration-provider.ts` to implement event-driven state bootstrapping (moving tasks from `queued` to `running`) and sequential step/streaming alignment to fulfill `isTaskReadyForCompletion` invariants.

## 2. Verification

- [x] 2.1 Run test suite verification (`npm test` and `openspec validate "fix-http-provider-sse-lifecycle-sync" --strict`).
