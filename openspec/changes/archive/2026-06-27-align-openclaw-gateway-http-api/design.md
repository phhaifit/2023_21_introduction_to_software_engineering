## Context

The Task & Orchestration module communicates with the OpenClaw Gateway runtime via `OpenClawHttpSSETransport` to execute tasks and receive Server-Sent Events (SSE) progress updates. The latest OpenClaw Gateway HTTP API specification introduces strict guidelines for model targeting and session management. Specifically, it distinguishes between the gateway agent target (placed in the JSON body `model` property) and the actual AI backend provider model (placed in the `x-openclaw-model` HTTP header). It also requires explicit session keys (`user` in body, `x-openclaw-session-key` in headers) to preserve conversation context.

## Goals / Non-Goals

**Goals:**
- Align `OpenClawHttpSSETransport.startExecution` with the official OpenClaw Gateway HTTP API payload and header specification.
- Set `model: "openclaw/default"` in the JSON request body.
- Pass `x-openclaw-model: gemini-3.1-pro-preview` in the HTTP headers.
- Pass `user: request.conversationId` in the JSON request body and `x-openclaw-session-key: request.conversationId` in the HTTP headers.
- Maintain full observability logging and existing error handling.

**Non-Goals:**
- Do not modify mock transport behavior or unit test execution paths.
- Do not modify external gateway container configuration or infrastructure provisioning.

## Decisions

- **Header and Body Realignment:** Modify the `fetcher` call in `OpenClawHttpSSETransport.startExecution` for live gateway connections to include the new `x-openclaw-model` and `x-openclaw-session-key` headers, and update the JSON body structure accordingly.
- **Graceful Fallbacks:** If `request.conversationId` is missing, default to `"default-session"` to ensure the gateway still maintains a stable session state.

## Risks / Trade-offs

- **Compatibility:** This change is strictly tailored to the live OpenClaw Gateway HTTP API runtime. Since unit tests rely on mock endpoints or custom fetchers, zero test regressions will occur.
