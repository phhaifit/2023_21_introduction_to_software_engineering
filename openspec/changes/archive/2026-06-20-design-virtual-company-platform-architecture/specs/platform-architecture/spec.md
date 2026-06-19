## ADDED Requirements

### Requirement: Modular Monolith Architecture
The project SHALL use a modular monolith architecture with vertical-slice boundaries for the nine future product capabilities.

#### Scenario: Capability boundary exists
- **WHEN** a team member starts a future capability implementation
- **THEN** the repository provides a dedicated backend module folder and frontend feature folder for that capability

#### Scenario: No cross-module private imports
- **WHEN** one capability needs behavior owned by another capability
- **THEN** it uses a public contract, API, event, or adapter rather than importing private internal files from the other capability

### Requirement: Workspace Tenant Boundary
The architecture SHALL treat `workspaceId` as the primary tenant boundary for workspace-scoped business data.

#### Scenario: Workspace-scoped entity
- **WHEN** a module defines workspace-owned data such as agents, tools, workflows, tasks, documents, or runtime metadata
- **THEN** that data is associated with a `workspaceId`

### Requirement: External Integration Boundary
The architecture SHALL keep OpenClaw, payment, OAuth, messaging, and vector database integrations behind adapters or worker jobs.

#### Scenario: OpenClaw provisioning
- **WHEN** workspace runtime provisioning is needed
- **THEN** the workspace/runtime layer uses the OpenClaw adapter boundary rather than direct runtime calls inside feature modules

### Requirement: Async Worker Boundary
The architecture SHALL route slow or retryable work through workers instead of blocking HTTP request handling.

#### Scenario: Slow operation requested
- **WHEN** an operation involves OpenClaw provisioning, payment callbacks, document ingestion, or long-running task execution
- **THEN** the system records state and delegates the slow operation to a worker job
