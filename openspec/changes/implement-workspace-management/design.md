## Context

Workspace Management owns workspace metadata and runtime lifecycle coordination
for OpenClaw-backed workspaces. It must not own membership, subscription,
agents, workflows, tools, credentials, task execution, or knowledge data.

This change is not ready for implementation until the design hardening review is
approved:

```text
docs/architecture/workspace-management-readiness-review.md
```

Final Phase 1 admission canonical design decisions:

- The readiness review has status `proposed-for-review` and is the Phase 1
  implementation-readiness gate.
- Milestone 1 uses bounded bootstrap authorization, not synchronous membership
  creation. `createdByUserId` is a bootstrap/audit field only while the current
  `ownerBootstrapAttemptId`/`ownerBootstrapAttemptVersion` is pending and
  `ownerBootstrapExpiresAt` is in the future.
- Workspace list uses a Workspace-owned `WorkspaceVisibilityProjection` fed by
  Workspace User Management public access events. The projection is only a
  user-scoped query accelerator; direct detail/delete authorization remains
  authoritative through `WorkspaceAccessQueryPort.getWorkspaceAccess`.
- `POST /api/workspaces` and every `DELETE /api/workspaces/:workspaceId`
  require an `Idempotency-Key` HTTP header. The key is not accepted in the JSON
  body and is persisted through `WorkspaceCommandReceipt`.
- Milestone 1 uses a Workspace-owned operation worker that polls
  `WorkspaceProvisioningOperation` plus a generic outbox publisher for domain
  events. The outbox publisher never dispatches provider provision/deprovision
  commands.
- Provider calls use stable `providerRequestKey` values and reconciliation
  before retry after unknown outcomes.
- Public retry endpoints remain deferred until a separate permission and API
  contract are reviewed.
- `lifecycleVersion` is only for Workspace lifecycle optimistic concurrency.
  Each outbox event gets a strictly increasing per-Workspace `eventSequence`.
- Workspace Management events and Workspace Membership bootstrap
  acknowledgement events are different aggregates. Acknowledgements use
  `aggregateType="workspace-membership-bootstrap"` and
  `producerEventSequence`; they never use the Workspace `eventSequence`.
- The outbox publisher has its own lease, retry, dead-letter state machine and
  publishes domain events only. It never dispatches provision/deprovision
  commands.
- Consumers use an inbox/processed-event policy. Each consumer dedupes by
  `(consumerName, eventId)` inside the same transaction as its state mutation.
- Delete cannot finalize while any provision operation is queued, running,
  retry scheduled, unknown, or unreconciled. Runtime absence must be backed by
  `runtime_absent_final`, not a weak provider `not_found`.
- Workspace User Management acknowledges owner membership bootstrap with
  `workspace-membership.owner-established.v1` or
  `workspace-membership.owner-establishment-failed.v1`.
- Workspace list pagination is Workspace-owned keyset pagination over
  `WorkspaceVisibilityProjection` plus the current user's own valid pending
  bootstrap rows. It does not globally scan all Workspace rows and then filter
  permissions.
- Legacy `running` rows without runtime proof are not mapped to `active`.
  Migration classifies them as `provisioning` with
  `runtimeVerificationState=manual_review_required`.
- `DELETE` on `delete_failed` is a retry command on the same public endpoint,
  guarded by `workspace:delete`, `Idempotency-Key`, command receipt replay,
  operation-family uniqueness, and runtime reconciliation.
- `workspace.deletion_requested.v1` is non-destructive guidance only. Only
  `workspace.deleted.v1` may trigger irreversible downstream cleanup.
- Unknown runtime outcome after max retries produces `failed` or
  `delete_failed`, `runtimeFinalityProof=runtime_unknown`, an operational
  incident/audit record, and an internal manual reconciliation runbook.
- Phase 4.5 defines a gated local/demo OpenClaw adapter roadmap after fake
  orchestration tests; this round does not implement it.

## Goals / Non-Goals

**Goals:**

- Implement workspace list, creation, detail loading, deletion, and runtime
  lifecycle visibility.
- Persist workspace metadata, resolved provisioning profile snapshot, non-secret
  runtime reference, lifecycle timestamps, operation state, idempotency state,
  and sanitized failure code/message.
- Resolve subscription entitlement before provisioning. Workspace must not trust
  CPU, RAM, storage, quota, or premium plan values from the frontend.
