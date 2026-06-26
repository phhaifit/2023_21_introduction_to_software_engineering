# Task Orchestration Provider — AI Routing Metadata Delta Specification

## MODIFIED Requirements

### Requirement: routing-resolved Event Payload Extension

The `routing-resolved` event payload SHALL be extended with optional `confidence`, `reason`, `is_fallback`, and `provider_metadata` fields. These fields are backward-compatible additions; existing frontend code that does not consume them continues to function correctly.

#### Scenario: Frontend renders routing metadata when present

* **GIVEN** a `routing-resolved` event carries `confidence`, `reason`, and `is_fallback` fields
* **WHEN** the execution feed renders the task card
* **THEN** the routing metadata SHALL be displayed if the rendering component supports it
* **AND** the absence of these fields in earlier events SHALL NOT cause a rendering error

#### Scenario: Frontend displays fallback notice when is_fallback is true

* **GIVEN** a `routing-resolved` event carries `is_fallback: true`
* **WHEN** the task card is rendered
* **THEN** the frontend SHALL display a notice indicating that fallback routing was applied
* **AND** the notice SHALL NOT misrepresent the fallback as a successful AI routing decision

#### Scenario: routing-resolved payload extension is backward-compatible

* **GIVEN** a `routing-resolved` event does not carry `confidence`, `reason`, or `is_fallback` fields
* **WHEN** the frontend processes the event
* **THEN** the frontend SHALL handle the absent fields gracefully without errors
* **AND** the task lifecycle SHALL continue normally
