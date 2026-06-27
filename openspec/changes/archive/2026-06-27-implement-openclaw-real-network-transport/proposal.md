## Why

The Task & Orchestration module currently relies on simulated in-memory event transport (`simulateIncomingProviderEvent`) within `OpenClawTaskExecutionAdapter`. To support real execution workloads, the system needs to replace this simulated transport with a real network transport boundary, enabling seamless connection to a real OpenClaw runtime provided by Workspace Management or infrastructure modules. This establishes a true production-grade integration while maintaining strict architectural boundaries against provisioning or container management.

## What Changes

- **OpenClaw Network Transport Boundary**: Define `OpenClawNetworkTransport` interface for start execution, cancel execution, and event stream subscription/webhook registration.
- **Raw Provider DTOs & Schemas**: Define internal data transfer objects for start request/response, cancel request/response, and raw event payloads (progress, partial output, completion, failure, cancellation).
- **Raw Event Mapper**: Implement `OpenClawRawEventMapper` to parse raw OpenClaw payloads, validate required fields, sanitize/redact sensitive data, and map them to `NormalizedRuntimeEvent`.
- **Concrete Transport Implementation**: Implement a concrete transport (HTTP + SSE) to communicate with the real OpenClaw runtime using resolved endpoints and credential references.
- **Adapter Integration**: Inject `OpenClawNetworkTransport` into `OpenClawTaskExecutionAdapter`, wiring it for production transport while preserving test-only simulation paths where appropriate.
- **Robustness & Protections**: Enforce duplicate and stale event protections, support snapshot reconciliation, prevent silent fallback from production transport to mock transport, and preserve the existing canonical Task lifecycle.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-execution-adapter`: Defines the real network transport boundary (`OpenClawNetworkTransport`), raw provider DTO schemas, raw event mapping (`OpenClawRawEventMapper`), and concrete transport implementation (HTTP + SSE) while preserving strict architectural decoupling from runtime provisioning.
- `openclaw-task-execution`: Incorporates real network transport communication for start execution, cancellation forwarding, and streaming event subscription with robust duplicate, stale, and snapshot reconciliation protections.

## Impact

- **Task Execution Adapters**: `OpenClawTaskExecutionAdapter` is updated to utilize injected network transport instead of relying solely on simulated event invocation.
- **Out of Scope**: No OpenClaw container provisioning, no start/stop/delete container lifecycle management, no secret management or hard-coded endpoints, no fake credentials, no modification to Agent or Workflow management beyond consuming existing contracts, no custom LLM router or custom multi-agent orchestration engine, and no retry/queue/recovery policies beyond defined specifications.
