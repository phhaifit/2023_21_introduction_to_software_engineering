## Why

Virtual employees are the core working units in each company workspace. This change defines how users create, configure, activate, deactivate, and remove agents.

## What Changes

- Add agent list with name, status, role, and model.
- Add agent creation with name, role, model, and instructions.
- Persist agent configuration and generate or update `skill.md` content through the module boundary.
- Add agent editing and instruction configuration.
- Add enable, disable, and delete actions.

## Capabilities

### New Capabilities
- `agent-management`: Workspace-scoped agent CRUD, skill configuration, activation state, model selection, and agent lifecycle management.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `backend/src/modules/agent-management`
- Frontend feature: `frontend/src/features/agent-management`
- Shared contracts: agent IDs, lifecycle statuses, API responses, and domain events
- Related modules: task orchestration, workflow management, tools integration, and knowledge base use agent public contracts only