- Coordinate OpenClaw provisioning/deprovisioning asynchronously through a
  Workspace-owned operation record and outbox-backed worker handoff.
- Expose Workspace core detail through Workspace API. Related agent, workflow,
  and tool summaries are fetched through their owning modules' public endpoints
  in milestone 1.

**Non-Goals:**

- Implement agent, workflow, tool, credential, task, or knowledge base CRUD.
- Write `WorkspaceMember`, subscription, payment, agent, workflow, tool,
  credential, task, or document tables directly.
- Direct Docker/OpenClaw calls from controllers or domain services.
- Production Docker/OpenClaw adapter implementation in the design-hardening
  phase.
- Public retry endpoints for milestone 1.

## Canonical Source of Truth

Until the readiness review is approved, the canonical order is:

1. `openspec/changes/implement-workspace-management/specs/workspace-management/spec.md`
2. `openspec/changes/implement-workspace-management/design.md`
3. `docs/architecture/adr-workspace-management.md`
4. `docs/architecture/workspace-management-readiness-review.md`
5. `docs/architecture/workspace-management-audit.md`

The audit is evidence, not the controlling design. The readiness review is
`proposed-for-review` and records unresolved decisions and merge gates.

## Module Boundary

Workspace Management owns:

- `Workspace`
- proposed `WorkspaceProvisioningOperation`
- resolved provisioning configuration snapshot
- runtime reference that contains no secret
- lifecycle status and timestamps
- sanitized operational failure fields
- Workspace outbox messages for Workspace events

Workspace Management does not own:

- `User`, `Session`
- `WorkspaceMember`, `Invitation`, roles, permissions
- `Subscription`, `Transaction`, payment state, plan source of truth
- `Agent`, `Workflow`, `Tool`, credentials, tasks, documents, vector data
- provider secrets, Docker credentials, OpenClaw tokens, runtime logs

## Authorization Design

Workspace application use cases depend on ports, not other module repositories.

```ts
interface WorkspaceAccessQueryPort {
  filterAccessibleWorkspaceIds(input: {
    userId: string;
    workspaceIds: string[];
    requiredPermission: "workspace:read";
  }): Promise<{
    accessibleWorkspaceIds: string[];
  }>;

  getWorkspaceAccess(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspaceAccessDecision>;
}
```

The interface is owned by Workspace Management because it is the dependency the
Workspace use cases require. The production implementation is owned by Workspace
User Management and is bound at the backend composition root. Workspace may use
fake/in-memory implementations only for tests and local development.

Bootstrap policy:

- `workspace.created.v1` is asynchronous and is consumed by Workspace User
  Management to create owner/admin membership.
- Until membership exists, the creator may access the created workspace through
  a bounded creator bootstrap policy using `Workspace.createdByUserId`.
- Workspace stores `ownerBootstrapAttemptId`, `ownerBootstrapAttemptVersion`,
  `ownerBootstrapRequestedAt`, `ownerBootstrapState`,
  `ownerBootstrapExpiresAt`, `ownerMembershipEstablishedAt`,
  `ownerBootstrapFailureCode`, and `ownerBootstrapFailureMessage`. Valid states
  are `not_applicable`, `pending`, `established`, `failed`, and `expired`.
- Bootstrap access is allowed only for get-detail, delete, and list visibility
  of the workspace just created by that actor while the current bootstrap
  attempt is pending and not expired.
- Workspace list queries a user-scoped `WorkspaceVisibilityProjection`, loads
  non-deleted Workspace rows, unions only the current user's valid pending
  bootstrap rows, de-duplicates by Workspace ID, and defense-in-depth filters
  projection-derived candidates through
  `WorkspaceAccessQueryPort.filterAccessibleWorkspaceIds`. The cursor is
  opaque `{ v, updatedAt, workspaceId }` and represents the last returned
  eligible Workspace tuple from the user-scoped candidate set.
- After membership is established, creator access comes only from the access
  port. Later membership removal does not revive bootstrap access.
- If bootstrap fails or expires, Workspace stops granting bootstrap access and
  exposes only a safe reconciliation path for the creator's own workspace.

Authorization matrix:

