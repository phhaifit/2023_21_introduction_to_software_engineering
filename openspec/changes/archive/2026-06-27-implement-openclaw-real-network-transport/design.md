## Context

The Task & Orchestration module currently leverages an `OpenClawTaskExecutionAdapter` that simulates event transport in-memory via `simulateIncomingProviderEvent`. While this mechanism is excellent for isolated unit and contract testing, it lacks the network transport layer required to communicate with a real OpenClaw runtime in production environments. To enable real execution workloads without compromising architectural boundaries or introducing tight coupling to container provisioning, the system requires a clean network transport boundary, a dedicated raw event mapper, and a concrete transport protocol implementation.

## Goals / Non-Goals

**Goals:**
- **Network Transport Boundary**: Define `OpenClawNetworkTransport` interface to decouple the execution adapter from concrete network protocols.
- **Protocol Selection**: Establish a production-grade communication protocol (HTTP + SSE) for sending execution lifecycle requests and receiving streaming execution events.
- **Data Translation & Security**: Implement `OpenClawRawEventMapper` to parse raw OpenClaw DTOs, validate required fields, sanitize/redact sensitive information, and map payloads to `NormalizedRuntimeEvent`.
- **Robust Error & Lifecycle Handling**: Explicitly manage runtime unavailability, transport disconnects, malformed events, duplicate events, stale events, provider failures, and credential/auth failures.
- **Testing Strategy**: Deliver comprehensive unit tests for the mapper, transport tests with mock network servers/interceptors, and adapter integration tests with mock transport.

**Non-Goals:**
- No provisioning or lifecycle management (start/stop/delete) of OpenClaw containers.
- No direct secret management, hard-coded endpoints, or creation of fake credentials.
- No creation or administration of Agents or Workflows beyond consuming existing workspace contracts.
- No alteration to existing canonical Task lifecycle behavior or state machines beyond defined specifications.
- No introduction of custom LLM routers or custom multi-agent orchestration engines.
- No addition of retry, queue, or recovery policies beyond what is explicitly defined in the specification.

## Decisions

### 1. Protocol Selection: HTTP + SSE (with Contract-First Approach)
- **Selected Protocol**: We choose **HTTP + SSE** (Server-Sent Events) as the primary transport protocol, while maintaining a contract-first design to isolate the system from potential OpenClaw API instability.
- **Alternative Protocols Considered**:
  - *HTTP + WebSocket*: Provides full duplex communication but introduces higher overhead in maintaining persistent stateful bi-directional socket connections. OpenClaw execution monitoring is inherently unidirectional (server-to-client streaming) after the initial start request.
  - *gRPC*: Offers extremely high performance and strict schemas via Protobuf, but introduces complex dependency requirements and is less flexible if the OpenClaw runtime API is rapidly evolving.
  - *Queue (RabbitMQ/Kafka)*: Ideal for highly decoupled asynchronous messaging but introduces heavy external infrastructure dependencies, violating the lightweight consumer boundaries of Task & Orchestration.
- **Rationale**: HTTP POST provides a robust, standard mechanism for dispatching `start` and `cancel` commands, while SSE provides a simple, firewall-friendly, unidirectional streaming channel ideal for receiving real-time progress, partial outputs, and lifecycle events.

### 2. OpenClawNetworkTransport Boundary
We define a dedicated port interface `OpenClawNetworkTransport` to handle all physical network communications:
- `startExecution(endpoint: string, credentialReference: string, request: OpenClawStartRequestDTO): Promise<OpenClawStartResponseDTO>`: Initiates execution over HTTP POST.
- `cancelExecution(endpoint: string, credentialReference: string, request: OpenClawCancelRequestDTO): Promise<OpenClawCancelResponseDTO>`: Sends a cancellation signal over HTTP POST.
- `subscribeEventStream(endpoint: string, credentialReference: string, providerExecutionReference: string, onEvent: (rawEvent: unknown) => void, onError: (error: Error) => void): { unsubscribe: () => void }`: Connects to the SSE endpoint to stream execution updates.
- `getSnapshot(endpoint: string, credentialReference: string, providerExecutionReference: string): Promise<unknown>`: Fetches the latest execution state for reconciliation if the streaming transport encounters a disconnect.

