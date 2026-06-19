## Why

The project needs a shared architecture foundation before feature implementation starts so a 9-member team can work in parallel without inventing incompatible module boundaries, contracts, or repository structure. The current requirements define nine product domains, but this change is limited to the foundation that lets those domains be implemented safely in later changes.

## What Changes

- Establish a modular monolith architecture with vertical-slice boundaries for the nine future product modules.
- Define shared foundation contracts for IDs, roles, permissions, plans, lifecycle statuses, API responses, errors, and domain events.
- Scaffold the repository layout for frontend features, backend modules, shared contracts, workers, contract tests, and e2e tests.
- Add cross-cutting infrastructure interfaces for request context, RBAC, database migrations, event bus, OpenClaw runtime adapter, worker queue, and logging/secret redaction.
- Document module ownership, OpenSpec workflow, PR checklist, and foundation decisions that answer the design open questions.
- Defer detailed feature behavior and CRUD implementation for authentication, agents, tools, workflows, tasks, payments, workspaces, and RAG to separate per-module OpenSpec changes.

## Capabilities

### New Capabilities
- `platform-architecture`: Architectural style, tenant boundary, module ownership boundaries, async worker boundary, and integration boundary decisions.
- `shared-contracts`: Shared IDs, roles, permissions, plans, statuses, API response/error shape, domain events, and schema checks.
- `project-skeleton`: Repository layout for frontend, backend, workers, shared contracts, tests, and foundation infrastructure interfaces.
- `team-workflow`: Team ownership assignment, OpenSpec workflow, PR checklist, and rules for future per-module feature changes.

### Modified Capabilities
- None. There are no existing OpenSpec capability specs in `openspec/specs/`.

## Impact

- Affected planning artifacts: OpenSpec proposal, design, foundation specs, and foundation task checklist.
- Affected code areas: `shared/contracts`, `backend/src/shared`, `backend/src/modules/*`, `frontend/src/features/*`, `workers/src/jobs`, `tests/contract`, `tests/e2e`, and team-facing docs.
- Future per-module changes should create their own feature specs and tasks for authentication, subscription/payment, workspace management, workspace user management, agent management, tools/integration, workflow management, task/orchestration, and knowledge base/RAG.
- External systems remain behind adapters or placeholders at this stage; this change does not implement live OpenClaw, payment, OAuth, vector database, or messaging integrations.
