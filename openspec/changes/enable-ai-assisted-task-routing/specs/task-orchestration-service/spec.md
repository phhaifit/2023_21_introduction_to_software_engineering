# Task Orchestration Service — AI Routing Integration Delta Specification

## MODIFIED Requirements

### Requirement: AI Routing Integration in Mock Executor

For Auto-routing tasks, the Python mock executor SHALL invoke the configured `ModelProvider`, validate the resulting decision, and emit `routing-resolved` before starting the six-stage timeline.

#### Scenario: Auto-routing emits routing-resolved before timeline starts

* **GIVEN** a task is created with `mode: "auto"`
* **WHEN** the mock executor begins execution
* **THEN** the executor SHALL invoke the configured `ModelProvider`
* **AND** SHALL validate the resulting `RoutingDecision`
* **AND** SHALL emit `routing-resolved` carrying the resolved target, confidence, reason, `is_fallback`, and provider metadata
* **AND** the six-stage orchestration timeline SHALL start after `routing-resolved` is emitted

#### Scenario: Fallback routing proceeds without halting the task

* **GIVEN** the `ModelProvider` returns a fallback decision (due to timeout, error, or invalid output)
* **WHEN** `routing-resolved` is emitted
* **THEN** the event SHALL carry `is_fallback: true` with the fallback target and reason
* **AND** the orchestration timeline SHALL continue with the fallback target
* **AND** the task SHALL NOT fail due to routing fallback alone

#### Scenario: Routing failure halts task with explicit error

* **GIVEN** no routing target is available (empty registry)
* **WHEN** the routing step executes
* **THEN** the executor SHALL emit `task-failed` with error code `NO_AVAILABLE_ROUTING_TARGET`
* **AND** the orchestration timeline SHALL NOT start

---

### Requirement: Extended routing-resolved Event Payload

The `routing-resolved` `TaskRuntimeEvent` SHALL carry `confidence`, `reason`, `is_fallback`, and optional `provider_metadata` fields in addition to the resolved target.

#### Scenario: routing-resolved carries AI routing metadata for auto-routing

* **GIVEN** Auto-routing resolved a target via AI router
* **WHEN** `routing-resolved` is emitted
* **THEN** the event payload SHALL include `confidence` (float)
* **AND** SHALL include `reason` (non-empty string)
* **AND** SHALL include `is_fallback` (boolean)
* **AND** SHALL include `provider_metadata` with at minimum the provider type

#### Scenario: routing-resolved for non-auto routing modes carries no AI metadata

* **GIVEN** routing mode is Specific Agent or Predefined Workflow
* **WHEN** `routing-resolved` is emitted
* **THEN** the event payload SHALL include the resolved `target_id`
* **AND** `confidence` MAY be absent or zero
* **AND** `is_fallback` SHALL be `false`
* **AND** `provider_metadata` MAY be absent
