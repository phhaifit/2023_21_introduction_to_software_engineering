## Context

The Python orchestration service (from `add-python-task-orchestration-service`) uses a fixed mock executor that ignores routing mode. For Auto-routing tasks, the service needs to consult an AI model to decide which agent or workflow should handle the task. This design defines a model provider abstraction with three implementations, structured routing decision validation, fallback semantics, and the integration point inside the Python mock executor pipeline.

## Goals / Non-Goals

**Goals:**
- Define a `ModelProvider` interface for the Python service with a single `generate_routing_decision` method.
- Define three `ModelProvider` implementations: `MockModelProvider` (deterministic), `LocalModelProvider` (Ollama-compatible), `RemoteModelProvider` (OpenAI-compatible API).
- Define `RoutingDecision` as a structured output with target type, selected ID, confidence (0.0–1.0), reason string, and optional provider/model metadata.
- Define routing decision validation rules: valid target type, existing and available target ID, confidence within range, non-empty reason.
- Define target availability validation using the agent/workflow registry available to the Python service.
- Define deterministic fallback: apply when model is unreachable, call times out, or output is invalid; never claim AI routing succeeded in a fallback path.
- Define timeout for model API calls.
- Define invalid/malformed output handling.
- Extend `routing-resolved` `TaskRuntimeEvent` payload with confidence, reason, fallback indicator, and provider metadata.
- Integrate AI routing into the Python mock executor as a pre-timeline step for Auto-routing tasks only.
- Keep routing for Specific Agent and Predefined Workflow tasks free of AI router involvement.
- Ensure all credentials remain in the Python service environment.

**Non-Goals:**
- Real agent execution or workflow execution engine.
- Autonomous multi-agent planning or chaining.
- Knowledge Base or RAG retrieval.
- Model training, fine-tuning, or RLHF.
- Production persistence of routing decisions.
- Worker queue or retry on routing failure.
- Frontend UI changes (the workspace already renders routing metadata from the event payload).

## Decisions

### Decision 1: `ModelProvider` as a Python Interface (Protocol)
- **Rationale**: Using Python `typing.Protocol` for `ModelProvider` allows the three implementations to be swapped at startup based on configuration without subclassing. It also makes the mock implementation trivially testable without mocking HTTP calls.
- **Alternatives Considered**: ABC base class. Functionally equivalent but Protocol allows structural typing, which is more idiomatic for dependency injection in modern Python.

### Decision 2: Structured Output via Prompt Engineering + JSON Parsing
- **Rationale**: The model is prompted to return a JSON object matching `RoutingDecision`. The router then validates the parsed output against a Pydantic model. If parsing fails or validation fails, the fallback path activates. This avoids relying on model function-calling APIs (which differ across providers) while still producing a machine-readable decision.
- **Alternatives Considered**: OpenAI function calling / tool use. More reliable for structured output but not universally available across all compatible APIs and not supported by all Ollama models.
- **Alternatives Considered**: Free-form text parsing with regex. Rejected because it is fragile and non-deterministic.

### Decision 3: Fallback Is Explicit and Transparent
- **Rationale**: A fallback routing decision must carry `is_fallback: true` so the frontend can display a notice when applicable (per user requirements). Silent fallback that masquerades as AI routing success violates the transparency requirement.
- **Alternatives Considered**: Fail the task when the model is unavailable. Rejected because a deterministic first-available-agent selection is a viable routing strategy and should not cause task failure for a transient model outage.

### Decision 4: Mock Model Provider for Testing and Demo Without Network
- **Rationale**: The `MockModelProvider` returns a deterministic `RoutingDecision` without any network call. This allows all routing validation logic to be tested without a local or remote model, and allows the demo to run offline.
- **Alternatives Considered**: Reusing the mock executor's existing determinism. Rejected because routing and execution are independent concerns; the mock model provider is specifically for the routing step.

### Decision 5: Timeout Is a First-Class Configuration Value
- **Rationale**: Model API calls may stall. A configurable timeout ensures the routing step does not block the task lifecycle indefinitely.
- **Alternatives Considered**: Hard-coded timeout. Rejected because appropriate timeout values differ between local models (lower latency) and remote APIs (potentially higher latency).

### Decision 6: Specific Agent and Predefined Workflow Bypass AI Router
- **Rationale**: When the user has explicitly selected a target, consulting an AI model to change that selection would violate user intent. The AI router is only responsible for Auto-routing decisions.
- **Alternatives Considered**: Always consulting AI router and discarding the decision for non-auto modes. Rejected because it wastes model API calls and delays task start unnecessarily.

### Decision 7: Credentials in Service Environment Only
- **Rationale**: API keys for remote model providers must never appear in frontend code, browser environments, or HTTP responses. They are loaded from environment variables by the Python service at startup.
- **Alternatives Considered**: Frontend-side model calls. Rejected because it exposes API keys to the browser and violates basic API security.

### Architecture & Data Flow

```text
Task Submitted (Auto-routing mode)
        |
        v
Python Orchestration Service — AI Routing Step
        |
   [ModelProvider selected by configuration]
        |
   +----+----+----+
   |         |    |
   v         v    v
MockModel  Local  Remote
Provider   Model  Model
(deterministic) (Ollama) (OpenAI-compat)
        |
        v
RoutingDecision (structured JSON)
        |
   [Validation]
   ├── Valid target type?
   ├── Target ID exists and is available?
   ├── Confidence in [0.0, 1.0]?
   └── Reason non-empty?
        |
   [if valid]             [if invalid or timeout]
        |                          |
        v                          v
 Accepted RoutingDecision     Fallback RoutingDecision
 (is_fallback: false)         (is_fallback: true)
        |
        v
routing-resolved TaskRuntimeEvent
(carries resolved target, confidence, reason,
 is_fallback, provider metadata)
        |
        v
Mock Executor — 6-stage orchestration timeline
(with resolved routing context)
```

