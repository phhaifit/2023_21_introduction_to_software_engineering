## Context

Workspace management owns the lifecycle of virtual company workspaces and coordinates OpenClaw runtime provisioning through the shared adapter and worker boundary. Other modules are workspace-scoped and must use `workspaceId` instead of managing runtime containers directly.

## Goals / Non-Goals

**Goals:**
- Implement workspace list, creation, detail loading, and deletion.
- Persist workspace metadata and lifecycle status.
- Enqueue OpenClaw provisioning and cleanup through worker jobs.
- Expose workspace details needed by the frontend without importing other modules' private internals.

**Non-Goals:**
- Implement agent, workflow, tool, or knowledge base CRUD inside this module.
- Direct Docker/OpenClaw calls from HTTP controllers.
- Kubernetes or production-grade runtime scheduling for V1.

## Decisions

1. Use asynchronous provisioning for workspace creation.
   - Rationale: OpenClaw startup may be slow or fail transiently, so HTTP should create state and enqueue work.
   - Alternative considered: Block the create request until OpenClaw is fully running. Rejected because it creates poor UX and timeout risk.

2. Make `workspaceId` the required tenant boundary for workspace-scoped data.
   - Rationale: It aligns with the foundation architecture and lets modules work independently.
   - Alternative considered: Use user-owned data without workspace tenant IDs. Rejected because collaboration and RBAC require workspace scope.

3. Treat detail aggregation as read-model composition through public contracts.
   - Rationale: Details need agents, workflows, and tools, but workspace management should not import private module repositories.
   - Alternative considered: Query other modules' tables directly from workspace internals. Rejected because it breaks module ownership.

4. Route runtime cleanup through the OpenClaw adapter.
   - Rationale: The adapter isolates runtime/container details and keeps future deployment options open.

## Risks / Trade-offs

- Provisioning can fail after workspace metadata is created -> Store clear statuses such as provisioning, active, failed, deleting.
- Workspace detail depends on future modules -> Return available sections and keep missing sections empty until modules are implemented.
- Deletion can affect many child records -> Use explicit lifecycle state and cleanup jobs rather than hard-deleting blindly in a request.
