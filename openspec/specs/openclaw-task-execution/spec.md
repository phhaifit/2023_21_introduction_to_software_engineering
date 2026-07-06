# openclaw-task-execution Specification

## Purpose
Defines the concrete consumer-side integration with an externally provided OpenClaw runtime, including external runtime resolution, Auto-routing delegation, Specific Agent and Workflow mapping, explicit runtime unavailable behavior, the rigorous 10-step start flow, cancellation forwarding boundary, and transport recovery mechanisms.

## Requirements

### Requirement: External Runtime Resolution
Task & Orchestration SHALL ask `WorkspaceExecutionRuntimeResolver`, receive an externally supplied runtime reference, validate that it is usable, and pass it to the OpenClaw adapter. The resolver implementation belongs outside this module.

#### Scenario: Resolve external runtime reference
* **GIVEN** a task is ready to start execution in a workspace
* **WHEN** Task & Orchestration invokes the runtime resolver
* **THEN** it SHALL receive an externally supplied runtime reference
* **AND** it SHALL validate the reference and pass it to the OpenClaw adapter without provisioning the runtime

---

### Requirement: Auto-Routing Delegation
Auto-routing SHALL mean Task & Orchestration sends an Auto routing request to the configured OpenClaw routing/coordinator entry point. Task & Orchestration SHALL NOT implement an LLM Router.

#### Scenario: Delegate Auto-routing to OpenClaw
* **GIVEN** a task is configured with Auto routing mode
* **WHEN** the execution start command is dispatched
* **THEN** Task & Orchestration SHALL send an Auto routing request to the configured OpenClaw entry point
* **AND** it SHALL NOT analyze prompts or implement an LLM Router itself

---

### Requirement: Specific Agent and Workflow Mapping
Task & Orchestration SHALL receive a platform ID, validate the externally supplied workspace-scoped agent or workflow contract, obtain the provider mapping, and send the mapped target through the adapter. Agent and Workflow administration SHALL remain outside scope.

#### Scenario: Map Specific Agent target
* **GIVEN** a task is configured with Specific Agent mode
* **WHEN** the execution start command is prepared
* **THEN** Task & Orchestration SHALL validate the externally supplied workspace-scoped agent contract
* **AND** it SHALL obtain the provider mapping and send the mapped target through the adapter

#### Scenario: Map Predefined Workflow target
* **GIVEN** a task is configured with Predefined Workflow mode
* **WHEN** the execution start command is prepared
* **THEN** Task & Orchestration SHALL validate the externally supplied workspace-scoped workflow contract
* **AND** it SHALL obtain the provider mapping and send the mapped target through the adapter

---

### Requirement: Runtime Unavailable Behavior & No Silent Fallback
When a valid Task is submitted for real execution and no running execution runtime can be resolved for the workspace, Task & Orchestration SHALL return a normalized execution-unavailable failure. It SHALL NOT provision a runtime and SHALL NOT silently switch to mock execution.

#### Scenario: Real execution runtime is unavailable
* **GIVEN** a valid Task is submitted for real execution
* **AND** no running execution runtime can be resolved for the workspace
* **WHEN** Task & Orchestration attempts to begin execution
* **THEN** it SHALL return a normalized execution-unavailable failure
* **AND** it SHALL NOT provision a runtime
* **AND** it SHALL NOT silently switch to mock execution

---

### Requirement: Rigorous 10-Step Start Flow
The execution start flow SHALL execute exactly 10 explicit steps: (1) Receive authenticated and authorized request context, (2) Validate Task input, (3) Validate routing selection through external catalogs, (4) Create platform Task and TaskWork, (5) Resolve externally supplied execution runtime, (6) Start execution through the adapter, (7) Store the execution association, (8) consume normalized events, (9) update canonical lifecycle, (10) expose state through the platform API.

#### Scenario: Execute 10-step start flow
* **GIVEN** a task submission request is received
* **WHEN** the start flow executes
* **THEN** it SHALL process steps 1 through 10 sequentially
* **AND** it SHALL consume an already authenticated principal and invoke external authorization boundaries without implementing authentication or RBAC itself

