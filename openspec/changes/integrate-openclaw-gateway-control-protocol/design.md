## Context

The current transport assumes `POST /v1/chat/completions` is the primary start/result stream and treats Gateway WebSocket progress as optional. Local runtime verification showed the Gateway on `http://127.0.0.1:18789` serves the OpenClaw Control UI, emits `connect.challenge`, requires Control protocol v4 request frames, and rejects backend probes that do not provide browser-like `Origin` and device identity data.

Task Orchestration remains a consumer of an externally supplied runtime reference. It must not provision OpenClaw, manage containers, or own Gateway credential creation. The integration can, however, maintain a backend-local client identity needed to authenticate a consumer-side WebSocket session.

## Goals / Non-Goals

**Goals:**
- Preserve the existing OpenAI-compatible HTTP/SSE transport path when the Gateway supports it.
- Add a Gateway Control protocol fallback for runtimes where HTTP start returns `404`.
- Use a server-side WebSocket client capable of setting `Origin` without adding a production dependency.
- Generate and reuse a backend-local Ed25519 device identity in memory for challenge signing.
- Start a chat run through `sessions.create` and `chat.send`, subscribe to session messages/progress, and convert Gateway events into the existing raw chunk mapper.
- Surface safe failures when the Gateway requires out-of-band device pairing or rejects authentication.

**Non-Goals:**
- No new public HTTP API routes.
- No shared contract, Prisma schema, or domain event changes.
- No OpenClaw container lifecycle, Gateway configuration, or device approval automation.
- No raw prompt, private key, token, or private reasoning exposure in logs or UI.

## Decisions

1. **Use Gateway Control protocol only as fallback.**
   - Decision: try OpenAI-compatible HTTP/SSE first; when the start request returns `404`, open the Control WebSocket path.
   - Rationale: this preserves the documented contract for runtimes that expose `/v1/chat/completions` and fixes the observed runtime without forcing a breaking transport switch.
   - Alternative considered: replace HTTP/SSE entirely with Control protocol. Rejected because existing specs and tests still support OpenAI-compatible runtimes.

2. **Implement a minimal server-side WebSocket client using Node built-ins.**
   - Decision: add a small backend-only WebSocket transport based on `node:net`, `node:tls`, and `node:crypto`.
   - Rationale: Node's built-in WebSocket does not reliably allow custom `Origin`, and adding `ws` would require a new production dependency.
   - Alternative considered: add `ws`. Rejected for this slice because AGENTS rules require explicit dependency approval and the needed subset is small.

3. **Use backend-local Ed25519 device identity.**
   - Decision: generate an in-memory Ed25519 keypair, derive the raw public key/device ID, and sign the Gateway challenge string used by Control UI protocol v4.
   - Rationale: the Gateway rejects control connections without device identity. The private key never leaves process memory.
   - Alternative considered: persist device identity. Deferred because this slice avoids secret storage ownership and Prisma/shared-contract changes.

4. **Project Gateway events through existing mapper.**
   - Decision: receive Control protocol events and reuse `mapGatewayFrameToChatChunk`/`OpenClawRawEventMapper`.
   - Rationale: UI rendering already consumes normalized runtime events from the previous change, so this keeps behavior provider-neutral and sanitized.

## Risks / Trade-offs

- **Gateway requires manual device pairing** -> The transport returns a safe `provider-authentication-rejected` or `execution-start-rejected` message instead of pretending progress is available. A future infrastructure-owned change can persist and pre-approve backend device identities.
- **In-memory identity changes on restart** -> Re-pairing may be required after backend restart. This avoids introducing secret storage in this task.
- **Minimal WebSocket client has narrower protocol support** -> It supports the Gateway text-frame request/response path used here, not arbitrary WebSocket extensions.
- **Control protocol is inferred from the shipped Control UI bundle** -> Tests cover the observed v4 frames. If Gateway protocol changes, the adapter should fail safely and continue to prefer the documented HTTP/SSE path when present.

## Migration Plan

1. Add specs and tests for fallback Control protocol execution.
2. Implement the backend-only WebSocket client and Control session driver inside the OpenClaw transport boundary.
3. Validate targeted Task Orchestration OpenClaw tests and OpenSpec checks.
4. If live Gateway returns pairing-required, document the exact safe error and keep UI progress ready for paired/approved runtimes.

Rollback is reverting this change; the previous OpenAI-compatible HTTP/SSE behavior remains isolated and unchanged.
