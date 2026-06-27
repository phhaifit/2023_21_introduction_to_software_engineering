## ADDED Requirements

### Requirement: End-to-End Architectural Communication Alignment
The `OpenClawTaskExecutionAdapter` and `OpenClawHttpSSETransport` SHALL formally establish an end-to-end communication contract where incoming execution start commands are mapped directly to the OpenClaw Gateway OpenAI-compatible HTTP API (`POST /v1/chat/completions`). The transport layer SHALL directly process incoming `chat.completion.chunk` Server-Sent Events without intermediary custom DTO translation.

#### Scenario: Enforce end-to-end communication alignment
* **GIVEN** `OpenClawTaskExecutionAdapter` is invoked to manage task execution
* **WHEN** execution commands and subsequent SSE streams are handled
* **THEN** the system SHALL interact exclusively with `POST /v1/chat/completions` on the gateway endpoint
* **AND** it SHALL parse `chat.completion.chunk` payloads directly into `NormalizedRuntimeEvent` instances
