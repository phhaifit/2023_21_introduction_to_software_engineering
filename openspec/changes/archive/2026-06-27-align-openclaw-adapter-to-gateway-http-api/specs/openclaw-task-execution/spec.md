## ADDED Requirements

### Requirement: Pure OpenAI-Compatible HTTP Network Transport
The `OpenClawNetworkTransport` implementation (`OpenClawHttpSSETransport`) SHALL connect to the OpenClaw Gateway runtime exclusively using the OpenAI-compatible HTTP API (`POST /v1/chat/completions`). It SHALL dynamically assign `model: request.target || "openclaw/default"` in the request body to support Specific Agent and Predefined Workflow routing. It SHALL rely exclusively on `AbortController.abort()` to cancel active execution streams without issuing outgoing cancellation HTTP requests. It SHALL NOT log unredacted prompts or delta stream chunks to the terminal.

#### Scenario: Dispatch network requests using pure OpenAI-compatible HTTP API
* **GIVEN** `OpenClawHttpSSETransport` is configured as the physical transport layer
* **WHEN** runtime operations (start or stream subscription) are initiated
* **THEN** the transport SHALL dispatch physical network requests exclusively to `POST /v1/chat/completions` with `stream: true`, `x-openclaw-model`, `x-openclaw-session-key`, and `model: request.target || "openclaw/default"`
* **AND** it SHALL NOT issue requests to fictitious `/executions/*` endpoints
* **AND** it SHALL NOT log unredacted user prompts or delta chunks to the terminal

#### Scenario: Terminate execution streams via AbortController
* **GIVEN** an active SSE execution stream is running in `OpenClawHttpSSETransport`
* **WHEN** a cancellation request is forwarded
* **THEN** the transport SHALL call `.abort()` on the active `AbortController`
* **AND** it SHALL NOT issue an outgoing HTTP POST cancellation request to the gateway
