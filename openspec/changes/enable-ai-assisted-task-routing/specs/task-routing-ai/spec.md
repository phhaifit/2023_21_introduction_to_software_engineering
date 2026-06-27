# Task Routing AI Specification

## ADDED Requirements

### Requirement: ModelProvider Contract

The Python orchestration service SHALL define a `ModelProvider` Protocol with a single method `generate_routing_decision` that accepts a `RoutingContext` and returns a `RoutingDecision`.

The `RoutingContext` SHALL include the task prompt, the list of available agents with their IDs and descriptions, and the list of available workflows with their IDs and descriptions.

#### Scenario: ModelProvider protocol is structurally typed

* **WHEN** a class implements `generate_routing_decision` matching the protocol signature
* **THEN** it SHALL satisfy the `ModelProvider` protocol without explicit subclassing

#### Scenario: RoutingContext includes available registry

* **WHEN** a `RoutingContext` is constructed for a routing decision call
* **THEN** it SHALL include the task prompt
* **AND** it SHALL include the full list of available agents with IDs and descriptions
* **AND** it SHALL include the full list of available workflows with IDs and descriptions

---

### Requirement: RoutingDecision Structured Output

The `RoutingDecision` SHALL be a structured type with required fields: `target_type`, `target_id`, `confidence`, `reason`, and `is_fallback`.

#### Scenario: RoutingDecision carries required fields

* **WHEN** a routing decision is produced by any model provider
* **THEN** it SHALL carry `target_type` as `"agent"` or `"workflow"`
* **AND** it SHALL carry `target_id` as a non-empty string
* **AND** it SHALL carry `confidence` as a float in [0.0, 1.0]
* **AND** it SHALL carry `reason` as a non-empty human-readable string
* **AND** it SHALL carry `is_fallback` as a boolean

#### Scenario: RoutingDecision rejects invalid confidence

* **WHEN** a routing decision is constructed with `confidence` outside [0.0, 1.0]
* **THEN** validation SHALL reject the decision

#### Scenario: RoutingDecision rejects empty reason

* **WHEN** a routing decision is constructed with an empty `reason`
* **THEN** validation SHALL reject the decision

---

### Requirement: MockModelProvider Determinism

The `MockModelProvider` SHALL produce a deterministic `RoutingDecision` without making any network call.

#### Scenario: MockModelProvider selects first available agent deterministically

* **GIVEN** the available agent registry includes `AGT-CODE`
* **WHEN** `MockModelProvider.generate_routing_decision` is called
* **THEN** it SHALL return a `RoutingDecision` with `target_type: "agent"` and `target_id: "AGT-CODE"`
* **AND** `is_fallback` SHALL be `false`
* **AND** `confidence` SHALL be greater than 0.0

#### Scenario: MockModelProvider works without network access

* **WHEN** `MockModelProvider.generate_routing_decision` is called with no network available
* **THEN** it SHALL return a valid `RoutingDecision` without error

---

### Requirement: LocalModelProvider Integration

The `LocalModelProvider` SHALL call an Ollama-compatible local model endpoint to obtain a routing decision.

#### Scenario: LocalModelProvider calls configured local model endpoint

* **GIVEN** `LOCAL_MODEL_BASE_URL` and `LOCAL_MODEL_NAME` are configured
* **WHEN** `LocalModelProvider.generate_routing_decision` is called
* **THEN** it SHALL send a request to the Ollama-compatible chat endpoint
* **AND** it SHALL include the structured routing prompt with available agents and workflows

#### Scenario: LocalModelProvider returns fallback on timeout

* **GIVEN** the local model call exceeds `MODEL_TIMEOUT_MS`
* **WHEN** the call times out
* **THEN** `LocalModelProvider` SHALL return a fallback `RoutingDecision` with `is_fallback: true`
* **AND** the `reason` SHALL indicate that the model timed out

#### Scenario: LocalModelProvider returns fallback on invalid model output

* **GIVEN** the local model returns a response that is not valid JSON or does not match `RoutingDecision` fields
* **WHEN** the response is parsed
* **THEN** `LocalModelProvider` SHALL return a fallback `RoutingDecision` with `is_fallback: true`

---

### Requirement: RemoteModelProvider Integration

The `RemoteModelProvider` SHALL call an OpenAI-compatible remote model API to obtain a routing decision, using credentials from the service environment only.

#### Scenario: RemoteModelProvider sends API key in Authorization header only

* **GIVEN** `REMOTE_MODEL_API_KEY` is set in the service environment
* **WHEN** `RemoteModelProvider.generate_routing_decision` calls the remote API
* **THEN** the API key SHALL be sent in the `Authorization: Bearer` header
* **AND** the API key SHALL NOT appear in any service log entry
* **AND** the API key SHALL NOT appear in any service HTTP response body

#### Scenario: RemoteModelProvider returns fallback on API error

* **GIVEN** the remote model API returns a 4xx or 5xx response or is unreachable
* **WHEN** the call fails
* **THEN** `RemoteModelProvider` SHALL return a fallback `RoutingDecision` with `is_fallback: true`

