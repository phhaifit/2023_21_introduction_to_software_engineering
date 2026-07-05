## Why

The live OpenClaw Gateway runtime currently serves the Control UI and WebSocket session protocol on port `18789`, while `POST /v1/chat/completions` returns `404` in local verification. Task Orchestration therefore needs a consumer-side control-protocol transport path so the backend can start a Gateway chat run and subscribe to provider progress events that the UI already knows how to render.

## What Changes

- Add a Gateway Control protocol execution path to `OpenClawHttpSSETransport` for runtimes that do not expose the OpenAI-compatible HTTP streaming endpoint.
- Implement a backend-owned Gateway WebSocket client that can send the required `Origin` header, perform the challenge/response `connect` request, call `sessions.create`, `sessions.subscribe`, `sessions.messages.subscribe`, and `chat.send`, and project received Gateway events through the existing raw mapper.
- Preserve the existing OpenAI-compatible HTTP/SSE path when it is available.
- Keep Gateway progress projection provider-neutral and sanitized; do not expose raw device credentials, tokens, prompts, private reasoning, or filesystem paths.
- Avoid new public API routes, shared contracts, Prisma schema changes, container management, or OpenClaw provisioning.

## Capabilities

### New Capabilities
- `openclaw-gateway-control-protocol`: Covers the consumer-side Gateway Control WebSocket/session protocol used to start chat runs and receive live task progress from an already-running OpenClaw Gateway.

### Modified Capabilities
- `openclaw-task-execution`: Allow the concrete transport to use the Gateway Control protocol when the OpenAI-compatible HTTP endpoint is unavailable, while preserving the existing HTTP/SSE path.
- `openclaw-execution-observability`: Clarify that Control protocol session events are a valid provider observability source when scoped to the active task conversation.

## Impact

- Affected code: `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts` and focused adapter tests.
- Affected docs/specs: new OpenSpec change artifacts only.
- Dependencies: no production dependency will be added; the transport will use Node built-ins for the server-side WebSocket fallback.
- Systems: OpenClaw Gateway local runtime at `http://127.0.0.1:18789`; no Docker/container lifecycle ownership changes.
