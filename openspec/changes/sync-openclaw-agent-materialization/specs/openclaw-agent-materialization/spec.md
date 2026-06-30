# openclaw-agent-materialization Specification

## Purpose

Define how platform Agent Management runtime profiles are materialized into
OpenClaw-facing agent artifacts and exposed to Task Execution as verified native
OpenClaw agent IDs.

## ADDED Requirements

### Requirement: Materialize Enabled Agent Runtime Profiles

The system SHALL materialize enabled Agent Management runtime profiles into an
OpenClaw-facing workspace when an OpenClaw agent materializer is configured.

#### Scenario: Enabled agent materialized

- **WHEN** Task Execution asks for an enabled agent contract
- **THEN** the OpenClaw integration boundary obtains the public Agent Management runtime profile
- **AND** writes the runtime profile skill artifact to the configured OpenClaw agent workspace
- **AND** returns a native OpenClaw agent ID only after materialization succeeds

#### Scenario: Materializer unavailable

- **WHEN** no OpenClaw agent materializer is configured
- **THEN** Task Execution still receives platform routing context
- **AND** it does not receive a native OpenClaw agent ID

#### Scenario: Materialized artifacts mirrored to local Gateway container

- **WHEN** local Docker mirroring is configured for the OpenClaw Gateway container
- **THEN** the materializer copies the completed workspace artifact directory into the configured Gateway container path after writing filesystem artifacts
- **AND** it performs no container provisioning, secret inspection, or Gateway credential creation

### Requirement: Native Agent Header Safety

Task Execution SHALL send `x-openclaw-agent-id` only for verified native OpenClaw
agent IDs produced by the OpenClaw materialization boundary.

#### Scenario: Verified native agent selected

- **WHEN** a specific agent selection resolves to a materialized native OpenClaw agent
- **THEN** the OpenClaw network transport request includes that native ID

#### Scenario: Platform-only agent selected

- **WHEN** a specific agent selection has no verified native OpenClaw ID
- **THEN** the OpenClaw network transport request omits `x-openclaw-agent-id`
- **AND** keeps the platform agent metadata in routing context

### Requirement: Agent Management Remains Control Plane Only

Agent Management SHALL remain responsible for agent configuration and runtime
profiles, but SHALL NOT call the OpenClaw Gateway or manage OpenClaw containers.

#### Scenario: Agent Management profile consumed by materializer

- **WHEN** OpenClaw integration needs agent runtime data
- **THEN** it consumes the public Agent Management runtime profile boundary
- **AND** Agent Management performs no OpenClaw runtime calls
