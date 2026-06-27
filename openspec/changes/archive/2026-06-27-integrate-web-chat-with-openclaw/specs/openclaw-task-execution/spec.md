## ADDED Requirements

### Requirement: OpenClaw Transport Server Registration

The backend server runtime SHALL register `OpenClawHttpSSETransport` configured to communicate with the physical OpenClaw Gateway container on port 18789.

#### Scenario: Server initializes OpenClaw network transport

* **GIVEN** the local agent management server starts up
* **WHEN** `createLocalAgentManagementRuntime` executes
* **THEN** it SHALL instantiate `OpenClawHttpSSETransport` pointing to `http://127.0.0.1:18789`
* **AND** it SHALL inject the transport into `OpenClawTaskExecutionAdapter` and `OpenClawExecutionOrchestrator`
* **AND** it SHALL mount the Task Orchestration Express API router