| Use case | Required source | Decision |
| --- | --- | --- |
| List workspaces | `WorkspaceVisibilityProjection` plus defense-in-depth `WorkspaceAccessQueryPort.filterAccessibleWorkspaceIds` | Return projection-authorized non-deleted rows plus own pending bootstrap rows only; cursor is based on the last returned eligible Workspace tuple. |
| Create workspace | authenticated user plus `WorkspaceEntitlementPort` | No role permission; entitlement determines create ability. |
| Get detail | `workspace:read` from access port or creator bootstrap | Conceal inaccessible workspace with 404; return 403 only for accessible workspace lacking required permission. |
| Delete workspace | `workspace:delete` from access port or explicit creator bootstrap | Repeated delete during `deleting` returns the existing operation; true lifecycle conflicts use 409. |
| Retry provision | internal/admin use case in milestone 1 | No public route until a reviewed permission exists. |
| Retry delete | internal/admin use case in milestone 1 | No public route until a reviewed permission exists. |

No new shared permission is approved for milestone 1. If public retry or manage
actions are added later, propose a shared permission such as `workspace:retry`
or `workspace:manage` instead of hardcoding roles.

## Workspace Visibility Projection

Workspace Management owns a local query projection for list only:

```text
WorkspaceVisibilityProjection
```

This projection is not a Membership table and is not authoritative for RBAC.
Workspace User Management remains the source of truth for membership and
permissions. Direct detail/delete checks always call
`WorkspaceAccessQueryPort.getWorkspaceAccess`.

Logical fields:

- `projectionId`
- `userId`
- `workspaceId`
- `canRead`
- `canDelete`
- `membershipVersion`
- `projectionUpdatedAt`
- `createdAt`
- `updatedAt`

Workspace User Management must expose versioned public events or an equivalent
reviewed public contract:

- `workspace-membership.access-granted.v1`
- `workspace-membership.access-updated.v1`
- `workspace-membership.access-revoked.v1`

Projection event payloads contain safe public authorization facts only:

```ts
{
  workspaceId: string;
  userId: string;
  canRead: boolean;
  canDelete: boolean;
  membershipVersion: number;
  occurredAt: string;
}
```

Projection consumers process at least once, dedupe event IDs through the
ProcessedDomainEvent policy, ignore stale `membershipVersion`, never grant from
an older event after revoke, support internal projection rebuild/reconciliation
through a reviewed Workspace User Management contract, and expose safe lag/health
metrics.

## Bootstrap State Machine And Reconciliation

Canonical bootstrap states:

```text
not_applicable
pending
established
failed
expired
```

Transitions:

- New native Workspace: none -> `pending`.
- Legacy Workspace: none -> `not_applicable`.
- Success acknowledgement: `pending -> established`.
- Terminal membership failure acknowledgement: `pending -> failed`.
- TTL expiration: `pending -> expired`.
- Internal reconciliation/bootstrap retry: `failed -> pending` or
  `expired -> pending`.

`failed -> pending` and `expired -> pending` are internal reconciliation only,
never public API. Every retry generates a new `ownerBootstrapAttemptId`,
increments `ownerBootstrapAttemptVersion`, sets a new expiry, clears only
retryable/bootstrap failure fields, preserves audit trail, and publishes a new
Workspace bootstrap request event or safely replays `workspace.created.v1` only
when semantic replay is explicitly defined.

Forbidden transitions include old event success after retry, `failed` or
`expired` to `established` through an old acknowledgement, `established ->
pending`, and `established -> failed`.

Workspace User Management performs its own bounded internal retry before
publishing a terminal failure acknowledgement. A dead-lettered
`workspace.created.v1` or acknowledgement event is a critical operational
incident with alert, durable audit, named owner, replay/requeue process, and
correlation to `workspaceId`, `bootstrapAttemptId`, and source `eventId`.

## Subscription Entitlement Design

The create request accepts caller intent only:

- `name`
- `requestedProfile`: `standard` or `premium`

`Idempotency-Key` is required in the HTTP header for `POST /api/workspaces` and
every `DELETE /api/workspaces/:workspaceId`. It is scoped by
`actorUserId + commandType + commandTarget + idempotencyKey` through
`WorkspaceCommandReceipt`. Same key with the same canonical request fingerprint
returns the original `202 Accepted` response snapshot or a deterministic
reconstruction from immutable references. Same key with a different fingerprint
returns `workspace.idempotency_conflict` with HTTP 409. A missing or malformed
key is a shared validation failure.

The server resolves the profile through:

