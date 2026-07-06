## 1. Gateway Control Protocol Transport

- [x] 1.1 Add a backend-only Gateway WebSocket client that supports `Origin`, text request/response frames, close handling, and request correlation without adding a production dependency.
- [x] 1.2 Add backend-local Ed25519 device identity generation and `connect.challenge` signing for Control protocol v4.
- [x] 1.3 Add Control protocol execution start flow: `connect`, `sessions.create`, `sessions.subscribe`, `sessions.messages.subscribe`, and `chat.send`.

## 2. Integration and Projection

- [x] 2.1 Fall back to Control protocol when `/v1/chat/completions` returns `404`, while preserving the HTTP/SSE path on success.
- [x] 2.2 Convert Control protocol session/chat events into existing raw chunks and terminal completion/error events for subscribers.
- [x] 2.3 Keep cancellation and cleanup local by closing active Control protocol sockets and removing execution context.

## 3. Verification

- [x] 3.1 Add focused backend adapter tests for successful Control fallback, device-auth rejection, session event projection, and cancellation cleanup.
- [x] 3.2 Run targeted OpenClaw transport tests and OpenSpec validation; report any live Gateway pairing/auth gap separately.