### 3. Raw Provider DTOs
Define explicit internal DTO schemas representing the raw payloads expected from OpenClaw:
- `OpenClawStartRequestDTO`: `{ taskId: string; prompt: string; target: string; mode: string; parameters?: Record<string, unknown> }`
- `OpenClawStartResponseDTO`: `{ providerExecutionReference: string; status: string; startedAt: string }`
- `OpenClawCancelRequestDTO`: `{ providerExecutionReference: string; taskId: string }`
- `OpenClawCancelResponseDTO`: `{ providerExecutionReference: string; status: string; canceledAt: string }`
- `OpenClawRawProgressEvent`: `{ eventType: "progress"; executionId: string; stepId: string; stepName: string; status: string; timestamp: number }`
- `OpenClawRawPartialOutputEvent`: `{ eventType: "partial_output"; executionId: string; chunk: string; timestamp: number }`
- `OpenClawRawCompletionEvent`: `{ eventType: "completion"; executionId: string; finalOutput: string; timestamp: number }`
- `OpenClawRawFailureEvent`: `{ eventType: "failure"; executionId: string; errorCode: string; errorMessage: string; rawDetails?: unknown; timestamp: number }`
- `OpenClawRawCancellationEvent`: `{ eventType: "cancellation"; executionId: string; timestamp: number }`

### 4. OpenClawRawEventMapper
To ensure strict security and contract isolation, the `OpenClawRawEventMapper` operates as an independent component with the following responsibilities:
- **Parse Raw Payload**: Safely parses incoming webhook or SSE text payloads into structured DTOs.
- **Validate Required Fields**: Enforces the presence of essential fields (`eventType`, `executionId`, `timestamp`).
- **Sanitize Sensitive Fields**: Employs automated security redaction (`sanitizeObservabilityPayload`) to scrub API keys, bearer tokens, passwords, and absolute system file paths before any event reaches the application domain.
- **Map to NormalizedRuntimeEvent**: Translates validated raw events into the canonical `NormalizedRuntimeEvent` discriminated union.
- **Reject Unknown or Unsafe Payloads**: Silently drops or logs unparseable, unknown, or structurally unsafe payloads without crashing the adapter or corrupting task state.

### 5. Error Handling Architecture
- **Runtime Unavailable**: If `WorkspaceExecutionRuntimeResolver` returns an unavailable or stopped runtime, the system immediately rejects the command with a normalized `execution-runtime-unavailable` or `execution-runtime-not-running` error. It SHALL NOT silently fallback from production transport to mock transport.
- **Transport Disconnect**: If the SSE stream disconnects, `OpenClawTaskExecutionAdapter` updates `transportConnectionState` to `disconnected` or `reconnecting` without altering the canonical Task status (e.g., remains `in-progress`).
- **Malformed Event**: The mapper rejects malformed payloads safely, preserving existing execution snapshots.
- **Duplicate & Stale Events**: The adapter maintains `processedEvents` (by unique event ID) and `lastEventTimestamps` (by timestamp) to discard duplicate or out-of-order events.
- **Provider Failure**: Maps raw provider errors to `NormalizedRuntimeError` with secure sanitization, transitioning the task to `failed`.
- **Credential/Auth Failure**: If the HTTP transport receives a 401/403 response from OpenClaw, it returns a normalized `provider-authentication-rejected` error.

### 6. Testing Strategy
- **Mapper Unit Tests**: Extensive isolated tests verifying parsing, validation, error mapping, and strict credential redaction across valid, invalid, and sensitive raw payloads.
- **Transport Tests**: Unit tests utilizing mock HTTP/SSE network servers and interceptors to verify correct header injection, payload serialization, and connection lifecycle handling.
- **Adapter Integration Tests**: Verification of `OpenClawTaskExecutionAdapter` wired with a mock `OpenClawNetworkTransport` to validate the complete 10-step start flow, cancellation forwarding, and snapshot reconciliation.
- **No Real OpenClaw Container Required**: Normal CI execution runs entirely against mock network interceptors and mock transport boundaries, ensuring fast, deterministic, and infrastructure-free verification unless explicitly configured otherwise.

## Risks / Trade-offs

- **[Risk] OpenClaw API Instability** → *Mitigation*: By utilizing a contract-first approach with `OpenClawNetworkTransport` and `OpenClawRawEventMapper`, any external schema changes are isolated to the mapper layer, protecting the core adapter and orchestration domain from breaking changes.
- **[Risk] Accidental Credential Leakage in Raw Events** → *Mitigation*: All incoming payloads must pass through `sanitizeObservabilityPayload` within `OpenClawRawEventMapper` prior to emitting `NormalizedRuntimeEvent`, ensuring automated redaction of sensitive tokens or system paths.
- **[Risk] Unreliable Network Streams (SSE Disconnections)** → *Mitigation*: `OpenClawTaskExecutionAdapter` decouples transport connection state from Task lifecycle state and incorporates explicit snapshot reconciliation upon reconnection, ensuring task continuity during transient network interruptions.
