# AI-Assisted Task Routing — Tasks

## 1. ModelProvider Contract and RoutingDecision Schema

**Objective**: Define the `ModelProvider` Python Protocol and `RoutingDecision` Pydantic schema that the AI router and all model provider implementations depend on.

**Scope**:
- `ModelProvider` Protocol with `generate_routing_decision(context: RoutingContext) -> RoutingDecision` method signature.
- `RoutingContext` dataclass: task prompt, list of available agents (ID, description), list of available workflows (ID, description).
- `RoutingDecision` Pydantic model: `target_type` (`"agent"` | `"workflow"`), `target_id` (string), `confidence` (float 0.0–1.0), `reason` (non-empty string), `is_fallback` (bool), `provider_metadata` (optional).
- `ProviderMetadata` model: `provider` (`"mock"` | `"local"` | `"remote"`), `model` (optional string), `latency_ms` (optional int).
- Validation constraints on `RoutingDecision` fields: `target_type` is enum, `confidence` in [0.0, 1.0], `reason` non-empty.

**Acceptance Criteria**:
- `RoutingDecision` Pydantic validation rejects `confidence` outside [0.0, 1.0].
- `RoutingDecision` Pydantic validation rejects empty `reason`.
- `RoutingDecision` Pydantic validation rejects unknown `target_type` values.
- `ProviderMetadata` is optional in `RoutingDecision`.
- `ModelProvider` is a `typing.Protocol`; no class needs to explicitly subclass it to satisfy the protocol.

---

## 2. MockModelProvider Implementation

**Objective**: Implement `MockModelProvider` returning deterministic routing decisions without network calls.

**Scope**:
- `MockModelProvider` class satisfying `ModelProvider` Protocol.
- Deterministic selection: given the available agent and workflow lists, always selects `AGT-CODE` if available, otherwise the first available agent, otherwise the first available workflow.
- Returns `is_fallback: false` and `provider_metadata.provider: "mock"`.
- Works without network access and without any environment variable configuration.

**Acceptance Criteria**:
- `MockModelProvider.generate_routing_decision` returns a `RoutingDecision` with `target_type: "agent"`, `target_id: "AGT-CODE"` when `AGT-CODE` is in the available registry.
- `MockModelProvider` satisfies the `ModelProvider` protocol check.
- No network call is made.
- Returned `RoutingDecision` passes the routing decision validation step.

**Dependencies**: Task 1.

---

## 3. LocalModelProvider and RemoteModelProvider Implementations

**Objective**: Implement `LocalModelProvider` (Ollama-compatible) and `RemoteModelProvider` (OpenAI-compatible) that call real model APIs and parse structured JSON output.

**Scope**:
- `LocalModelProvider`: calls `POST {LOCAL_MODEL_BASE_URL}/api/chat` (or Ollama-compatible endpoint) with a structured prompt requesting a JSON `RoutingDecision`.
- `RemoteModelProvider`: calls `POST {REMOTE_MODEL_BASE_URL}/chat/completions` (OpenAI-compatible) with `Authorization: Bearer {REMOTE_MODEL_API_KEY}` header and structured prompt.
- Both providers: enforce `MODEL_TIMEOUT_MS` on the HTTP call; treat timeout as a fallback trigger.
- Both providers: on HTTP error or network failure, return a fallback `RoutingDecision` with `is_fallback: true`.
- Prompt template for structured output: instructs the model to respond with a JSON object matching `RoutingDecision` fields; includes available agents and workflows as context.
- Parse model response text as JSON; validate against `RoutingDecision` Pydantic model; treat parse or validation failure as a fallback trigger.
- `provider_metadata` carries `provider`, `model`, and measured `latency_ms`.
- API key for remote provider is loaded exclusively from `REMOTE_MODEL_API_KEY` environment variable; it is never logged or returned in any API response.

**Acceptance Criteria**:
- `LocalModelProvider` calls the configured Ollama-compatible endpoint with the structured prompt.
- `RemoteModelProvider` includes the API key in the `Authorization` header only; the key does not appear in service logs or any HTTP response.
- Both providers return a fallback `RoutingDecision` (not an exception) when the model API is unreachable or times out.
- Both providers return a fallback `RoutingDecision` when the model response is not valid JSON.
- Both providers return a fallback `RoutingDecision` when the parsed JSON fails `RoutingDecision` validation.
- `latency_ms` in `provider_metadata` reflects actual call duration.

**Dependencies**: Task 1.

---

## 4. Routing Decision Validation and Target Availability Check

**Objective**: Implement the routing decision validation and target availability check that runs after the model provider returns a decision.

**Scope**:
- Routing decision validator function: accepts a `RoutingDecision` and the agent/workflow registry; returns the decision unchanged if all rules pass, or a fallback decision if any rule fails.
- Validation rules: valid `target_type`, `target_id` exists in the appropriate registry, target is marked available, `confidence` in [0.0, 1.0], `reason` non-empty.
- Fallback decision constructor: takes a reason string, returns `RoutingDecision` with `is_fallback: true`, `confidence: 0.0`, first available agent as target.
- Handle empty registry: no agents and no workflows → do not apply fallback; surface `NO_AVAILABLE_ROUTING_TARGET` error code for the calling executor.
- Specific Agent validation: given a user-provided `agentId`, verify it exists and is available; if not, surface `INVALID_ROUTING_TARGET` error.
- Predefined Workflow validation: given a user-provided `workflowId`, verify it exists and is available; if not, surface `INVALID_ROUTING_TARGET` error.

