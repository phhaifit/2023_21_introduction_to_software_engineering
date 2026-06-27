## ADDED Requirements

### Requirement: OpenClaw Raw Event Mapper
The system SHALL implement `OpenClawRawEventMapper` as a dedicated component to parse raw incoming payloads from OpenClaw, validate required fields, apply automated security redaction (`sanitizeObservabilityPayload`) to scrub credentials and system paths, and map raw events (progress, partial output, completion, failure, cancellation) into the canonical `NormalizedRuntimeEvent` union. It SHALL safely reject unknown, malformed, or unsafe payloads without corrupting task state.

#### Scenario: Map and sanitize raw provider events
* **GIVEN** a raw event payload is received from the OpenClaw runtime stream
* **WHEN** `OpenClawRawEventMapper` processes the payload
* **THEN** it SHALL parse the DTO, validate essential fields, and map it to a `NormalizedRuntimeEvent`
* **AND** it SHALL apply security redaction filters to scrub sensitive tokens, passwords, and absolute file paths before presentation

### Requirement: Concrete Network Transport Implementation
The system SHALL implement a concrete `OpenClawNetworkTransport` using HTTP POST for start and cancel requests, and Server-Sent Events (SSE) for event stream subscriptions. It SHALL handle runtime unavailability, transport disconnections, and authentication failures securely, returning normalized error contracts (`provider-authentication-rejected`, `execution-runtime-unavailable`) without silent fallback to mock transport.

#### Scenario: Execute physical transport communication over HTTP and SSE
* **GIVEN** a valid task execution is initiated for a real OpenClaw runtime
* **WHEN** the concrete network transport is invoked
* **THEN** it SHALL send start and cancel requests via HTTP POST and establish an SSE connection for streaming updates
* **AND** it SHALL handle network disconnections and authentication rejections by returning normalized error contracts

### Requirement: OpenClaw Task Execution Adapter Network Integration
`OpenClawTaskExecutionAdapter` SHALL accept an injected `OpenClawNetworkTransport` to handle production network communication, replacing the simulated event path for real execution workloads while preserving test-only simulation where appropriate. It SHALL preserve duplicate-event protection, stale-event handling, and snapshot reconciliation behavior upon transport reconnection.

#### Scenario: Integrate network transport into execution adapter
* **GIVEN** `OpenClawTaskExecutionAdapter` is instantiated with an injected `OpenClawNetworkTransport`
* **WHEN** real task execution begins
* **THEN** it SHALL invoke the network transport for start, cancel, and streaming operations
* **AND** it SHALL preserve duplicate-event filtering, stale-event handling, and snapshot reconciliation upon reconnection
