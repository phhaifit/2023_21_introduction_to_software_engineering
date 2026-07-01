## Why

OpenClaw executions currently expose canonical lifecycle and final answer state, but detailed runtime progress is incomplete: Gateway progress frames are mapped only for a few broad labels, frontend live/replay handling is not fully aligned, and the UI may fall back to generic or inferred wording. Users need production-safe progress that reflects provider-supplied activity such as web search, tool calls, document/file reading, browser activity, shell execution, API calls, and agent messages without inventing fixed steps or exposing raw logs.

## What Changes

- Extend the normalized runtime observability contract so provider activity can carry a stable `activityKind`, safe display metadata, and provider event references.
- Map OpenClaw Gateway WebSocket side-channel frames into richer normalized activity events based on provider event names and safe payload fields.
- Keep HTTP/SSE result streaming as the canonical execution path and treat Gateway progress frames as optional observability.
- Align frontend live and replay projection so refresh, route changes, and active SSE updates render the same processing activity timeline.
- Replace UI keyword inference with normalized event rendering, while keeping a conservative fallback for legacy events.
- Preserve automated redaction and avoid raw prompts, raw logs, credentials, absolute paths, or provider payload dumps.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openclaw-execution-observability`: require richer projection-only activity kinds for provider-supplied Gateway progress.
- `openclaw-task-execution`: require OpenClaw Gateway side-channel mapping for search, read, browser, shell, API, tool, agent, and message activity.
- `task-orchestration-provider`: require frontend live and replay activity projection parity.
- `task-execution-streaming`: require processing activity display to remain synchronized with lifecycle and partial output.
- `shared-contracts`: extend shared runtime event metadata because backend, frontend, and tests consume the same public normalized event contract.

## Impact

- Affected code:
  - `packages/shared/src/contracts/task-execution.ts`
  - `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts`
  - focused backend transport tests
  - `apps/frontend/src/features/task-orchestration/model/*`
  - `apps/frontend/src/features/task-orchestration/components/*`
  - focused frontend/provider tests
- Shared boundary impact: Yes. The existing `SubActivityEvent.activityType` union cannot represent search, reading, browser, shell, or API progress without lossy labels or UI inference.
- API route impact: No new HTTP route; existing execution state and SSE stream carry the enriched event payload.
- Database/Prisma impact: None.
- New production dependency: None.
