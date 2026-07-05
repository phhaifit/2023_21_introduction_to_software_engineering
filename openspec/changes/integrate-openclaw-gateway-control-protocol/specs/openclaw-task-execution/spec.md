## ADDED Requirements

### Requirement: Gateway Control Protocol Fallback Transport
The concrete OpenClaw network transport SHALL fall back to the Gateway Control WebSocket/session protocol when the configured runtime is reachable but does not expose the OpenAI-compatible `/v1/chat/completions` route. This fallback SHALL remain inside the consumer-side transport boundary and SHALL NOT provision, configure, or administer the OpenClaw runtime.

#### Scenario: Fall back after chat completions route is missing
- **WHEN** a real task execution start request receives HTTP `404` from `/v1/chat/completions`
- **THEN** the transport SHALL attempt the Gateway Control protocol start flow
- **AND** it SHALL keep the same task ID, conversation ID, prompt, routing instruction, and target labels
- **AND** it SHALL NOT silently switch to mock execution

#### Scenario: Control protocol remains consumer-side
- **WHEN** the fallback flow creates or subscribes to a Gateway session
- **THEN** Task & Orchestration SHALL treat the session as a provider execution reference
- **AND** it SHALL NOT manage OpenClaw containers, Gateway runtime configuration, or external module administration
