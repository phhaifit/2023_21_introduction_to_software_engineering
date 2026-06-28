# task-orchestration-http-api Specification

## Purpose
Defines the Express API router (`createTaskOrchestrationRouter`) exposed by Task & Orchestration to handle task execution initiation, cancellation forwarding, and state monitoring.

## Requirements

### Requirement: Task Orchestration Express API Router

The Task & Orchestration module SHALL expose an Express API router (`createTaskOrchestrationRouter`) to handle task execution initiation, cancellation forwarding, and state monitoring.

#### Scenario: Successful execution initiation via API

* **GIVEN** a valid `StartExecutionCommand` payload is submitted to `POST /api/workspaces/:workspaceId/executions/start`
* **WHEN** the router processes the request
* **THEN** it SHALL invoke `execute10StepStartFlow` on the `OpenClawExecutionOrchestrator`
* **AND** it SHALL return the resulting `ExecutionBinding` and initial status

#### Scenario: Successful cancellation forwarding via API

* **GIVEN** a cancellation request is submitted to `POST /api/workspaces/:workspaceId/executions/:taskId/cancel`
* **WHEN** the router processes the request
* **THEN** it SHALL invoke `forwardCancellation` on the `OpenClawExecutionOrchestrator`
* **AND** it SHALL NOT terminate or delete the underlying OpenClaw container

#### Scenario: Successful state inspection via API

* **GIVEN** a state inspection request is submitted to `GET /api/workspaces/:workspaceId/executions/:taskId/state`
* **WHEN** the router processes the request
* **THEN** it SHALL invoke `getExposedState` on the `OpenClawExecutionOrchestrator`
* **AND** it SHALL return the canonical task status and accumulated event logs