**Acceptance Criteria**:
- A decision with `target_id` not in the registry triggers fallback.
- A decision with an unavailable target triggers fallback.
- Fallback decision has `is_fallback: true` and `confidence: 0.0`.
- Empty registry produces `NO_AVAILABLE_ROUTING_TARGET` error code, not a fallback decision.
- Specific Agent with unknown `agentId` produces `INVALID_ROUTING_TARGET` error code.
- Predefined Workflow with unknown `workflowId` produces `INVALID_ROUTING_TARGET` error code.
- Valid decision passes through without modification.

**Dependencies**: Task 1, Task 2.

---

## 5. AI Router Integration into Python Mock Executor

**Objective**: Integrate the AI routing step into the Python mock executor pipeline as a pre-timeline hook for Auto-routing tasks.

**Scope**:
- Before the six-stage orchestration timeline begins, the executor checks routing mode.
- Auto-routing: calls `ModelProvider.generate_routing_decision` → validates decision → stores resolved target in task context.
- Specific Agent: runs target availability validation; if invalid emits `task-failed`; if valid stores the agent as the resolved target.
- Predefined Workflow: runs target availability validation; if invalid emits `task-failed`; if valid stores the workflow as the resolved target.
- After routing resolution: emits `routing-resolved` `TaskRuntimeEvent` carrying resolved target, confidence, reason, `is_fallback`, and `provider_metadata`.
- If routing resolution fails (empty registry, invalid target): emits `task-failed` with appropriate error code; orchestration timeline does not start.
- Fallback is applied transparently; the task continues with the fallback target; `routing-resolved` carries `is_fallback: true`.
- `MODEL_PROVIDER` configuration selects which `ModelProvider` implementation is injected at startup.

**Acceptance Criteria**:
- Auto-routing task with `MockModelProvider` emits `routing-resolved` with `is_fallback: false` and `target_id: "AGT-CODE"`.
- Auto-routing task with unavailable model emits `routing-resolved` with `is_fallback: true` and a fallback reason string.
- Specific Agent task with valid `agentId` emits `routing-resolved` with that `agentId` and no AI router call.
- Specific Agent task with invalid `agentId` emits `task-failed` with `INVALID_ROUTING_TARGET`.
- Predefined Workflow task with valid `workflowId` emits `routing-resolved` with that `workflowId` and no AI router call.
- Auto-routing with empty registry emits `task-failed` with `NO_AVAILABLE_ROUTING_TARGET`.
- `routing-resolved` is always emitted before `task-started` and the six-stage timeline.
- `FAIL_SIMULATION:` behavior is unchanged.

**Dependencies**: Task 3, Task 4.

---

## 6. Service Configuration Extension and Health Endpoint Update

**Objective**: Add AI routing configuration environment variables and extend the health endpoint to report model provider information.

**Scope**:
- New environment variables: `MODEL_PROVIDER`, `LOCAL_MODEL_BASE_URL`, `LOCAL_MODEL_NAME`, `REMOTE_MODEL_BASE_URL`, `REMOTE_MODEL_API_KEY`, `REMOTE_MODEL_NAME`, `MODEL_TIMEOUT_MS`.
- Startup validation: if `MODEL_PROVIDER=local` and `LOCAL_MODEL_BASE_URL` or `LOCAL_MODEL_NAME` is missing, fail fast with a clear error message.
- Startup validation: if `MODEL_PROVIDER=remote` and `REMOTE_MODEL_BASE_URL`, `REMOTE_MODEL_API_KEY`, or `REMOTE_MODEL_NAME` is missing, fail fast.
- Health endpoint extended response: add `modelProvider` field with `type` and `modelName` (when applicable); redact API key completely.

**Acceptance Criteria**:
- `GET /api/v1/health` response includes `modelProvider: { type: "mock" }` when `MODEL_PROVIDER=mock`.
- `GET /api/v1/health` response includes `modelProvider: { type: "local", modelName: "<configured>" }` when `MODEL_PROVIDER=local`.
- Service startup fails with a clear message when required model provider environment variables are missing.
- `REMOTE_MODEL_API_KEY` does not appear in any log line or health response.
- Default `MODEL_PROVIDER=mock` requires no additional environment variables.

**Dependencies**: Task 5.

---

## 7. Spec, Validation, and Acceptance Verification

**Objective**: Validate all new and modified specs, run full OpenSpec validation, and confirm zero regression.

**Scope**:
- Delta spec for `task-routing-ai` capability is complete and passes strict validation.
- Delta spec for `task-orchestration-service` (modified: routing integration) is complete and passes strict validation.
- Delta spec for `task-orchestration-provider` (modified: extended `routing-resolved` payload) is complete and passes strict validation.
- `openspec validate "enable-ai-assisted-task-routing" --strict` exits 0.
- `openspec validate --all --strict` exits 0.
- `npm test` exits 0 (no frontend regression).
- `npm run build` exits 0.
- All scenarios in previous change specs (`establish-task-orchestration-provider-contracts`, `add-python-task-orchestration-service`) remain satisfied.

**Acceptance Criteria**:
- All three OpenSpec validations pass.
- No frontend test regresses.
- Mock model provider produces correct `routing-resolved` event in the end-to-end task flow.
- Fallback path produces `routing-resolved` with `is_fallback: true` in the end-to-end flow.

**Dependencies**: Task 6.
