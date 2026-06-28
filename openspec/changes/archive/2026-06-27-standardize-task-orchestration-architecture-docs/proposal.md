## Why

The Task & Orchestration module has successfully completed a monumental architectural evolution: transitioning from custom webhook DTO definitions to a fully compliant, production-grade OpenAI-compatible HTTP API (`POST /v1/chat/completions`) connecting directly to the physical OpenClaw Gateway. Simultaneously, the frontend HTTP provider has been decoupled via non-blocking initialization (`setTimeout`) and fortified with event-driven state bootstrapping and step alignment. To ensure long-term maintainability, operational excellence, and strict adherence to project standards, it is imperative to comprehensively standardize the overarching architecture documentation, establish a robust Gateway Troubleshooting Runbook, and audit all capability specifications for complete conceptual integrity.

## What Changes

- **End-to-End Architectural Documentation Alignment**: Formally document the end-to-end communication flow across all layers: Frontend UI (`HttpTaskOrchestrationProvider`), Backend Orchestrator (`OpenClawExecutionOrchestrator`), Execution Adapter (`OpenClawTaskExecutionAdapter`), Network Transport (`OpenClawHttpSSETransport`), and the Physical OpenClaw Gateway Container on port 18789.
- **Responsibility Boundary Hardening**: Explicitly define and reinforce the strict separation of concerns regarding infrastructure runtime provisioning (in-scope: consuming `WorkspaceExecutionRuntime`; out-of-scope: container lifecycle management), authentication/RBAC (in-scope: consuming authenticated principal; out-of-scope: secret management or RBAC enforcement), routing (in-scope: forwarding selection; out-of-scope: LLM routing algorithms), and transport protocols (in-scope: OpenAI HTTP API & SSE mapping; out-of-scope: gateway internal debugging protocols).
- **Gateway Troubleshooting Runbook**: Establish a comprehensive operational guide (`openclaw-gateway-troubleshooting`) detailing recovery mechanisms for physical gateway disconnections, handling of HTTP 400/401 error codes, `AbortController.abort()` stream termination, and secure error mapping (`execution-runtime-unavailable`, `provider-authentication-rejected`).
- **High-Level Architecture Update**: Update the project's foundational architecture document (`docs/architecture.md`) to formally enshrine the OpenAI-compatible HTTP API communication paradigm and remove legacy custom DTO references.
- **Audit Domain Capability Specifications**: Audit and harmonize the existing domain capability specifications to ensure perfect synchronization across the entire lifecycle (core, routing, lifecycle, streaming, failure-cancellation, workspace, and history).

## Capabilities

### New Capabilities
- `openclaw-gateway-troubleshooting`: Establishes a definitive operational runbook for handling physical gateway disconnects, HTTP 400/401 rejection codes, `AbortController` cancellation lifecycle, and secure error mapping (`execution-runtime-unavailable`, `provider-authentication-rejected`).

### Modified Capabilities
- `openclaw-task-execution`: Update to reinforce the end-to-end OpenAI-compatible HTTP API communication flow and strict responsibility boundaries.
- `task-execution-adapter`: Update to verify complete alignment with the non-blocking start lifecycle and robust state reconciliation.
- `task-orchestration-provider`: Update to ensure full conceptual harmonization across all 7 domain-driven capability specifications (core, routing, lifecycle, streaming, failure-cancellation, workspace, history).

## Impact

- **Documentation & High-Level Architecture**: `docs/architecture.md` will be updated to enshrine the new OpenAI-compatible HTTP API paradigm.
- **OpenSpec Specifications**: Delta specifications for `openclaw-task-execution`, `task-execution-adapter`, `task-orchestration-provider`, and the new `openclaw-gateway-troubleshooting` runbook will be established.
- **Implementation Stability**: Zero runtime application code changes. This is a documentation and specification standardization change designed to lock in the absolute stability of the current active implementation.
