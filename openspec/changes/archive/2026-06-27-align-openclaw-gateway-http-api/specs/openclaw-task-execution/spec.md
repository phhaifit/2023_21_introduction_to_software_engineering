## ADDED Requirements

### Requirement: OpenClaw Gateway HTTP API Payload and Header Alignment

The `OpenClawNetworkTransport` implementation SHALL structure its HTTP request payload and headers to align with the official OpenClaw Gateway HTTP API specification when communicating with a live gateway runtime. Specifically, the request body SHALL set `model` to an OpenClaw agent target (`openclaw/default`) and pass `user` to represent the conversation session. The request headers SHALL include `x-openclaw-model` to define the underlying AI provider model and `x-openclaw-session-key` to ensure session continuity.

#### Scenario: Submitting execution start request to live OpenClaw gateway
- **WHEN** `OpenClawHttpSSETransport.startExecution` sends a `POST` request to `/v1/chat/completions` on a live OpenClaw gateway endpoint
- **THEN** the request body SHALL contain `model: "openclaw/default"`, `stream: true`, `messages` array, and `user: request.conversationId`
- **AND** the HTTP headers SHALL include `x-openclaw-model: gemini-3.1-pro-preview`, `x-openclaw-session-key: request.conversationId`, and `Authorization: Bearer <credentialReference>`
