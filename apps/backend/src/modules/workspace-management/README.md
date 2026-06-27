# Workspace Management Module

## NOT PRODUCTION READY

Workspace Management is provisional. The API and frontend slices are implemented
for focused verification, but retained PostgreSQL, runtime, security, and
deployment evidence still block any production-readiness claim.

## Ownership Boundary

Workspace Management owns Workspace metadata, lifecycle state, provisioning and
deprovisioning operation records, command receipts, Workspace-owned outbox
events, visibility projections, and non-secret runtime references.

It does not own users, sessions, membership, invitations, roles, subscriptions,
agents, workflows, tools, tasks, documents, provider credentials, or raw runtime
configuration. Cross-module decisions use ports, public contracts, events, or
public APIs.

## Public API

- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/:workspaceId`
- `DELETE /api/workspaces/:workspaceId`

Public responses expose only safe Workspace core metadata, lifecycle status,
timestamps, requested profile intent, safe operation acknowledgement, and safe
failure summaries.

## Lifecycle

Canonical public statuses:

- `provisioning`
- `active`
- `failed`
- `deleting`
- `delete_failed`
- `deleted`

`deleted` is terminal. A Workspace cannot become `active` before provisioning
success is confirmed, and it cannot become `deleted` until runtime cleanup
succeeds or runtime absence is final.

## Idempotency

`POST /api/workspaces` and every public
`DELETE /api/workspaces/:workspaceId` require `Idempotency-Key`.

The canonical receipt scope is:

```text
actorUserId + commandType + commandTarget + idempotencyKey
```

Same scope and fingerprint replays the stored safe response. Same scope and key
with a different fingerprint returns an idempotency conflict. Different actors
or different command targets do not collide.

## Operations And Runtime Coordination

Operation families are `provisioning` and `deprovisioning`. Reconciliation is an
execution phase, not a separate family. Active operation uniqueness is designed
around `(workspaceId, operationFamily)` for active statuses.

Each runtime operation owns a stable provider request key. Workers use leases,
lease tokens, operation versions, and reconciliation before retrying unknown
provider outcomes. Provider calls are never made by controllers, domain code, or
frontend code.

## Outbox Events

Workspace inserts Workspace-owned outbox events in the same logical state-change
flow. `eventSequence` is the per-Workspace event ordering value.
`lifecycleVersion` is lifecycle concurrency metadata and must not be used as the
event ordering key.

`workspace.deletion_requested.v1` is non-destructive. Only
`workspace.deleted.v1` represents final cleanup authorization.

## Visibility And Access

`WorkspaceVisibilityProjection` is used only for list candidate selection and
pagination. It is not the Membership source of truth and stores no role or
invitation records.

Detail and delete decisions use `WorkspaceAccessQueryPort.getWorkspaceAccess`.
List candidates are filtered through `WorkspaceAccessQueryPort` as
defense-in-depth, with bounded creator bootstrap visibility only while pending
and unexpired.

## Local-Demo Runtime Adapter

The local-demo adapter is disabled by default and is for local/demo use only. It
is selected only through explicit local-demo configuration and the
`WorkspaceRuntimeProvisioningPort`.

No production runtime claim is made. No real Docker/OpenClaw smoke validation,
cleanup verification, credential review, or runtime URL exposure review has
been completed.

## Retained Debt

- fresh PostgreSQL migration deployment
- second deployment no-pending verification
- legacy fixture upgrade and fail-closed mapping
- runtime PostgreSQL unique/index behavior
- transaction and lease concurrency verification
- real Docker local-demo smoke and cleanup verification
- security review
- production authorization/entitlement composition
- production event-broker verification
- end-to-end browser deployment