```ts
interface WorkspaceEntitlementPort {
  resolveProvisioningProfile(input: {
    userId: string;
    requestedProfile: "standard" | "premium";
  }): Promise<
    | {
        allowed: true;
        resolvedProfile: {
          planCode: string;
          requestedProfile: "standard" | "premium";
          cpuLimit: number;
          memoryMb: number;
          storageMb?: number;
          maxAgents?: number;
          maxWorkflows?: number;
          sourceSubscriptionId?: string;
          resolvedAt: string;
          policyVersion?: string;
        };
      }
    | {
        allowed: false;
        reason:
          | "no_active_subscription"
          | "profile_not_entitled"
          | "workspace_quota_exceeded"
          | "subscription_expired";
      }
  >;
}
```

The interface is owned by Workspace Management. The production implementation is
owned by Subscription & Payment and is bound at the backend composition root.

The resolved provisioning profile snapshot is immutable for the workspace
provisioning operation. Future subscription downgrade/expiry does not mutate an
already active workspace in milestone 1. Standard-to-Premium runtime resizing is
owned by Subscription & Payment as a future change that may request Workspace
runtime resize through a reviewed public contract/event.

Workspace quota is an unresolved product decision. Do not implement a fake quota
until the product requirement is approved.

Same idempotency key with a different request fingerprint returns
`workspace.idempotency_conflict` with HTTP 409.

## Workspace Command Receipt Idempotency

Workspace Management owns command idempotency with a durable logical model:

```text
WorkspaceCommandReceipt
```

Logical fields:

- `commandReceiptId`
- `actorUserId`
- `commandType`
- `commandTarget`
- `workspaceId`
- `idempotencyKey`
- `requestFingerprint`
- `requestSchemaVersion`
- `operationId`
- `responseStatusCode`
- `responsePayloadJson`
- `createdAt`
- `expiresAt`
- `completedAt`
- `updatedAt`
- `version`

Allowed command values are `workspace.create` and `workspace.delete`. Command
targets are `collection:/api/workspaces` for create and
`workspace:<workspaceId>` for delete.

Rules:

- `actorUserId`, `commandType`, `commandTarget`, `idempotencyKey`, and
  immutable `requestFingerprint` are required.
- `workspaceId` is nullable only before a create command allocates the new
  identity, and must be populated before transaction commit.
- `responsePayloadJson` stores only safe API response data. It must never store
  credentials, runtime refs, provider keys, lease tokens, raw provider data,
  stack traces, session tokens, or secrets.
- Receipt creation, Workspace mutation, Operation creation, and relevant outbox
  insertion happen atomically in one transaction.
- Required uniqueness:
  `UNIQUE(actorUserId, commandType, commandTarget, idempotencyKey)` and
  `UNIQUE(operationId) WHERE operationId IS NOT NULL`.
- Different actors using the same opaque key do not collide.
- Receipt retention is configured by
  `WORKSPACE_COMMAND_IDEMPOTENCY_TTL_HOURS`; create-only TTL naming is
  deprecated.
- DELETE in `deleting` with a new key may return the existing active
  deprovision operation, but still persists/replays a deterministic receipt.
- DELETE in `delete_failed` creates exactly one retry operation after
  reconciliation/finality checks and deprovisioning-family uniqueness. That new
  operation starts in `reconcile` phase before any provider delete call.

## Lifecycle State Machine

Canonical statuses:

```text
provisioning
active
failed
deleting
delete_failed
deleted
```

Commands:

- `CreateWorkspace`
- `ProvisionSucceeded`
- `ProvisionFailed`
- `RetryProvision`
- `RequestDelete`
- `DeprovisionSucceeded`
- `DeprovisionFailed`
- `RetryDelete`
- `CancelProvisioning`
- `RuntimeProvisionedAfterDeleteRequested`
- `ReconcileRuntimeStatus`

The full transition and race-condition matrix is in the readiness review. The
core invariant is:

```text
Workspace metadata must not be removed or marked deleted before runtime
deprovisioning is complete or proven unnecessary.
```

## Durable Operation and Outbox Design

Milestone 1 uses Workspace-owned operation state plus an outbox:

- `WorkspaceProvisioningOperation`
- `OutboxMessage` or equivalent generic outbox

The current `JobQueue` interface and Prisma `Job` model are not durable enough
for production Workspace provisioning because the Prisma model lacks payload,
attempt count, scheduling, lease, error, and lock fields.

