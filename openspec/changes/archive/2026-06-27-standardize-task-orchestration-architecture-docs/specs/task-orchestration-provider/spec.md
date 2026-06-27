## ADDED Requirements

### Requirement: Domain Capability Specification Harmonization
The `TaskOrchestrationClient` and `HttpTaskOrchestrationProvider` SHALL ensure full conceptual harmonization across all 7 domain-driven capability areas (core, routing, lifecycle, streaming, failure-cancellation, workspace, history). It SHALL enforce event-driven state bootstrapping and non-blocking initialization as the canonical operational standard across all workspace UI consumers.

#### Scenario: Enforce domain capability harmonization
* **GIVEN** `HttpTaskOrchestrationProvider` serves as the active `TaskOrchestrationClient`
* **WHEN** workspace UI components interact with the orchestration provider
* **THEN** it SHALL enforce event-driven state bootstrapping (`queued` to `running`)
* **AND** it SHALL maintain non-blocking execution initialization across all 7 domain capability areas
