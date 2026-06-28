## Context

The Task & Orchestration module serves as the command center for task execution, lifecycle management, and event streaming within the platform. Following the successful alignment of `OpenClawNetworkTransport` to the official OpenClaw Gateway OpenAI-compatible HTTP API (`POST /v1/chat/completions`) and the non-blocking start decoupling of `HttpTaskOrchestrationProvider`, the actual physical implementation is perfectly stable and functional. However, the overarching project documentation (`docs/architecture.md`), existing capability specifications, and operational runbooks must be updated to formally match this new paradigm, eliminate legacy custom DTO references, and establish concrete troubleshooting protocols for gateway interaction.

## Goals / Non-Goals

**Goals:**
- Formally document the end-to-end communication flow from `HttpTaskOrchestrationProvider` down to the physical OpenClaw Gateway container on port 18789.
- Establish the `openclaw-gateway-troubleshooting` runbook covering HTTP 400/401 error handling, `AbortController.abort()` stream termination, network disconnect recovery, and normalized error mapping (`execution-runtime-unavailable`, `provider-authentication-rejected`).
- Update `docs/architecture.md` to formally enshrine the OpenAI-compatible HTTP API communication model and remove outdated webhook DTO schemas.
- Audit and align `openclaw-task-execution`, `task-execution-adapter`, and `task-orchestration-provider` capability specifications to ensure 100% synchronization across all 7 domain-driven capability areas.

**Non-Goals:**
- Zero runtime application code modifications. The physical implementation is fully verified and stable.
- No modifications to state machine invariants or reducers in `task-creation-state.ts` or `task-completion.ts`.
- No administrative changes to external modules (Agent Management, Workflow Management, Workspace Management) or infrastructure provisioning logic.

## Decisions

- **Enshrine OpenAI-Compatible HTTP API in Architecture**: Update `docs/architecture.md` to establish `POST /v1/chat/completions` as the primary integration mechanism between the platform execution adapter and external AI runtimes. This choice maximizes interoperability, standardizes event parsing (`chat.completion.chunk`), and ensures robust security redaction prior to event presentation.
- **Dedicated Gateway Troubleshooting Capability**: Create a standalone specification (`openclaw-gateway-troubleshooting`) to serve as an operational runbook. Rather than scattering error handling logic across multiple files, a dedicated runbook consolidates procedures for handling gateway rejection codes, authorization failures, and physical disconnects.
- **Strict Separation of Concerns**: Maintain explicit architectural boundaries where Task & Orchestration acts purely as a consumer of externally supplied `WorkspaceExecutionRuntime` references, delegating infrastructure provisioning, container lifecycle management, and credential creation entirely to external modules.

## Risks / Trade-offs

- **Risk**: Outdated architectural documentation leading to confusion during future onboarding or maintenance.
  **Mitigation**: Systematically updating `docs/architecture.md` and establishing delta specifications ensures that the documented single source of truth perfectly reflects the live, verified implementation.
- **Risk**: Operational ambiguity during physical gateway disconnections or authentication rejections.
  **Mitigation**: The new `openclaw-gateway-troubleshooting` runbook provides concrete, actionable recovery flows and normalized error mappings to guide operations and support teams.
