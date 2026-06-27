## Why

The platform exists to create and manage virtual company workspaces backed by OpenClaw runtime instances. This change defines workspace listing, creation, detail loading, and deletion.

## What Changes

- Add workspace list with status and timestamps.
- Add workspace creation with name and requested provisioning profile; backend resolves entitlement and immutable provisioning snapshot.
- Trigger OpenClaw provisioning through a durable Workspace operation/outbox boundary before any external runtime call.
- Add workspace detail view for Workspace core metadata/configuration/lifecycle state. In milestone 1, agent/workflow/tool summaries are loaded from their owning modules' public endpoints instead of backend aggregation inside Workspace Management.
- Add workspace deletion that marks deleting state, records deprovision operation, and only finalizes deletion after runtime cleanup succeeds or is proven unnecessary.
- Add design-hardening gates for authorization, entitlement, idempotency, event behavior, worker lease/retry semantics, and race-condition handling before implementation starts.
- Close Round 3 P0 gaps by separating Workspace `lifecycleVersion` from
  per-aggregate `eventSequence`, hardening outbox publisher lease/dead-letter
  recovery, adding a delete/provision finality barrier, replacing merged source
  pagination with candidate filtering, and making legacy migration fail closed
  when runtime state cannot be proven.
- Canonicalize owner bootstrap acknowledgement events, operation family
  uniqueness, DELETE retry behavior for `delete_failed`, public API error
  taxonomy, and the gated Phase 4.5 local/demo OpenClaw adapter roadmap.
- Close Final Phase 1 admission P0 gaps by separating Workspace event
  aggregate ownership from Workspace Membership bootstrap acknowledgement
  aggregate ownership, adding `WorkspaceCommandReceipt`,
  `WorkspaceVisibilityProjection`, and `ProcessedDomainEvent` logical models,
  requiring `Idempotency-Key` for every DELETE command, clarifying
  non-destructive deletion-requested semantics, and defining manual
  reconciliation for unknown runtime outcomes.

## Capabilities

### New Capabilities
- `workspace-management`: Workspace lifecycle, OpenClaw provisioning requests, workspace details, and runtime cleanup coordination.

### Modified Capabilities
- `shared-contracts`: Workspace lifecycle statuses, public DTOs, Workspace
  error codes, `system.unavailable`, cursor pagination envelope, versioned
  Workspace event payloads with `lifecycleVersion` and `eventSequence`,
  separate Workspace Membership bootstrap acknowledgement event envelopes, and
  API/idempotency contract proposals must be added before implementation uses
  them.
- `platform-data-model-boundaries`: Workspace-owned lifecycle fields,
  `WorkspaceProvisioningOperation`, generic outbox event records, compatibility
  mapping from legacy `Workspace` skeleton/status values, migration provenance
  and runtime verification fields, `WorkspaceCommandReceipt`,
  `WorkspaceVisibilityProjection`, `ProcessedDomainEvent` or approved inbox
  strategy, outbox publisher recovery fields, and manual partial unique index
  strategy by `operationFamily` are required for Phase 1.
- `api-route-boundaries`: Workspace routes remain the four milestone 1 public
  endpoints, with `POST /api/workspaces` and every
  `DELETE /api/workspaces/:workspaceId` command requiring an
  `Idempotency-Key` header, and async `202 Accepted` responses.
- `platform-architecture`: Workspace runtime provisioning must use the
  Workspace operation worker plus outbox publisher topology; no controller,
  domain service, or generic outbox dispatcher may issue duplicate provider
  provision/deprovision commands. The outbox publisher publishes events only.
- `team-workflow`: Phase gates must include readiness review approval,
  conflict resolution, migration compatibility tests, lease/zombie-worker
  tests, event/outbox tests, operation-family uniqueness tests, delete/provision
  finality tests, bootstrap acknowledgement and inbox tests, visibility
  projection pagination tests, command receipt tests, deletion event semantics
  tests, manual runtime reconciliation gates, and architecture import
  enforcement before merge.

## Impact

- Backend module: `apps/backend/src/modules/workspace-management`
- Frontend feature: `apps/frontend/src/features/workspace-management`
- Worker job: `apps/workers/src/jobs/openclaw-provisioning`
- Shared contracts/infrastructure: Workspace DTOs, lifecycle statuses, error codes, versioned events, outbox, OpenClaw runtime adapter, database, logging
- Related modules consume workspace context but do not import workspace internals

## Milestone 1 Exclusions

- No public retry endpoints until a reviewed permission and API contract are approved.
- No production Docker/OpenClaw adapter implementation in the design-hardening phase.
- No Workspace writes to membership, subscription, agent, workflow, tool, task, credential, document, or vector/RAG tables.
- No fake Workspace production UI state.
- No Prisma migration, schema edit, controller/API route, worker handler,
  production UI, or provider adapter is created in this design-hardening round.
- Local/demo OpenClaw adapter implementation is deferred to a gated Phase 4.5
  plan and must not be claimed production-ready by this change.
