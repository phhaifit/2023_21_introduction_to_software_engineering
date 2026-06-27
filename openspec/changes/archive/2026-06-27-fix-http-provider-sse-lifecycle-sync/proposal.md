## Why

When tasks are created via `HttpTaskOrchestrationProvider`, a race condition occurs where the execution start request is awaited synchronously before the client establishes its Server-Sent Events (SSE) subscription. Consequently, initial lifecycle events such as `execution-accepted` and `execution-started` are missed, leaving the frontend task state permanently stuck in `queued` (Pending) and preventing subsequent streaming and completion events from being processed due to strict state invariants. This change resolves the race condition and aligns incoming OpenClaw SSE events with the frontend's strict processing lifecycle model.

## What Changes

- Decouple the execution start HTTP request in `HttpTaskOrchestrationProvider.createTask` from the task return lifecycle by wrapping it in an asynchronous delay (`setTimeout`), ensuring the `EventSource` subscription connects before backend execution events are broadcast.
- Implement automated state bootstrapping in the SSE message handler: if an event arrives while the task is still in `queued` status, automatically dispatch `processing-started` to advance the task to `running`.
- Align incoming OpenClaw step events with the canonical frontend processing sequence (`validate-input`, `analyze-request`, `select-routing`, `execute-task`, `aggregate-result`, `finalize`) to fulfill the strict invariants of `isTaskReadyForCompletion`.
- Ensure `execution-completed` events correctly trigger `streaming-exhausted`, transition the final step (`finalize`), and provide the required `finalizedAt` timestamp to successfully complete the task in local state.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-orchestration-provider`: update `HttpTaskOrchestrationProvider` runtime event subscription and initialization behavior to prevent race conditions and enforce strict frontend lifecycle synchronization.

## Impact

- **Frontend Task Orchestration Provider**: `apps/frontend/src/features/task-orchestration/model/task-orchestration-provider.ts` will be updated to handle the asynchronous start delay and robust SSE lifecycle synchronization.
- **Test Suites**: Existing tests will remain fully passing, as they verify both local mock and HTTP provider behaviors.