---

### Requirement: Cancellation Forwarding Boundary
Task & Orchestration SHALL own validating Task cancellability, loading the execution association, forwarding cancellation, applying canonical cancellation after defined confirmation, and suppressing late updates. It SHALL NOT own terminating the OpenClaw container, stopping the entire workspace runtime, or deleting the Gateway.

#### Scenario: Forward task cancellation request
* **GIVEN** a task cancellation request is received
* **WHEN** Task & Orchestration processes the cancellation
* **THEN** it SHALL validate cancellability, load the execution association, and forward cancellation to the adapter
* **AND** it SHALL apply canonical cancellation after defined confirmation without terminating containers or deleting Gateways

---

### Requirement: Transport Recovery and State Reconciliation
The adapter SHALL specify snapshot reconciliation, duplicate-event protection, stale-event handling, reconnect behavior, and background Task continuity. Provider connection state SHALL NOT be confused with Task lifecycle state.

#### Scenario: Recover from transient transport disconnection
* **GIVEN** an active task is running in an external OpenClaw runtime
* **WHEN** a transient transport disconnection occurs and reconnects
* **THEN** the adapter SHALL execute snapshot reconciliation and duplicate-event protection
* **AND** background Task continuity SHALL be preserved without transitioning the task to Failed

---

### Requirement: Responsibility Boundary & Architectural Ownership
Workspace Management or the responsible infrastructure module provides a resolvable execution-runtime reference. Task & Orchestration consumes that reference to submit and monitor work. The Task & Orchestration module SHALL own Task and TaskWork domain models, Task creation/validation, canonical Task lifecycle, routing request representation, conversation/Task history, mock execution used for development and tests, provider-neutral execution contracts, consumer-side OpenClaw adapter, mapping platform requests to verified OpenClaw requests, mapping OpenClaw execution updates to normalized Task events, cancellation request forwarding, execution reference association, lifecycle projection, streaming/result/error/observability presentation, Task-scoped event isolation, and frontend rendering/interaction. The Task & Orchestration module SHALL NOT own OpenClaw installation, container creation, start/stop/restart/delete/upgrade, workspace provisioning, CPU/RAM allocation, Standard/Premium infrastructure configuration, Gateway DNS/networking, Gateway credential creation, platform-wide secret ownership, authentication implementation, workspace membership management, RBAC ownership, subscription validation implementation, payment, Agent Management, Workflow Management, Tool Management, Knowledge Base/RAG Management, custom orchestration engines, custom LLM routers, custom multi-agent collaboration engines, custom workflow runtimes, or OpenClaw internals.

#### Scenario: Verify architectural ownership boundaries
* **GIVEN** the Task & Orchestration module is initialized
* **WHEN** the system interacts with external dependencies or execution runtimes
* **THEN** it SHALL consume externally supplied runtime references provided by Workspace Management or infrastructure modules
* **AND** it SHALL NOT provision OpenClaw instances, manage containers, or administer external module domains

---

### Requirement: External Dependency Contracts
The Task & Orchestration specifications SHALL define consumer-facing ports conceptually without claiming ownership of their implementations:
```ts
interface WorkspaceExecutionRuntimeResolver {
  resolve(workspaceId: WorkspaceId): Promise<WorkspaceExecutionRuntime>;
}

interface WorkspaceExecutionRuntime {
  provider: "openclaw";
  instanceId: string;
  endpointReference: string;
  credentialReference: string;
  status: "running" | "stopped" | "unavailable";
}
```
External dependencies SHALL be defined conceptually for Agent Management (workspace-scoped selectable agents, platform-agent to provider-agent mapping), Workflow Management (workspace-scoped selectable workflows, platform-workflow to provider-workflow mapping), Workspace User Management / Authentication (authorized principal and operation permission), and Workspace Management (resolvable execution-runtime reference).

