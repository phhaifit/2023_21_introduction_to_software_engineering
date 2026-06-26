## Why

The Python orchestration service from `add-python-task-orchestration-service` uses a mock executor that ignores routing mode entirely. To support the Auto-routing mode with real decision-making, the service needs an AI model that can inspect the prompt and available agents/workflows, then produce a validated structured routing decision. This change introduces a model provider contract, three model provider implementations (mock, local Ollama-compatible, and remote OpenAI-compatible), and integrates the router into the task execution pipeline while preserving mock and deterministic fallback at every failure point.

## What Changes

- Define a `ModelProvider` contract interface covering `generateRoutingDecision`.
- Define a `RoutingDecision` structured output type: target type (agent or workflow), selected ID, confidence, human-readable reason, and provider/model metadata.
- Define a `MockModelProvider` that returns deterministic routing decisions without network calls.
- Define a `LocalModelProvider` that calls an Ollama-compatible local model endpoint.
- Define a `RemoteModelProvider` that calls an OpenAI-compatible or equivalent remote API.
- Define routing decision validation: model output must contain a valid target type, a target ID that exists in the available agent/workflow registry, and a confidence score.
- Define target availability validation: only agents and workflows marked as available are acceptable routing targets.
- Define deterministic fallback behavior: if the model is unavailable or produces invalid output, the system selects the first available agent using a known rule, marks the decision as a fallback, and does not claim AI routing succeeded.
- Define routing metadata propagation: the `routing-resolved` `TaskRuntimeEvent` carries the chosen target, confidence, reason, provider metadata, and fallback indicator.
- Define the AI router integration point in the Python mock executor: Auto-routing tasks invoke the model provider before beginning the orchestration timeline; specific-agent and predefined-workflow tasks skip AI routing and validate the user-selected target.
- Define timeout behavior for model calls.
- Define handling for invalid or malformed model output.

## Capabilities

### New Capabilities

- `task-routing-ai`: Covers the `ModelProvider` contract, `MockModelProvider`, `LocalModelProvider`, `RemoteModelProvider`, `RoutingDecision` structured output, routing decision validation, target availability validation, confidence, reason, fallback behavior, and model metadata.

### Modified Capabilities

- `task-orchestration-service`: The Python mock executor gains an AI routing integration point. Auto-routing tasks call the `ModelProvider` before the orchestration timeline begins; the resolved target is carried in the `routing-resolved` event.
- `task-orchestration-provider`: The `routing-resolved` `TaskRuntimeEvent` payload is extended with fallback indicator and model metadata fields.

## Impact

- **Python orchestration service**: A new `ai_router` module is added to the service. The mock executor invokes the `ModelProvider` for Auto-routing tasks. Configuration gains model provider selection and model-specific settings.
- **TaskRuntimeEvent `routing-resolved`**: Payload extended to carry confidence, reason, fallback flag, and optional model metadata. This is a backward-compatible extension (new optional fields).
- **No frontend UI changes**: The workspace UI already renders routing metadata from the `routing-resolved` event. The extended payload fields are displayed if present; no new UI component is required in this change.
- **API key and credentials**: Model provider credentials exist only in the Python service environment variables. The frontend never handles API keys.
- **Dependency**: This change requires `add-python-task-orchestration-service` to be complete before implementation begins. It also transitively requires `establish-task-orchestration-provider-contracts`.
- **Future work not in this change**: `connect-task-orchestration-modules` (real agent/workflow execution), `persist-task-orchestration-runtime` (durable routing decisions).
