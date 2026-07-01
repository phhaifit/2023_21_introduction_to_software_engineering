## ADDED Requirements

### Requirement: Runtime Profile Freshness Boundary for Materialization

The runtime profile `updatedAt` timestamp SHALL define the freshness boundary for OpenClaw materialization reuse. If a profile changes, subsequent materialization SHALL regenerate artifacts and native mapping from the updated profile.

#### Scenario: Changed runtime profile rematerializes artifacts

- **GIVEN** a workspace agent has already been materialized from a runtime profile
- **WHEN** Agent Management later returns the same agent with a different `updatedAt`
- **THEN** Task & Orchestration SHALL treat the profile as changed
- **AND** it SHALL regenerate OpenClaw-facing artifacts before using the agent for execution