#### Scenario: Consume external dependency contracts
* **GIVEN** a task execution or routing selection is initiated
* **WHEN** Task & Orchestration interacts with external modules
* **THEN** it SHALL consume conceptual ports for Agent Management, Workflow Management, Authentication, and Workspace Management
* **AND** it SHALL NOT implement or administer those external modules

---

### Requirement: Cross-Change Dependency Order
The cross-change dependency order SHALL be documented and adhered to as follows:
```text
enhance-task-orchestration-production-ui
    independent presentation alignment

establish-openclaw-task-integration-contracts
    defines consumer-side contracts

integrate-openclaw-task-execution
    depends on integration contracts
    and on an externally supplied runtime prerequisite

extend-openclaw-execution-observability
    depends on task execution integration
```

#### Scenario: Enforce cross-change dependency order
* **GIVEN** the multi-change implementation roadmap
* **WHEN** changes are implemented or validated
* **THEN** `integrate-openclaw-task-execution` SHALL depend on integration contracts and on an externally supplied runtime prerequisite
* **AND** subsequent changes SHALL respect the defined contract and runtime prerequisite hierarchy

---

### Requirement: OpenClaw Raw Event Mapper
The system SHALL implement `OpenClawRawEventMapper` as a dedicated component to parse raw incoming payloads from OpenClaw, validate required fields, apply automated security redaction (`sanitizeObservabilityPayload`) to scrub credentials and system paths, and map raw events (progress, partial output, completion, failure, cancellation) into the canonical `NormalizedRuntimeEvent` union. It SHALL safely reject unknown, malformed, or unsafe payloads without corrupting task state.

#### Scenario: Map and sanitize raw provider events
* **GIVEN** a raw event payload is received from the OpenClaw runtime stream
* **WHEN** `OpenClawRawEventMapper` processes the payload
* **THEN** it SHALL parse the DTO, validate essential fields, and map it to a `NormalizedRuntimeEvent`
* **AND** it SHALL apply security redaction filters to scrub sensitive tokens, passwords, and absolute file paths before presentation

---

### Requirement: Concrete Network Transport Implementation
The system SHALL implement a concrete `OpenClawNetworkTransport` using HTTP POST for start requests, Server-Sent Events (SSE) for result stream subscriptions, and an optional best-effort Gateway WebSocket side-channel for provider progress subscriptions. It SHALL handle runtime unavailability, transport disconnections, and authentication failures securely, returning normalized error contracts (`provider-authentication-rejected`, `execution-runtime-unavailable`) without silent fallback to mock transport. WebSocket progress side-channel failures SHALL NOT fail an otherwise active HTTP/SSE execution.

#### Scenario: Execute physical transport communication over HTTP and SSE
* **GIVEN** a valid task execution is initiated for a real OpenClaw runtime
* **WHEN** the concrete network transport is invoked
* **THEN** it SHALL send start and cancel requests via HTTP POST and establish an SSE connection for streaming updates
* **AND** it SHALL handle network disconnections and authentication rejections by returning normalized error contracts
* **AND** it MAY subscribe to Gateway WebSocket session progress events and map them to normalized runtime events without replacing the HTTP/SSE execution path

---

### Requirement: OpenClaw Task Execution Adapter Network Integration
`OpenClawTaskExecutionAdapter` SHALL accept an injected `OpenClawNetworkTransport` to handle production network communication, replacing the simulated event path for real execution workloads while preserving test-only simulation where appropriate. It SHALL preserve duplicate-event protection, stale-event handling, and snapshot reconciliation behavior upon transport reconnection.

#### Scenario: Integrate network transport into execution adapter
* **GIVEN** `OpenClawTaskExecutionAdapter` is instantiated with an injected `OpenClawNetworkTransport`
* **WHEN** real task execution begins
* **THEN** it SHALL invoke the network transport for start, cancel, and streaming operations
* **AND** it SHALL preserve duplicate-event filtering, stale-event handling, and snapshot reconciliation upon reconnection

---

### Requirement: OpenClaw Transport Server Registration

