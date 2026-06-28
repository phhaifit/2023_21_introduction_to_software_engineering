## Context

The Task & Orchestration module uses `OpenClawTaskExecutionAdapter` and `OpenClawHttpSSETransport` to connect to an external OpenClaw Gateway runtime. Currently, the transport layer is burdened with legacy simulated custom execution endpoints (`/executions/start`, `/executions/{id}/cancel`, `/executions/{id}/snapshot`), intermediary raw DTO structures, hardcoded `model: "openclaw/default"` request bodies, and console logs displaying unredacted user prompts and stream chunks. This design aligns the adapter completely with the official OpenClaw Gateway OpenAI-compatible HTTP API specification.

## Goals / Non-Goals

**Goals:**
- Transition `OpenClawHttpSSETransport` to rely 100% on the OpenAI-compatible HTTP API (`POST /v1/chat/completions`).
- Refactor `OpenClawRawEventMapper` to parse `chat.completion.chunk` directly into `NormalizedRuntimeEvent`, removing intermediary raw DTO wrappers.
- Dynamically inject `model: request.target || "openclaw/default"` in the HTTP request body to enable Specific Agent and Predefined Workflow routing.
- Rely exclusively on `AbortController.abort()` to terminate active HTTP/SSE streams for task cancellation, eliminating outgoing HTTP cancellation requests.
- Remove console logging of raw prompts and delta chunks in the transport layer to uphold strict security and data privacy.

**Non-Goals:**
- No changes to the 10-step execution start flow or `OpenClawExecutionOrchestrator` lifecycle logic.
- No changes to the public REST APIs of Task & Orchestration (`/api/workspaces/:workspaceId/tasks/*`).
- No changes to the external runtime provisioning mechanics in Workspace Management.

## Decisions

- **Pure OpenAI-Compatible HTTP Transport**: Eliminate all fallback fetch attempts to `/executions/*`. The transport will invoke `POST /v1/chat/completions` with `stream: true`, `x-openclaw-model: gemini-3.1-flash-lite`, `x-openclaw-session-key: <conversationId>`, `user: <conversationId>`, and `model: request.target || "openclaw/default"`.
- **Direct Event Mapping**: Rather than converting `chat.completion.chunk` into a fake `OpenClawRawEvent` with `eventType: "partial_output"`, `OpenClawRawEventMapper` will take the raw OpenAI chunk directly, extract `choice.delta.content` or `finish_reason`, and construct `NormalizedRuntimeEvent` objects.
- **Local Abort Cancellation**: Task cancellation will simply call `.abort()` on the active `AbortController` associated with the execution stream, immediately halting the HTTP stream without making a redundant and unsupported cancellation HTTP call to the gateway.
- **Privacy Enforcement**: Remove raw `prompt` and `delta chunk` console logs from `openclaw-network-transport.ts`.

## Risks / Trade-offs

- **Testing Verification**: The unit tests in `openclaw-network-transport.test.ts` must be updated to simulate direct `chat.completion.chunk` payloads instead of the legacy custom DTO objects.