```text
Task Submitted (Specific Agent or Predefined Workflow mode)
        |
        v
Target Validation
   ├── Target ID exists in registry?
   └── Target is available?
        |
   [if valid]             [if invalid]
        |                          |
        v                          v
routing-resolved event        task-failed event
(no AI router call)           (validation error)
```

### `RoutingDecision` Structure

```text
RoutingDecision {
  target_type: "agent" | "workflow"
  target_id: string
  confidence: float  # 0.0–1.0
  reason: string     # human-readable, non-empty
  is_fallback: bool
  provider_metadata?: {
    provider: "mock" | "local" | "remote"
    model?: string
    latency_ms?: int
  }
}
```

### Routing Context Supplied to the Model

The model receives:
- The task prompt.
- A list of available agents with their IDs and descriptions.
- A list of available workflows with their IDs and descriptions.
- A routing context instruction requesting a structured JSON response.

The model does NOT receive:
- API keys or internal service secrets.
- User identity or workspace details.
- Prior task history or session state.

### Validation Rules

A `RoutingDecision` is accepted if and only if:
1. `target_type` is `"agent"` or `"workflow"`.
2. `target_id` identifies an entry in the available registry of the corresponding type.
3. The identified target is marked as available (not disabled or deleted).
4. `confidence` is a number in [0.0, 1.0].
5. `reason` is a non-empty string.

If any rule fails, the decision is rejected and the fallback path activates.

### Fallback Behavior

1. Select the first available agent from the registry (deterministic ordering).
2. Construct a `RoutingDecision` with `is_fallback: true`, `confidence: 0.0`, and a reason string describing why fallback was applied (e.g., "Model unavailable", "Invalid model output").
3. Continue the orchestration timeline with the fallback target.
4. The `routing-resolved` event carries `is_fallback: true`; the frontend displays a fallback notice if the event carries this field.

### Error Handling

- Model call timeout: activates fallback. Timeout duration is configurable via `MODEL_TIMEOUT_MS`.
- Model API returns HTTP error (4xx, 5xx): activates fallback.
- Model output is not valid JSON: activates fallback.
- Model output parses but fails validation: activates fallback.
- Selected target is not in the registry: activates fallback.
- No agents available (empty registry): `task-failed` with error code `NO_AVAILABLE_ROUTING_TARGET`.
- Specific Agent target not found or unavailable: `task-failed` with error code `INVALID_ROUTING_TARGET`.
- Predefined Workflow target not found or unavailable: `task-failed` with error code `INVALID_ROUTING_TARGET`.

### Configuration

New service environment variables:
- `MODEL_PROVIDER`: `mock` | `local` | `remote` (default: `mock`)
- `LOCAL_MODEL_BASE_URL`: base URL of local Ollama-compatible API (required when `MODEL_PROVIDER=local`)
- `LOCAL_MODEL_NAME`: model identifier (required when `MODEL_PROVIDER=local`)
- `REMOTE_MODEL_BASE_URL`: base URL of remote API (required when `MODEL_PROVIDER=remote`)
- `REMOTE_MODEL_API_KEY`: API key (required when `MODEL_PROVIDER=remote`; loaded from environment only)
- `REMOTE_MODEL_NAME`: model identifier (required when `MODEL_PROVIDER=remote`)
- `MODEL_TIMEOUT_MS`: timeout for model API call (default: `10000`)

### Migration Strategy

- The AI router is added as a new module inside the Python service. Existing `PythonMockExecutor` code is unchanged; a new pre-execution hook calls `ModelProvider.generate_routing_decision` for Auto-routing tasks.
- When `MODEL_PROVIDER=mock`, behavior is identical to the previous change with deterministic routing selections.
- The `routing-resolved` `TaskRuntimeEvent` payload gains optional `confidence`, `reason`, `is_fallback`, and `provider_metadata` fields. These are backward-compatible additions (frontend renders them if present; existing frontend code ignores absent fields).

## Risks / Trade-offs

- **Risk: Model produces a valid but semantically poor routing decision**
  - *Mitigation*: The structural validation catches format errors. Semantic quality depends on the prompt and model capability. This is intentional scope; the spec does not require the model to always choose optimally.
- **Risk: Local model is slow, causing task start delays**
  - *Mitigation*: `MODEL_TIMEOUT_MS` enforces a ceiling. If the model exceeds the timeout, fallback applies and the task continues.
- **Risk: Fallback is indistinguishable from successful AI routing in the UI**
  - *Mitigation*: `is_fallback: true` in the `routing-resolved` event allows the frontend to display a notice. The UI is not required to hide this information.
- **Risk: Remote model API key is accidentally exposed**
  - *Mitigation*: The key is loaded from `REMOTE_MODEL_API_KEY` environment variable only. It is never logged, never included in service API responses, and never sent to the frontend.
- **Risk: Available agent/workflow registry in Python service diverges from frontend mock registry**
  - *Mitigation*: For this change, the Python service maintains its own in-memory registry seeded with the same entries as the frontend mock (`AGT-CODE`, `AGT-REVIEW`, `AGT-RESEARCH`, `AGT-SYNTHESIS`, `WFL-CODE-REVIEW`, `WFL-RESEARCH-SYNTHESIS`). Synchronization with a real Agent Management or Workflow Management service is future work (`connect-task-orchestration-modules`).
- **Risk: No agents in registry causes unrecoverable failure**
  - *Mitigation*: `task-failed` with `NO_AVAILABLE_ROUTING_TARGET` is emitted. This is a configuration error, not a model error.