The backend server runtime SHALL register `OpenClawHttpSSETransport` configured to communicate with the physical OpenClaw Gateway container on port 18789.

#### Scenario: Server initializes OpenClaw network transport

* **GIVEN** the local agent management server starts up
* **WHEN** `createLocalAgentManagementRuntime` executes
* **THEN** it SHALL instantiate `OpenClawHttpSSETransport` pointing to `http://127.0.0.1:18789`
* **AND** it SHALL inject the transport into `OpenClawTaskExecutionAdapter` and `OpenClawExecutionOrchestrator`
* **AND** it SHALL mount the Task Orchestration Express API router

---

### Requirement: OpenClaw Gateway HTTP API Payload and Header Alignment

The `OpenClawNetworkTransport` implementation SHALL structure its HTTP request payload and headers to align with the official OpenClaw Gateway HTTP API specification when communicating with a live gateway runtime. Specifically, the request body SHALL set `model` to an OpenClaw agent target (`openclaw/default`) and pass `user` to represent the conversation session. The request headers SHALL include `x-openclaw-model` to define the underlying AI provider model and `x-openclaw-session-key` to ensure session continuity.

#### Scenario: Submitting execution start request to live OpenClaw gateway
- **WHEN** `OpenClawHttpSSETransport.startExecution` sends a `POST` request to `/v1/chat/completions` on a live OpenClaw gateway endpoint
- **THEN** the request body SHALL contain `model: "openclaw/default"`, `stream: true`, `messages` array, and `user: request.conversationId`
- **AND** the HTTP headers SHALL include `x-openclaw-model: gemini-3.1-pro-preview`, `x-openclaw-session-key: request.conversationId`, and `Authorization: Bearer <credentialReference>`

---

### Requirement: Pure OpenAI-Compatible HTTP Network Transport
The `OpenClawNetworkTransport` implementation (`OpenClawHttpSSETransport`) SHALL connect to the OpenClaw Gateway runtime using the OpenAI-compatible HTTP API (`POST /v1/chat/completions`) for execution start and result streaming. It SHALL set `model: "openclaw/default"` in the request body, MAY send documented OpenClaw routing headers such as `x-openclaw-agent-id`, and MAY use a best-effort Gateway WebSocket side-channel for session progress. It SHALL rely exclusively on `AbortController.abort()` to cancel active execution streams without issuing outgoing cancellation HTTP requests. It SHALL NOT log unredacted prompts or delta stream chunks to the terminal.

#### Scenario: Dispatch network requests using pure OpenAI-compatible HTTP API
* **GIVEN** `OpenClawHttpSSETransport` is configured as the physical transport layer
* **WHEN** runtime operations (start or stream subscription) are initiated
* **THEN** the transport SHALL dispatch execution start requests to `POST /v1/chat/completions` with `stream: true`, `x-openclaw-model`, `x-openclaw-session-key`, and `model: "openclaw/default"`
* **AND** it SHALL NOT issue requests to fictitious `/executions/*` endpoints
* **AND** it SHALL NOT log unredacted user prompts or delta chunks to the terminal

#### Scenario: Subscribe to Gateway progress side-channel
* **GIVEN** an active HTTP/SSE execution has a conversation session key
* **AND** the runtime environment provides a WebSocket implementation
* **WHEN** the transport subscribes to the event stream
* **THEN** it MAY connect to the OpenClaw Gateway WebSocket endpoint, send `connect`, and subscribe to the current session
* **AND** it SHALL map session operation, tool, message, or agent activity events into normalized runtime progress events
* **AND** WebSocket errors SHALL NOT terminate the HTTP/SSE execution stream

#### Scenario: Terminate execution streams via AbortController
* **GIVEN** an active SSE execution stream is running in `OpenClawHttpSSETransport`
* **WHEN** a cancellation request is forwarded
* **THEN** the transport SHALL call `.abort()` on the active `AbortController`
* **AND** it SHALL NOT issue an outgoing HTTP POST cancellation request to the gateway

