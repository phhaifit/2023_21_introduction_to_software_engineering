## Why

Users need repeatable multi-agent processes instead of manually assigning every task. This change defines workflow creation, editing, listing, and execution requests.

## What Changes

- Add workflow list and detail views.
- Add workflow creation and editing for ordered agent steps.
- Add validation for referenced agents and workflow step definitions.
- Add workflow execution trigger.
- Emit workflow execution requests for task orchestration or worker processing.

## Capabilities

### New Capabilities
- `workflow-management`: Workflow definition, ordered agent steps, workflow validation, list/detail views, and execution initiation.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `backend/src/modules/workflow-management`
- Frontend feature: `frontend/src/features/workflow-management`
- Shared contracts: workflow IDs, workflow statuses, API responses, and domain events
- Related modules: agent management supplies agent references; task orchestration executes workflows through public contracts
