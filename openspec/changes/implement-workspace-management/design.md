## Context

Workspace Management owns workspace metadata and runtime lifecycle coordination for OpenClaw-backed workspaces. It does not own membership, subscription, agents, workflows, tools, credentials, tasks, or knowledge data.

## Goals / Non-Goals

**Goals:**

- Implement workspace list, creation, detail, and deletion with async provisioning lifecycle.
- Persist workspace metadata, resolved provisioning profile snapshot, non-secret runtime reference, lifecycle timestamps, operation state, and idempotency state.
- Resolve subscription entitlement before provisioning through `WorkspaceEntitlementPort`.
- Coordinate OpenClaw provisioning/deprovisioning through a durable operation record and outbox-backed worker.
- Expose Workspace core detail through `GET/POST/DELETE /api/workspaces` routes.

**Non-Goals:**

- Implement agent, workflow, tool, credential, task, or knowledge base CRUD.
- Write `WorkspaceMember`, subscription, agent, workflow, or task tables directly.
- Direct Docker/OpenClaw calls from controllers or domain services.
- Public retry endpoints for milestone 1.

## Decisions

1. Authorization uses `WorkspaceAccessQueryPort` (owned by Workspace, implemented by Workspace User Management). Bootstrap creator access is time-bounded via `ownerBootstrapAttemptId/Version/ExpiresAt` while membership is pending.

2. Workspace list uses a `WorkspaceVisibilityProjection` fed by Workspace User Management access events. Direct detail/delete always use `WorkspaceAccessQueryPort.getWorkspaceAccess`.

3. `POST /api/workspaces` and every `DELETE /api/workspaces/:workspaceId` require an `Idempotency-Key` HTTP header persisted through `WorkspaceCommandReceipt`.

4. Operations use a Workspace-owned worker polling `WorkspaceProvisioningOperation` with lease, retry, and a separate outbox publisher for domain events. The outbox publisher never dispatches provider commands.

5. Provider calls use a stable `providerRequestKey`; retry after unknown outcome must reconcile before issuing a new command. `runtime_absent_final` is required before deprovision can succeed as idempotent.

6. `workspace.deletion_requested.v1` is non-destructive guidance only. Only `workspace.deleted.v1` may trigger irreversible downstream cleanup.

7. Workspace `lifecycleVersion` is for lifecycle optimistic concurrency only. Each outbox event uses a separate per-Workspace strictly-increasing `eventSequence`.

8. Consumers use a `ProcessedDomainEvent` inbox policy deduplicating by `(consumerName, eventId)` in the same transaction as state mutation.

9. Legacy `running` rows without runtime proof map to `provisioning` with `runtimeVerificationState=manual_review_required`, not `active`.

## Risks / Trade-offs

- [Risk] Operation worker and outbox publisher could both dispatch provider commands.
  - Mitigation: Outbox publisher is event-only; provision/deprovision commands are issued only by the operation worker.
- [Risk] Unknown runtime outcome after max retries leaves workspace stuck.
  - Mitigation: Terminal `runtimeFinalityProof=runtime_unknown` triggers a manual reconciliation runbook; no metadata is deleted automatically.
- [Risk] Projection lag can cause stale list results.
  - Mitigation: Direct detail/delete always call the authoritative access port, not the projection.
- [Risk] Milestone 1 uses InMemory repos locally; real PostgreSQL partial unique indexes and transaction atomicity are unverified.
  - Mitigation: Deferred to Phase 1 PostgreSQL verification gate before production rollout.
