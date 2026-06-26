## Why

The current Task & Orchestration UI is tightly coupled to the in-browser mock execution runtime. Every processing event, streaming chunk, and lifecycle transition is generated and applied entirely within the frontend. This coupling makes it impossible to swap in a real Python orchestration backend without rewriting UI logic, and it prevents the mock and HTTP paths from being validated against a shared behavioral contract. Defining a unified provider boundary now unblocks both `add-python-task-orchestration-service` and `enable-ai-assisted-task-routing` without forcing any UI change.

## What Changes

- Define a `TaskOrchestrationClient` contract interface covering `createTask`, `getTask`, `cancelTask`, `subscribeToTaskEvents`, and `unsubscribeFromTaskEvents`.
- Define a canonical `TaskRuntimeEvent` discriminated union covering all required runtime event kinds: `task-accepted`, `task-started`, `routing-resolved`, `step-started`, `step-completed`, `partial-output`, `task-completed`, `task-failed`, and `task-canceled`.
- Define a `ProviderConfig` discriminated union selecting between `mock` and `http` providers via configuration.
- Define a `MockTaskOrchestrationProvider` adapter that wraps the existing in-browser mock orchestration service and exposes it through the `TaskOrchestrationClient` contract.
- Define an `HttpTaskOrchestrationProvider` boundary (interface and configuration only) describing how the frontend will connect to an HTTP backend; no real HTTP implementation is included in this change.
- Specify mapping rules from `TaskRuntimeEvent` kinds to canonical `TaskStatus` transitions (Pending → In-Progress, In-Progress → Completed/Failed/Canceled).
- Specify provider-independent UI behavior: the workspace MUST NOT branch on provider type; all status badge rendering, streaming display, timeline update, and cancellation must operate from `TaskRuntimeEvent` alone.
- Preserve existing mock behavior: all current functional acceptance criteria for task submission, routing, lifecycle, streaming, failure, and cancellation remain satisfied through the mock provider adapter.

## Capabilities

### New Capabilities

- `task-orchestration-provider`: Covers the `TaskOrchestrationClient` contract, `TaskRuntimeEvent` discriminated union, `ProviderConfig` selection, `MockTaskOrchestrationProvider` adapter specification, `HttpTaskOrchestrationProvider` boundary specification, and the mapping from runtime events to canonical task status.

### Modified Capabilities

- `task-orchestration`: The UI behavior constraint is strengthened: the workspace MUST NOT branch on provider identity, and runtime ownership MUST remain anchored to immutable Task ID rather than conversation selection.

## Impact

- **Frontend — Task Orchestration feature**: The `TaskOrchestrationClient` interface becomes the single integration point between UI and runtime. The existing mock service is refactored behind a `MockTaskOrchestrationProvider` adapter without changing its external behavior.
- **Shared contracts**: No changes to `@vcp/shared`. `TaskStatus` mapping from provider events follows the already-established production-to-presentation translation boundary.
- **Future changes**: `add-python-task-orchestration-service` depends on the `HttpTaskOrchestrationProvider` boundary and `TaskRuntimeEvent` schema defined here. `enable-ai-assisted-task-routing` depends on the routing payload structure established in this contract.
- **No production dependency additions**: All new code is interface/type declarations and adapter wrappers over existing behavior.
