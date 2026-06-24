# Workflow Management Module

Owner: Member 7

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

## Boundary

- Own workflow definitions, validation, editing, listing, and publish state.
- Trigger execution by creating or requesting a task run.
- Do not own task execution logs or final result aggregation.

## Workflow Contract and Execution Handoff Rules

The `WorkflowManagement` module is responsible for storing and managing workflows. However, it does not execute them.

1. **Handoff Interface**: When a user runs a workflow, `WorkflowUseCases.executeWorkflow` wraps the workflow data into an `ExecuteWorkflowRequest` payload.
2. **Delegation**: It then calls `handoffExecution(request)` on the injected `WorkflowExecutionHandoff` port.
3. **Orchestration**: The `Task Orchestration` module must implement this port, receive the request, and handle the step-by-step execution, logging, and integration with the simulated agents.
4. **Data Isolation**: Workflow Management must not directly invoke Agent services or manipulate Execution Lifecycle logs.
