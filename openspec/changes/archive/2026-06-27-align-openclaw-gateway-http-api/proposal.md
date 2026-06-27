## Why

The OpenClaw Gateway HTTP API requires a specific set of parameters and headers to properly route execution requests, maintain conversation sessions, and select the underlying AI model. The current implementation in `OpenClawHttpSSETransport` sends the provider model name (`gemini-3.1-pro-preview`) directly in the `model` body parameter and omits session identifiers. According to the latest official OpenClaw specification, the `model` body field must be set to an OpenClaw agent target (e.g., `openclaw/default`), while the specific backend AI model must be passed via the `x-openclaw-model` header. Additionally, conversation session continuation requires passing `user` in the body and `x-openclaw-session-key` in the headers.

## What Changes

The `OpenClawHttpSSETransport` implementation will be updated to align with the official OpenClaw Gateway HTTP API specification:
1. Set `model: "openclaw/default"` in the JSON request body for `POST /v1/responses`.
2. Pass `x-openclaw-model: gemini-3.1-pro-preview` in the HTTP headers to specify the backend AI provider.
3. Pass `user: request.conversationId` in the JSON request body and `x-openclaw-session-key: request.conversationId` in the HTTP headers to enable proper session and memory continuity across turns.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `openclaw-task-execution`: Update the request schema and headers required by the OpenClaw Gateway HTTP API to ensure correct model routing and session preservation.

## Impact

- `OpenClawHttpSSETransport` in `apps/backend/src/features/task-execution/adapters/openclaw-network-transport.ts` will be updated to use the correct headers and body structure.
- Zero impact on existing unit tests or mock fetchers, as the changes apply exclusively to live gateway communication.
