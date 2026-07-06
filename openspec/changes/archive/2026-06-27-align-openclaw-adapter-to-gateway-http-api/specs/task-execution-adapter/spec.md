## ADDED Requirements

### Requirement: OpenClaw OpenAI-Compatible DTO Contracts
The system SHALL define internal data transfer object schemas representing the raw payloads expected from the OpenClaw Gateway OpenAI-compatible HTTP API, including `chat.completion.chunk` SSE stream responses. It SHALL eliminate legacy custom execution webhook DTO definitions (`OpenClawStartRequestDTO`, `OpenClawCancelRequestDTO`, `OpenClawRawProgressEvent`).

#### Scenario: Structure OpenAI-compatible provider responses
* **GIVEN** the network transport communicates with an OpenClaw Gateway runtime
* **WHEN** data is deserialized from the SSE stream
* **THEN** it SHALL conform to defined internal OpenAI-compatible chunk schemas (`chat.completion.chunk`)
* **AND** it SHALL provide structured representations for execution lifecycle milestones without requiring intermediary legacy DTO wrappers
