## ADDED Requirements

### Requirement: Idempotent OpenClaw Agent Materialization

Task & Orchestration SHALL materialize OpenClaw agent artifacts idempotently before emitting a native OpenClaw agent header. For the same workspace agent, concurrent materialization requests SHALL share one in-flight operation, unchanged runtime profiles SHALL reuse the prior materialized mapping, and failed attempts SHALL be retryable by later requests.

#### Scenario: Coalesce concurrent materialization

- **GIVEN** two task execution paths request materialization for the same workspace agent at the same time
- **WHEN** the runtime profile is unchanged
- **THEN** Task & Orchestration SHALL execute only one filesystem and OpenClaw mirror operation for that workspace agent
- **AND** both callers SHALL receive the same materialized native mapping

#### Scenario: Reuse unchanged materialized profile

- **GIVEN** a workspace agent has already been materialized successfully
- **WHEN** a later request uses a runtime profile with the same `updatedAt`
- **THEN** Task & Orchestration SHALL reuse the existing materialized native mapping
- **AND** it SHALL NOT call the OpenClaw artifact mirror again

#### Scenario: Retry after failed materialization

- **GIVEN** materialization or OpenClaw artifact mirroring fails for a workspace agent
- **WHEN** a later request attempts to materialize the same agent again
- **THEN** Task & Orchestration SHALL retry the materialization instead of reusing the failed in-flight state
- **AND** it SHALL omit the native OpenClaw header until a successful native mapping is available

#### Scenario: Avoid duplicate mirror calls

- **GIVEN** filesystem materialization succeeds and the OpenClaw artifact mirror returns a native agent mapping
- **WHEN** the materialization operation completes
- **THEN** Task & Orchestration SHALL have invoked the artifact mirror only once for that materialization attempt