Logical `WorkspaceProvisioningOperation` fields:

- `operationId`
- `workspaceId`
- `operationType`
- `operationFamily`
- `executionPhase`
- `status`
- `idempotencyKey`
- `requestFingerprint`
- `providerRequestKey`
- `dependsOnOperationId`
- `runtimeFinalityProof`
- `unknownOutcomeAt`
- `attemptCount`
- `maxAttempts`
- `nextAttemptAt`
- `lockedAt`
- `lockedBy`
- `leaseToken`
- `leaseExpiresAt`
- `cancellationRequestedAt`
- `supersededByOperationId`
- `lastErrorCode`
- `lastErrorMessage`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`
- `version`

String timestamps follow the existing Prisma convention.

Operation values:

- `operationType`: `provision`, `deprovision`
- `operationFamily`: `provisioning`, `deprovisioning`
- `executionPhase`: `execute`, `reconcile`
- active statuses for uniqueness: `queued`, `blocked`, `running`,
  `retry_scheduled`
- terminal statuses: `succeeded`, `failed`, `cancelled`, `superseded`

Reconciliation is a phase of the relevant operation, not a separate operation
type. A deprovision operation created while a provision operation is not
terminal must set `dependsOnOperationId` and remain `blocked` or
`retry_scheduled` until the provision dependency is terminal and runtime
finality is known.

`runtimeFinalityProof` values:

- `runtime_present_confirmed`
- `runtime_absent_final`
- `runtime_unknown`
- `provision_call_cancelled_before_dispatch`

`runtime_absent_final` means the provider has confirmed no runtime exists and
no in-flight provision associated with the stable `providerRequestKey` can
still materialize. A provider that cannot guarantee this returns
`runtime_unknown`.

Worker claim is optimistic and atomic:

1. Find due `queued` or expired-lease `running` operation.
2. Update it to `running`, increment `version`, set `lockedAt`, `lockedBy`,
   `leaseToken`, and `startedAt` if absent.
3. Only the holder of `leaseToken` may complete, fail, or renew that lease.
4. Completion/failure writes also verify operation `version`, Workspace
   `lifecycleVersion`, and expected lifecycle status.
5. Provider calls use stable `providerRequestKey`; retry after timeout or
   unknown outcome must reconcile provider state before issuing a new provision
   command.
6. Operation-family uniqueness uses a PostgreSQL partial unique index on
   `(workspaceId, operationFamily)` where status is in `queued`, `blocked`,
   `running`, or `retry_scheduled`. Prisma cannot express this index; Phase 1
   needs reviewed manual SQL and tests.

Default retry policy for design review:

- `maxAttempts = 5`
- backoff: `min(15 minutes, 30 seconds * 2^(attemptCount - 1))`
- timeout or unknown outcome transitions to retryable failure until max attempts,
  then `failed` or `delete_failed` depending on operation type.

These numbers are design assumptions and must not be hardcoded as product policy
without approval.

Outbox message fields include:

- `outboxMessageId`
- `eventId`
- `aggregateType`
- `aggregateId`
- `lifecycleVersion`
- `eventSequence`
- `eventType`
- `eventVersion`
- `payloadJson`
- `occurredAt`
- `correlationId`
- `causationId`
- `status`
- `publishAttemptCount`
- `maxPublishAttempts`
- `nextAttemptAt`
- `lockedAt`
- `lockedBy`
- `leaseToken`
- `leaseExpiresAt`
- `publishedAt`
- `terminalFailureAt`
- `deadLetterReasonCode`
- `deadLetterReasonMessage`
- `lastErrorCode`
- `lastErrorMessage`
- `createdAt`
- `updatedAt`
- `version`

Outbox status values are `pending`, `publishing`, `retry_scheduled`,
`published`, and `dead_lettered`. Claim, success, retry and dead-letter writes
must use atomic compare-and-set with `leaseToken` and `version`.
Publisher crash after send but before DB update produces at-least-once
delivery; consumers dedupe by `eventId`. Critical events, including
`workspace.created.v1` and bootstrap acknowledgement events, must alert/audit
when dead-lettered.

## Logical Workspace Schema And Legacy Nullability

Canonical Workspace fields for Phase 1 schema design:

- `workspaceId`
- `name`
- `normalizedName`
- `status`
- `lifecycleVersion`
- `eventSequence`
- `createdByUserId`
- `ownerBootstrapState`
- `ownerBootstrapAttemptId`
- `ownerBootstrapAttemptVersion`
- `ownerBootstrapRequestedAt`
- `ownerBootstrapExpiresAt`
- `ownerMembershipEstablishedAt`
- `ownerBootstrapFailureCode`
- `ownerBootstrapFailureMessage`
- `resolvedProvisioningProfile`
- `provisioningProfileSource`
- `migrationOrigin`
- `runtimeVerificationState`
- `provider`
- `runtimeRef`
- `runtimeUrl`
- `provisioningRequestedAt`
- `provisionedAt`
- `deletionRequestedAt`
- `deletedAt`
- `failureCode`
- `failureMessage`
- `createdAt`
- `updatedAt`

Enum values:

- `ownerBootstrapState`: `not_applicable`, `pending`, `established`, `failed`,
  `expired`.
- `migrationOrigin`: `native`, `legacy_import`.
- `runtimeVerificationState`: `unknown`, `present_confirmed`, `absent_final`,
  `manual_review_required`.
- `provisioningProfileSource`: `resolved`, `legacy_unknown`.

Nullability and migration policy:

- New native records require a valid resolved provisioning profile at the
  domain/use-case level.
- `resolvedProvisioningProfile` remains nullable in Phase 1 because legacy rows
  can legitimately be `legacy_unknown`.
- Do not fabricate conservative skeleton profile JSON, operation history,
  runtime refs, bootstrap state, or historical events.
- New native records start with `ownerBootstrapState=pending`,
  `ownerBootstrapAttemptId`, `ownerBootstrapAttemptVersion=1`, and
  `eventSequence=0` before the first outbox event increments it.
- Legacy imported records use `ownerBootstrapState=not_applicable` unless there
  is verified evidence of a current bootstrap attempt.
- No legacy record becomes `established` merely because it is old.
- No legacy `running` becomes `active` without
  `runtimeVerificationState=present_confirmed`.
- No legacy `stopping` becomes `deleted` automatically.
- Legacy rows without event history start with `eventSequence=0` and do not
  receive fake historical outbox events.

## API Contract

Milestone 1 public routes:

| Method | Path | Success |
| --- | --- | --- |
| `GET` | `/api/workspaces` | `200 OK`, proposed shared `ApiCursorPaginatedSuccess<WorkspaceSummary>` |
| `POST` | `/api/workspaces` | `202 Accepted`, `ApiSuccess<CreateWorkspaceResponse>` |
| `GET` | `/api/workspaces/:workspaceId` | `200 OK`, `ApiSuccess<WorkspaceDetail>` |
| `DELETE` | `/api/workspaces/:workspaceId` | `202 Accepted`, `ApiSuccess<DeleteWorkspaceResponse>` |

`ApiSuccess<T>` is the successful branch of shared `ApiResponse<T>`.
Documentation may refer to `ApiResponse<T>` generically for routes that can
also return `ApiFailure`, but success examples must use `ApiSuccess<T>`.
Workspace list needs a proposed `ApiCursorPaginatedSuccess<T>` contract before
implementation because existing `ApiPaginatedSuccess<T>` is page/total based.

Public retry endpoints are deferred:

- `POST /api/workspaces/:workspaceId/provision-retries`
- `POST /api/workspaces/:workspaceId/deletion-retries`

They require a reviewed permission and are not milestone 1 requirements.

Deleted records are hidden from normal list/detail responses. A repeated DELETE
while a workspace is `deleting` returns `202 Accepted` with the existing active
deprovision operation. DELETE while `delete_failed` is a retry command, not a
lifecycle conflict: with `workspace:delete`, `Idempotency-Key`, no active
deprovisioning-family operation, and reconciled prior outcome, it creates
exactly one new deprovision operation. Public DELETE for `deleted` is concealed
as 404 by default unless an internal/audit use case explicitly applies.

Every public DELETE request must include `Idempotency-Key` before lifecycle
state-specific handling. `deleted` still returns concealed `404` according to
authorization/concealment policy and does not create a new command receipt.

Milestone 1 public API error taxonomy:

- `validation.invalid_input`
- `auth.unauthorized`
- `auth.forbidden`
- `workspace.not_found`
- `workspace.lifecycle_conflict`
- `workspace.idempotency_conflict`
- `workspace.entitlement_denied`
- `system.unavailable`
- `system.unexpected_error`

`workspace.provisioning_failed` and `workspace.deprovisioning_failed` are safe
Workspace lifecycle failure codes stored in detail/state, not synchronous API
error envelope codes. Use `auth.forbidden`, not `workspace.access_denied`; use
`validation.invalid_input`, not `workspace.invalid_input`.

Existing shared `ERROR_CODES` must be extended before implementation uses these
codes.

## Workspace Detail Strategy

Milestone 1 chooses option A:

```text
Workspace detail returns Workspace core only.
Frontend calls public Agent, Workflow, and Tool endpoints for their summaries.
```

Rationale:

- Maintains module boundaries.
- Avoids backend fan-out and partial-failure semantics before public query ports
  exist.
- Fits the current monolith and API matrix.

The Workspace response may include link/capability metadata for related public
sections, but not embedded agent/workflow/tool data in milestone 1.

## Event Contract

Workspace events use versioned names and an outbox-backed Workspace aggregate
envelope:

```ts
type WorkspaceDomainEvent<TPayload> = {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  aggregateType: "workspace";
  aggregateId: string;
  lifecycleVersion: number;
  eventSequence: number;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
};
```

Required events:

- `workspace.created.v1`
- `workspace.provisioning.requested.v1`
- `workspace.ready.v1`
- `workspace.provisioning_failed.v1`
- `workspace.deletion_requested.v1`
- `workspace.deleted.v1`
- `workspace.deletion_failed.v1`

Workspace Management also consumes Workspace User Management acknowledgement
events for bootstrap state only. These are not Workspace aggregate events and
must not use Workspace `eventSequence`:

- `workspace-membership.owner-established.v1`
- `workspace-membership.owner-establishment-failed.v1`

```ts
type WorkspaceMembershipBootstrapEvent<TPayload> = {
  eventId: string;
  eventType:
    | "workspace-membership.owner-established.v1"
    | "workspace-membership.owner-establishment-failed.v1";
  eventVersion: 1;
  aggregateType: "workspace-membership-bootstrap";
  aggregateId: string;
  producerEventSequence: number;
  occurredAt: string;
  correlationId: string;
  causationId: string;
  payload: TPayload;
};
```

Acknowledgement payloads:

```ts
type OwnerMembershipEstablishedPayload = {
  workspaceId: string;
  createdByUserId: string;
  bootstrapAttemptId: string;
  bootstrapAttemptVersion: number;
  membershipId: string;
  role: "admin";
  establishedAt: string;
};

