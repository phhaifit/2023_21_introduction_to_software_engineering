## Context

The platform has established a working end-to-end integration between the React Web UI chat, Express API router, and OpenClaw execution runtime. While the internal contracts and adapters (`OpenClawHttpSSETransport`, `OpenClawTaskExecutionAdapter`, `HttpTaskOrchestrationProvider`) operate robustly, platform developers and operations teams lack a unified, authoritative connection guide. This technical design establishes the structure and content for `docs/openclaw-connection-guide.md`.

## Goals / Non-Goals

**Goals:**
- Provide a clear, step-by-step connection guide for running the OpenClaw Docker container locally and connecting it to the platform.
- Document environment variables (`OPENCLAW_GATEWAY_TOKEN`, `BACKEND_URL`), network port bindings (`18789`), and Docker socket requirements.
- Outline specific troubleshooting steps for common connection failures (e.g., Docker daemon down, port conflicts, authentication mismatch).

**Non-Goals:**
- Do not modify existing execution runtime behavior, adapters, or HTTP/SSE transports.
- Do not introduce new third-party dependencies or modify existing business logic.

## Decisions

- **Dedicated Documentation File**: Create `docs/openclaw-connection-guide.md` as a standalone operational artifact rather than appending to high-level architecture documents. *Rationale*: Keeps operational instructions focused and easily searchable for developers working specifically on task orchestration.
- **Troubleshooting Workflows**: Structure troubleshooting sections around concrete error messages (e.g., `failed to connect to the docker API at unix:///var/run/docker.sock`, `execution-runtime-unavailable`) to provide immediate, actionable resolutions.
- **Zero Runtime Mutation**: Strictly limit the scope of this change to documentation additions to guarantee absolute runtime regression safety.

## Risks / Trade-offs

- **Risk: Configuration Drift** → *Mitigation*: Base all documented parameters (port 18789, `/api/workspaces/:workspaceId/executions`) directly on established, verified OpenSpec integration contracts and active codebase implementations.
