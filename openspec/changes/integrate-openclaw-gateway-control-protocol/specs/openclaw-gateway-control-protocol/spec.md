## ADDED Requirements

### Requirement: Gateway Control Protocol Execution Fallback
When an OpenClaw runtime does not expose the OpenAI-compatible chat completion endpoint, the transport SHALL use the Gateway Control WebSocket/session protocol to start and observe the task run.

#### Scenario: Start execution through control protocol after HTTP endpoint is unavailable
- **WHEN** `OpenClawHttpSSETransport.startExecution` receives `404` from `POST /v1/chat/completions`
- **THEN** it SHALL connect to the Gateway WebSocket endpoint with a valid `Origin`
- **AND** it SHALL perform `connect`, `sessions.create`, session subscription, and `chat.send` request frames
- **AND** it SHALL return a provider execution reference for the started Control protocol run

#### Scenario: Preserve HTTP path when available
- **WHEN** `POST /v1/chat/completions` succeeds
- **THEN** the transport SHALL keep using the existing HTTP/SSE response body as the result stream
- **AND** it SHALL NOT start a duplicate Control protocol chat run

### Requirement: Gateway Control Device Identity
The Gateway Control protocol client SHALL provide a backend-local device identity for `connect.challenge` signing and SHALL keep private key material out of provider events, logs, and public contracts.

#### Scenario: Sign Gateway connect challenge
- **WHEN** the Gateway emits `connect.challenge`
- **THEN** the transport SHALL sign the Control protocol v4 connect payload with an Ed25519 device identity
- **AND** the `connect` request SHALL include device ID, public key, signature, signed timestamp, and nonce

#### Scenario: Report pairing or authentication rejection safely
- **WHEN** the Gateway rejects the device, token, scope, or pairing state
- **THEN** the transport SHALL return a normalized safe error
- **AND** the error SHALL NOT expose private keys, raw tokens, or unredacted Gateway payloads

### Requirement: Gateway Control Event Projection
Gateway Control protocol events SHALL be scoped to the active session and projected through the existing normalized runtime event path.

#### Scenario: Project session progress events
- **WHEN** the connected Gateway emits session operation, tool, message, chat, side-result, or reasoning events for the active session
- **THEN** the transport SHALL map them into OpenAI-compatible raw chunks
- **AND** the existing raw event mapper SHALL project them as provider-neutral normalized runtime events

#### Scenario: Ignore unrelated session events
- **WHEN** the Gateway emits a session event for a different session key
- **THEN** the transport SHALL ignore the event
- **AND** it SHALL NOT leak progress into the active task