#### Scenario: RemoteModelProvider returns fallback on invalid model output

* **GIVEN** the remote model returns text that is not a valid `RoutingDecision`
* **WHEN** the response is parsed
* **THEN** `RemoteModelProvider` SHALL return a fallback `RoutingDecision` with `is_fallback: true`

---

### Requirement: Routing Decision Validation

The AI router SHALL validate a `RoutingDecision` before accepting it, regardless of which model provider produced it.

#### Scenario: Valid decision is accepted

* **GIVEN** a `RoutingDecision` carries a `target_id` that exists in the appropriate registry and the target is available
* **WHEN** the routing decision validator runs
* **THEN** the decision SHALL be accepted and used as the resolved routing target

#### Scenario: Unknown target ID triggers fallback

* **GIVEN** a `RoutingDecision` carries a `target_id` not present in the registry
* **WHEN** the routing decision validator runs
* **THEN** the decision SHALL be rejected
* **AND** a fallback `RoutingDecision` SHALL be applied with `is_fallback: true`

#### Scenario: Unavailable target triggers fallback

* **GIVEN** a `RoutingDecision` carries a `target_id` that exists but is marked unavailable
* **WHEN** the routing decision validator runs
* **THEN** the decision SHALL be rejected
* **AND** a fallback `RoutingDecision` SHALL be applied

#### Scenario: Empty registry produces NO_AVAILABLE_ROUTING_TARGET error

* **GIVEN** neither agents nor workflows are available in the registry
* **WHEN** the routing decision validator is called for an Auto-routing task
* **THEN** the validator SHALL NOT apply fallback
* **AND** it SHALL surface error code `NO_AVAILABLE_ROUTING_TARGET`
* **AND** the task SHALL transition to Failed with that error code

---

### Requirement: Routing Safety Constraints

The AI routing subsystem SHALL enforce safety constraints preventing model output from directly controlling task execution without validation.

#### Scenario: Model output is never used without structural validation

* **WHEN** any model provider returns a routing decision
* **THEN** the decision SHALL pass structural validation before being used
* **AND** the orchestration pipeline SHALL NOT accept free-form model text as a routing target

#### Scenario: Model cannot select a non-existent target

* **GIVEN** a model provider returns a `target_id` that is not in the available registry
* **WHEN** validation runs
* **THEN** the target SHALL be rejected
* **AND** fallback SHALL apply

#### Scenario: Fallback does not misrepresent itself as AI routing success

* **GIVEN** fallback is applied due to model failure or invalid output
* **WHEN** the `routing-resolved` event is emitted
* **THEN** `is_fallback` SHALL be `true`
* **AND** the `reason` SHALL describe why fallback was applied

#### Scenario: Specific agent routing does not invoke AI router

* **GIVEN** the task routing mode is Specific Agent
* **WHEN** the routing step executes
* **THEN** the AI router SHALL NOT be called
* **AND** the `ModelProvider` SHALL NOT be invoked

#### Scenario: Predefined workflow routing does not invoke AI router

* **GIVEN** the task routing mode is Predefined Workflow
* **WHEN** the routing step executes
* **THEN** the AI router SHALL NOT be called
* **AND** the `ModelProvider` SHALL NOT be invoked

---

### Requirement: Target Availability Validation for Non-Auto Routing

User-selected routing targets SHALL be validated for existence and availability before task execution begins.

#### Scenario: Valid specific agent target is accepted

* **GIVEN** the user selected Specific Agent with a valid and available `agentId`
* **WHEN** target validation runs
* **THEN** the agent SHALL be accepted as the resolved routing target
* **AND** `routing-resolved` SHALL be emitted with that `agentId`

#### Scenario: Invalid specific agent target produces task failure

* **GIVEN** the user selected Specific Agent with an `agentId` that does not exist or is unavailable
* **WHEN** target validation runs
* **THEN** the task SHALL fail with error code `INVALID_ROUTING_TARGET`
* **AND** the orchestration timeline SHALL NOT start

#### Scenario: Valid predefined workflow target is accepted

* **GIVEN** the user selected Predefined Workflow with a valid and available `workflowId`
* **WHEN** target validation runs
* **THEN** the workflow SHALL be accepted as the resolved routing target
* **AND** `routing-resolved` SHALL be emitted with that `workflowId`

#### Scenario: Invalid predefined workflow target produces task failure

* **GIVEN** the user selected Predefined Workflow with a `workflowId` that does not exist or is unavailable
* **WHEN** target validation runs
* **THEN** the task SHALL fail with error code `INVALID_ROUTING_TARGET`
* **AND** the orchestration timeline SHALL NOT start

---

### Requirement: Mock Routing Availability

The `MockModelProvider` SHALL remain available and functional regardless of local or remote model availability, ensuring the service can run in offline and demo scenarios.

#### Scenario: Mock routing available without network or model configuration

* **GIVEN** `MODEL_PROVIDER=mock` is configured
* **WHEN** the service runs without any local or remote model endpoint available
* **THEN** all Auto-routing tasks SHALL resolve using the mock provider
* **AND** the task lifecycle SHALL complete normally
