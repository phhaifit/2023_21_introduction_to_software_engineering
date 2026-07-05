## MODIFIED Requirements

### Requirement: Observability as Projection Only
Task & Orchestration SHALL act strictly as an observability projection consumer. It SHALL display or project activity supplied by the provider but SHALL NOT create tools, assign tools to agents, create sub-agents, control OpenClaw internal orchestration, create workflows, or infer events that were not provided. Safe provider activity supplied by OpenClaw for an active task SHALL be projected into the execution feed, inspector, and active chat progress summary.

#### Scenario: Project provider tool activity
* **GIVEN** an external OpenClaw runtime emits tool activity events
* **WHEN** Task & Orchestration receives the events via the adapter boundary
* **THEN** it SHALL project the tool activity in the execution feed and inspector
* **AND** it SHALL NOT attempt to create or administer tools in external module catalogs

#### Scenario: Project sub-agent collaboration activity
* **GIVEN** an external OpenClaw runtime emits sub-agent coordination events
* **WHEN** Task & Orchestration receives the events via the adapter boundary
* **THEN** it SHALL project the sub-agent activity in the execution feed
* **AND** it SHALL NOT attempt to control OpenClaw internal orchestration mechanics

#### Scenario: Project provider activity into active chat progress
* **GIVEN** an active OpenClaw task receives safe provider activity
* **WHEN** the frontend consumes the normalized runtime event
* **THEN** the assistant progress summary SHALL show the current provider activity label
* **AND** the projection SHALL be derived from Task state and runtime event payloads rather than provider-specific UI branches