type OwnerMembershipEstablishmentFailedPayload = {
  workspaceId: string;
  createdByUserId: string;
  bootstrapAttemptId: string;
  bootstrapAttemptVersion: number;
  failedAt: string;
  failureCode: string;
  failureMessage: string;
};
```

`workspace.created.v1` must include enough data for Workspace User Management to
create owner/admin membership without Workspace writing `WorkspaceMember`:

```ts
{
  workspaceId: string;
  createdByUserId: string;
  workspaceName: string;
  createdAt: string;
  initialStatus: "provisioning";
  bootstrapAttemptId: string;
  bootstrapAttemptVersion: number;
}
```

Workspace accepts an acknowledgement only when `workspaceId`,
`createdByUserId`, `bootstrapAttemptId`, and `bootstrapAttemptVersion` match the
current pending attempt. Old, duplicate, wrong-creator, wrong-attempt, or
post-established events are ignored safely and recorded only through safe
observability/audit behavior.

Delivery assumption: at-least-once after outbox publication. Consumers dedupe
by `eventId`. Consumers use `eventSequence` only to detect gaps/out-of-order
delivery for projections that need strict ordering; they must not drop a
different event type only because it has the same `lifecycleVersion`.

`workspace.deletion_requested.v1` may only trigger safe non-destructive
consumer actions such as blocking new workspace-scoped work, quiescing
workflows, disabling new scheduling, preparation, notification, and audit. Only
`workspace.deleted.v1` may trigger irreversible downstream cleanup, and every
consumer owns its own idempotent cleanup policy.

## Consumer Inbox Policy

At-least-once delivery requires a persisted inbox/processed-event policy:

```text
ProcessedDomainEvent
```

Logical fields:

- `consumerName`
- `eventId`
- `eventType`
- `aggregateType`
- `aggregateId`
- `processedAt`
- `resultStatus`
- `createdAt`
- `updatedAt`

Canonical uniqueness is `UNIQUE(consumerName, eventId)`. Each consumer can use
a local inbox table or an approved generic platform table. Workspace User
Management must process `workspace.created.v1` transactionally with owner
membership creation, dedupe marker insertion, and acknowledgement outbox event
insertion. Workspace bootstrap acknowledgement and visibility projection
consumers must likewise update state/projection and insert the dedupe marker in
the same transaction. Natural keys are extra protection, not a replacement for
event-ID dedupe. Dead-letter replay must remain safe under inbox dedupe.

## Runtime Adapter and Reconciliation

Workspace application layer depends on:

```ts
interface WorkspaceRuntimeProvisioningPort {
  provisionWorkspace(command: ProvisionWorkspaceCommand): Promise<ProvisionWorkspaceResult>;
  deprovisionWorkspace(command: DeprovisionWorkspaceCommand): Promise<DeprovisionWorkspaceResult>;
  getWorkspaceRuntimeStatus(input: {
    workspaceId: string;
    runtimeRef?: string;
    providerRequestKey?: string;
  }): Promise<WorkspaceRuntimeStatusResult>;
}
```

`ProvisionWorkspaceCommand`, `DeprovisionWorkspaceCommand`, and runtime status
reconciliation input must carry the stable `providerRequestKey` where the
provider/adapter can use it. Reconciliation must be able to search by
`providerRequestKey` and deterministic runtime labels, not only by `runtimeRef`.

Provider timeouts are treated as unknown outcome, not immediate hard failure.
Reconciliation must call `getWorkspaceRuntimeStatus` before creating another
runtime when an operation has uncertain outcome.

Deprovisioning a missing runtime is idempotent success only if the provider can
return `runtime_absent_final`. A weak missing response while a provision
operation is active, unknown, or unreconciled keeps the deprovision operation
blocked or retry scheduled and does not emit `workspace.deleted.v1`.

Runtime references must be opaque non-secret identifiers. Runtime URLs may be
returned only if the provider classifies them as tokenless public-safe URLs and
the Workspace runtime URL exposure policy is enabled. The conservative default
is to omit `runtimeUrl` from public responses.

## Unknown Runtime Outcome Manual Reconciliation

When max attempts are exhausted and runtime finality is still unknown, the
system must not assume absence, emit `workspace.deleted.v1`, hard-delete
metadata, or issue another provider command blindly. The operation is terminal
with sanitized failure data and `runtimeFinalityProof=runtime_unknown`.
Workspace becomes `failed` for provision operations or `delete_failed` for
deprovision operations. An observable operational incident/audit record is
created.

Internal retry begins in `reconcile` phase and must gather provider evidence
before any new provision/deprovision call. Public DELETE from `delete_failed`
may request another deprovision operation, but that operation starts in
reconcile phase until finality or runtime presence is known.

Runbook headings required before Phase 1 admission:

- Manual Reconciliation Trigger
- Required Evidence
- Allowed Operator Actions
- Forbidden Operator Actions
- Resolution Outcomes
- Audit Requirements

## Unresolved Product Decisions

- Workspace quota by plan.
- Workspace name uniqueness scope.
- Workspace list cursor and page-size product defaults.
- Deleted metadata retention period.
- Runtime URL exposure policy.
- API rate limits.
- Event retention period.
- Reconciliation schedule.
- Production OpenClaw timeout values.
- Demo OpenClaw adapter enablement, cleanup, and security review details.

These must be approved before production rollout, but implementation can proceed
with conservative configuration defaults only after the merge gate is approved.

## Phase 4.5 Local/Demo OpenClaw Runtime Adapter Roadmap

After fake adapter orchestration tests pass, a separate gated Phase 4.5 may add
a local/demo adapter. It must use `WorkspaceRuntimeProvisioningPort`, run only
behind explicit environment enablement, resolve Docker/OpenClaw credentials via
environment/secret storage, store only opaque non-secret `runtimeRef`, apply
deterministic labels `platform.workspaceId`, `platform.operationId`, and
`platform.providerRequestKey`, support reconciliation by provider request key
and labels, support idempotent delete, avoid unit/integration tests, include
manual smoke-test and cleanup instructions, document timeout/cancellation and
unknown outcomes, pass runtime URL/secret security review, and must not claim
production readiness.
