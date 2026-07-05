## Why

OpenClaw chat execution currently reaches the React UI mostly as final or partial assistant text, so users cannot reliably see provider activity such as web search, tool calls, document reads, shell/API calls, or reasoning progress while an agent is working. This makes real OpenClaw execution feel opaque even when the Gateway emits useful progress metadata.

## What Changes

- Extend the Task & Orchestration OpenClaw transport mapper to project more OpenAI-compatible and Gateway side-channel progress shapes into normalized runtime activity events.
- Preserve provider-neutral UI behavior by rendering provider progress from `TaskRuntimeEvent` and `TaskRecord` state only.
- Improve chat streaming visibility for HTTP/OpenClaw tasks so partial output appears whenever provider text chunks arrive, not only during mock pipeline step IDs.
- Add focused automated coverage for backend event mapping and frontend activity projection.

## Capabilities

### New Capabilities

- `openclaw-progress-chat`: Covers projection of OpenClaw provider progress into chat-visible runtime activity and partial output.

### Modified Capabilities

- `openclaw-execution-observability`: Clarifies that supplied provider activity must be projected into chat progress when safe.
- `task-workspace`: Clarifies that provider-originated streaming text is visible for HTTP/OpenClaw runtime tasks without relying on mock-only step identifiers.

## Impact

- Backend: `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts`
- Frontend: `apps/frontend/src/features/task-orchestration/model/task-orchestration-provider.ts`, `apps/frontend/src/features/task-orchestration/components/task-conversation.tsx`
- Tests: targeted backend adapter and frontend component/provider tests
- Shared contracts: no public contract change expected
- Prisma/database: no schema or migration impact
- Dependencies: no new production dependency
