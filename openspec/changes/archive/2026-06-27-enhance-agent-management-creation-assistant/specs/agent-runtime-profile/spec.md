## ADDED Requirements

### Requirement: OpenClaw Ready Agent Runtime Profile
The system SHALL expose a server-side public Agent Management runtime profile for Task Orchestration and OpenClaw integration.

#### Scenario: Runtime profile returned for enabled agent
- **WHEN** Task Orchestration requests the runtime profile for an enabled agent in the same workspace through the public Agent Management boundary
- **THEN** the system returns agent identity, workspace identity, display name, role, catalog-selected model, instructions, status, updated timestamp, canonical `skill.md` content, runtime materialization hints, and non-permission configuration sections needed to prepare an OpenClaw agent workspace

#### Scenario: Runtime profile unavailable for non-runnable agent
- **WHEN** Task Orchestration requests the runtime profile for a disabled, deleted, missing, or cross-workspace agent
- **THEN** the system rejects the request without exposing private agent configuration for OpenClaw execution

### Requirement: Runtime Configuration Persistence
The system SHALL persist non-permission assistant and template configuration needed to reconstruct runtime-ready agent output after creation.

#### Scenario: Rich draft fields survive creation
- **WHEN** a manager submits a valid template, prompt assistant, or imported `skill.md` draft with responsibilities, operating context, constraints, escalation rules, example tasks, requested tools, or requested knowledge intent
- **THEN** the created agent retains those non-permission configuration fields for future `skill.md` download, runtime profile lookup, and OpenClaw materialization

#### Scenario: Existing basic agents remain compatible
- **WHEN** an existing agent only has name, role, model, and instructions
- **THEN** the runtime profile and `skill.md` output render optional runtime sections safely without requiring a data migration to invent missing content

### Requirement: Runtime Profile Permission Safety
The system SHALL treat runtime profile tool and knowledge references as intent metadata rather than executable permission.

#### Scenario: Runtime profile excludes credentials and grants
- **WHEN** the runtime profile includes requested tool or knowledge intent
- **THEN** the profile does not include raw credentials, provider API keys, real tool assignment records, real knowledge grant records, or private Tools/KB implementation details

#### Scenario: Task orchestration resolves current permissions
- **WHEN** Task Orchestration builds an OpenClaw runtime manifest from an Agent Management runtime profile
- **THEN** it must resolve current tool assignments and KB/RAG grants through Tools Integration and KB/RAG public boundaries before allowing OpenClaw execution

### Requirement: Runtime Profile Lifecycle Consistency
The system SHALL keep runtime profile output consistent with Agent Management lifecycle operations.

#### Scenario: Runtime profile reflects agent update
- **WHEN** a manager updates agent role, model, instructions, or runtime configuration sections
- **THEN** subsequent runtime profile lookups and `skill.md` downloads reflect the updated configuration

#### Scenario: Disabled agent cannot be materialized as runnable
- **WHEN** a manager disables or deletes an agent
- **THEN** the runtime profile boundary no longer returns that agent as runnable for OpenClaw task execution

### Requirement: No Direct OpenClaw Runtime Calls
Agent Management SHALL NOT execute OpenClaw terminal commands, call the OpenClaw Gateway, or write OpenClaw `agents.list[]` runtime configuration as part of this change.

#### Scenario: Agent creation remains control-plane only
- **WHEN** Agent Management creates or updates an agent
- **THEN** it stores Agent Management configuration and artifacts only, leaving OpenClaw workspace materialization, Gateway calls, runtime manifests, streaming, logs, and cancellation to Task Orchestration / OpenClaw integration
