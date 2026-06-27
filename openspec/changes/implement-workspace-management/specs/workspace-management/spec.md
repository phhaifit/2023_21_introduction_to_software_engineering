## ADDED Requirements

### Requirement: Workspace Listing
The system SHALL show authenticated users the workspaces they can access without
Workspace Management reading membership persistence directly.

#### Scenario: Workspace list viewed
- **WHEN** an authenticated user requests the workspace list
- **THEN** Workspace Management queries only user-scoped candidate Workspace IDs
  through `WorkspaceVisibilityProjection`
- **AND** joins/loads Workspace rows, excludes `deleted`, and orders by
  `updatedAt DESC, workspaceId ASC`
- **AND** defense-in-depth filters projection-derived candidates through
  `WorkspaceAccessQueryPort.filterAccessibleWorkspaceIds`
- **AND** returns matching non-deleted Workspace metadata with name, status,
  creation time, and update time
- **AND** the response uses the proposed shared cursor pagination API envelope
- **AND** the public cursor is Workspace-owned and contains only the last
  returned eligible `{ updatedAt, workspaceId }` tuple
- **AND** list consistency after membership changes is eventually consistent,
  while direct detail/delete authorization remains authoritative through
  `WorkspaceAccessQueryPort.getWorkspaceAccess`

#### Scenario: Bootstrap-pending workspace visible to creator
- **WHEN** a user lists workspaces immediately after creating a workspace whose
  owner membership has not yet been materialized
- **THEN** Workspace Management includes non-deleted rows where
  `createdByUserId` is the current user, `ownerBootstrapState` is `pending`,
  and `ownerBootstrapExpiresAt` is in the future without asking Workspace User
  Management to know bootstrap state
- **AND** the response de-duplicates rows, uses stable sorting, and does not
  expose workspaces created by other users
- **AND** the bootstrap list exception stops after membership is established,
  bootstrap fails, or the bootstrap TTL expires

#### Scenario: Membership projection changes list visibility
- **WHEN** Workspace User Management publishes access granted, updated, or
  revoked events
- **THEN** Workspace Management updates `WorkspaceVisibilityProjection`
  idempotently
- **AND** stale membership versions cannot grant access after a newer revoke
- **AND** the list does not reveal cross-user Workspace existence through
  pagination gaps or `hasMore`

#### Scenario: Direct authorization remains authoritative
- **WHEN** projection state is lagging or stale
- **THEN** detail and delete requests still use
  `WorkspaceAccessQueryPort.getWorkspaceAccess`
- **AND** list responses filter projection-derived candidates through
  `WorkspaceAccessQueryPort.filterAccessibleWorkspaceIds` before returning data

#### Scenario: Unauthenticated list rejected
- **WHEN** an unauthenticated request lists workspaces
- **THEN** the system returns a shared authentication failure response

### Requirement: Workspace Creation
The system SHALL allow an authenticated user to request a workspace with a
validated name and requested provisioning profile.

#### Scenario: Workspace creation requested
- **WHEN** a user submits a valid workspace name and requested profile with a
  valid `Idempotency-Key` HTTP header
- **THEN** the system authenticates the actor
- **AND** validates only caller intent fields from the request
- **AND** resolves the approved provisioning profile through
  `WorkspaceEntitlementPort`
- **AND** persists Workspace metadata, immutable resolved profile snapshot,
  provisioning operation, and outbox messages atomically
- **AND** returns `202 Accepted` with status `provisioning` and operation ID

#### Scenario: Invalid workspace creation rejected
- **WHEN** a user submits an invalid name, unsupported profile, forbidden
  server-owned field, missing `Idempotency-Key`, or malformed idempotency key
- **THEN** the system rejects the request with a shared validation error

#### Scenario: Entitlement denied
- **WHEN** the entitlement port denies the requested profile
- **THEN** the system rejects creation without persisting Workspace metadata
- **AND** returns a reviewed Workspace entitlement error

#### Scenario: Idempotent create replay
- **WHEN** the same actor repeats a create request with the same
  `Idempotency-Key` header and same request fingerprint
- **THEN** the system replays the original safe response through
  `WorkspaceCommandReceipt`
- **AND** does not create a second provisioning operation or runtime

#### Scenario: Idempotency conflict
- **WHEN** the same actor repeats a create request with the same
  `Idempotency-Key` header but different request fingerprint
- **THEN** the system rejects the request with a lifecycle/idempotency conflict
- **AND** does not modify the original Workspace or operation

### Requirement: Workspace Command Receipt Idempotency
The system SHALL persist command idempotency through Workspace-owned command
receipts.

#### Scenario: Command receipt scope and atomicity
- **WHEN** `POST /api/workspaces` or `DELETE /api/workspaces/:workspaceId` is
  accepted
- **THEN** the system persists `WorkspaceCommandReceipt` with
  `actorUserId`, `commandType`, `commandTarget`, `idempotencyKey`,
  immutable `requestFingerprint`, response status/safe payload, and operation
  reference if applicable
- **AND** receipt creation, Workspace mutation, operation creation, and relevant
  outbox insertion happen atomically
- **AND** uniqueness is
  `actorUserId + commandType + commandTarget + idempotencyKey`
- **AND** different actors using the same opaque key do not collide

#### Scenario: DELETE always requires Idempotency-Key
- **WHEN** an authenticated actor sends any public DELETE workspace command
- **THEN** the request must include `Idempotency-Key` before lifecycle-specific
  handling
- **AND** same actor, same command, same key, and same fingerprint replay the
  stored safe response
- **AND** same actor, same command, same key, and different fingerprint return
  `409 workspace.idempotency_conflict`

### Requirement: Public API Error Taxonomy
The system SHALL expose only the approved milestone 1 Workspace API error
taxonomy.

Allowed public API error codes:

```text
validation.invalid_input
auth.unauthorized
auth.forbidden
workspace.not_found
workspace.lifecycle_conflict
workspace.idempotency_conflict
workspace.entitlement_denied
system.unavailable
system.unexpected_error
```

#### Scenario: API error response is canonical and secret-safe
- **WHEN** a Workspace API request fails validation, authentication,
  authorization, lifecycle, idempotency, entitlement, dependency availability,
  or unexpected server handling
- **THEN** the response uses one of the approved public error codes
- **AND** never uses `workspace.invalid_input`, `workspace.access_denied`,
  `workspace.provisioning_failed`, or `workspace.deprovisioning_failed` as a
  synchronous API envelope code
- **AND** never exposes runtime refs, provider keys, lease tokens, stack traces,
  raw SQL, credentials, or raw provider response bodies
- **AND** provider provisioning/deprovisioning failures after `202 Accepted`
  are visible through Workspace lifecycle state/detail, not retroactive POST or
  DELETE errors

### Requirement: Bootstrap Owner Authorization
The system SHALL provide bounded creator bootstrap access while owner membership
is created asynchronously by Workspace User Management.

#### Scenario: Creator accesses pending bootstrap workspace
- **WHEN** a creator requests detail or deletion for a workspace they just
  created before owner membership exists
- **THEN** Workspace Management may authorize only that creator while
  the current `ownerBootstrapAttemptId` and `ownerBootstrapAttemptVersion` are
  `pending` and `ownerBootstrapExpiresAt` is in the future
- **AND** the exception applies only to detail, delete, and list visibility
- **AND** `createdByUserId` does not grant access after membership is
  established, bootstrap fails, or bootstrap expires

#### Scenario: Bootstrap does not revive access
- **WHEN** owner membership has been established and later removed by the
  Workspace User Management module
- **THEN** Workspace Management SHALL NOT use `createdByUserId` to bypass
  `WorkspaceAccessQueryPort`

#### Scenario: Bootstrap failure or expiry
- **WHEN** the owner membership event fails permanently or the bootstrap TTL
  expires
- **THEN** Workspace Management stops granting bootstrap access
- **AND** exposes only a safe, bounded failure/reconciliation path for the
  creator's own workspace

#### Scenario: Owner membership establishment acknowledged
- **WHEN** Workspace User Management materializes owner membership from
  `workspace.created.v1`
- **THEN** it publishes
  `workspace-membership.owner-established.v1`
- **AND** the acknowledgement uses
  `aggregateType="workspace-membership-bootstrap"` and the current
  `bootstrapAttemptId`/`bootstrapAttemptVersion`
- **AND** Workspace Management consumes that event idempotently only when
  `workspaceId`, `createdByUserId`, `bootstrapAttemptId`, and
  `bootstrapAttemptVersion` match the current pending attempt
- **AND** it moves `ownerBootstrapState` from `pending` to `established`
- **AND** Workspace Management does not create or mutate `WorkspaceMember`

#### Scenario: Owner membership establishment failed
- **WHEN** Workspace User Management cannot materialize owner membership
- **THEN** it publishes
  `workspace-membership.owner-establishment-failed.v1`
- **AND** failure acknowledgement means the retry budget for that attempt is
  exhausted
- **AND** Workspace Management consumes that event idempotently only when the
  current bootstrap attempt matches
- **AND** it moves `ownerBootstrapState` from `pending` to `failed` with
  sanitized failure data

#### Scenario: Bootstrap internal retry creates a new attempt
- **WHEN** an internal reconciliation use case retries bootstrap after `failed`
  or `expired`
- **THEN** Workspace Management generates a new `ownerBootstrapAttemptId`
- **AND** increments `ownerBootstrapAttemptVersion`
- **AND** sets a new `ownerBootstrapExpiresAt`
- **AND** preserves audit trail for the previous attempt
- **AND** old success or failure acknowledgements for previous attempts are
  ignored safely

#### Scenario: Bootstrap critical event dead-lettered
- **WHEN** `workspace.created.v1` or a bootstrap acknowledgement event is
  dead-lettered
- **THEN** the incident is observable with alert, durable audit, named owner,
  replay/requeue process, and correlation to `workspaceId`,
  `bootstrapAttemptId`, and source `eventId`

### Requirement: Workspace Lifecycle State Machine
The system SHALL enforce a formal lifecycle state machine for Workspace runtime
provisioning and deletion.

Canonical statuses:

```text
provisioning
active
failed
deleting
delete_failed
deleted
```

#### Scenario: Provisioning succeeds
- **WHEN** the provisioning worker reports success for a valid running operation
- **THEN** the system stores the non-secret runtime reference
- **AND** marks the Workspace `active`
- **AND** emits a ready event through the outbox

#### Scenario: Provisioning fails
- **WHEN** provisioning fails with a retryable or terminal error
- **THEN** the system records sanitized failure code/message
- **AND** either schedules retry according to the operation policy or marks the
  Workspace `failed`
- **AND** does not expose raw provider errors or secrets

#### Scenario: Deletion requested while active
- **WHEN** an authorized actor deletes an active Workspace
- **THEN** the system marks the Workspace `deleting`
- **AND** creates a deprovisioning operation and outbox message atomically
- **AND** returns `202 Accepted`

#### Scenario: Repeated delete while deleting
- **WHEN** an authorized actor repeats DELETE for a workspace already in
  `deleting`
- **THEN** the API returns `202 Accepted` with the existing deprovision
  operation summary
- **AND** does not create a second deprovision operation or provider delete
  command

#### Scenario: Deletion requested while provisioning
- **WHEN** an authorized actor deletes a Workspace whose provisioning is queued
  or running
- **THEN** the system marks cancellation/deletion intent durably
- **AND** ensures any created runtime is deprovisioned before final `deleted`
  status

#### Scenario: Deletion waits for in-flight provisioning finality
- **WHEN** deletion is requested while a provision operation is queued, running,
  retry scheduled, unknown, or unreconciled
- **THEN** the deprovision operation depends on that provision operation
- **AND** the Workspace remains `deleting`
- **AND** the system SHALL NOT mark `deleted` or emit `workspace.deleted.v1`
  until provisioning is safely cancelled before dispatch, runtime absence is
  proven with `runtime_absent_final`, or the late-created runtime is
  subsequently deprovisioned

#### Scenario: Delete failed retry requested
- **WHEN** an authorized actor sends DELETE for a `delete_failed` workspace
  with a valid `Idempotency-Key`
- **THEN** the system treats the request as a retry command on the same public
  endpoint
- **AND** creates exactly one new deprovision operation only after prior outcome
  reconciliation and operation-family uniqueness checks pass
- **AND** repeated requests with the same key return the same retry operation

#### Scenario: Deleted status is terminal
- **WHEN** a Workspace reaches `deleted`
- **THEN** the system SHALL NOT transition it to a non-terminal status

### Requirement: Durable Operation and Outbox
The system SHALL not rely on the current generic `Job` skeleton as a production
Workspace provisioning queue.

#### Scenario: Operation persisted atomically
- **WHEN** create, delete, retry provision, or retry delete is accepted
- **THEN** the Workspace metadata change, `WorkspaceProvisioningOperation`, and
  outbox message are written in the same database transaction

#### Scenario: Worker claims operation
- **WHEN** a worker polls due operations
- **THEN** it atomically claims exactly one operation by setting lock metadata,
  lease token, and version
- **AND** only the holder of the current lease token may complete or fail the
  operation

#### Scenario: Worker lease expires
- **WHEN** a worker crashes or misses lease renewal
- **THEN** another worker can reclaim the operation after lease expiration
- **AND** the operation remains idempotent against the runtime provider

#### Scenario: Zombie worker cannot complete stale operation
- **WHEN** a worker's lease token is no longer current
- **THEN** Workspace Management rejects that worker's completion or failure
  write
- **AND** any duplicate provider command is prevented by stable
  `providerRequestKey` and reconciliation before retry

#### Scenario: Outbox persists with state transition
- **WHEN** Workspace state changes through create, provision success/failure,
  delete request, or delete success/failure
- **THEN** the corresponding Workspace event outbox row is persisted in the
  same transaction as the aggregate state change
- **AND** the outbox publisher is the only component that publishes those
  events after commit

#### Scenario: Outbox publisher recovers after crash
- **WHEN** the outbox publisher crashes, loses its lease, or crashes after
  publishing but before recording success
- **THEN** another publisher may reclaim the message after `leaseExpiresAt`
- **AND** publication remains at-least-once
- **AND** stale publisher writes fail harmlessly by lease token and version
- **AND** consumers deduplicate by `eventId`

#### Scenario: Critical outbox message dead-lettered
- **WHEN** a critical event such as `workspace.created.v1` or an owner
  bootstrap acknowledgement exhausts publish attempts or fails terminally
- **THEN** the outbox message is marked `dead_lettered`
- **AND** an observable alert/audit record is required
- **AND** the event is not silently dropped

### Requirement: Workspace Detail
The system SHALL show Workspace core details without reading other modules'
private persistence.

#### Scenario: Workspace detail viewed
- **WHEN** an authorized user opens a workspace detail view
- **THEN** Workspace Management returns Workspace metadata, immutable
  configuration snapshot, lifecycle status, operation summary, and safe runtime
  reference fields
- **AND** it does not embed agent, workflow, or tool data in milestone 1
- **AND** the frontend may load those summaries from the owning modules' public
  endpoints

#### Scenario: Inaccessible detail concealed
- **WHEN** an authenticated actor requests a workspace they cannot access
- **THEN** the API applies the documented concealment policy and returns not
  found unless the workspace is accessible but the specific permission is
  missing

### Requirement: Workspace Deletion
The system SHALL support safe Workspace deletion and OpenClaw runtime cleanup.

#### Scenario: Workspace deletion requested
- **WHEN** an authorized actor deletes a workspace
- **THEN** the system marks the workspace deleting and creates a durable
  deprovision operation before runtime cleanup starts
- **AND** does not remove or finalize metadata before runtime cleanup succeeds
  or is proven unnecessary

#### Scenario: Deprovision succeeds
- **WHEN** runtime cleanup succeeds or provider proves the runtime does not
  exist
- **THEN** the system marks the operation succeeded
- **AND** marks the Workspace `deleted`
- **AND** emits `workspace.deleted.v1` through the outbox

#### Scenario: Deprovision fails
- **WHEN** runtime cleanup fails after retry policy is exhausted
- **THEN** the system marks the Workspace `delete_failed`
- **AND** records sanitized failure code/message
- **AND** leaves metadata available for retry/reconciliation

### Requirement: Deletion Event Semantics
The system SHALL prevent destructive downstream cleanup from
`workspace.deletion_requested.v1`.

#### Scenario: Deletion requested is non-destructive
- **WHEN** consumers receive `workspace.deletion_requested.v1`
- **THEN** they may only perform safe preparation such as blocking new
  workspace-scoped work, quiescing workflows, disabling new scheduling,
  notification, or audit
- **AND** they SHALL NOT irreversibly delete Agent, Workflow, Tool, Task,
  Document, Knowledge, or Membership data

#### Scenario: Deleted event permits owned cleanup
- **WHEN** consumers receive `workspace.deleted.v1`
- **THEN** each consuming module may perform its own idempotent irreversible
  cleanup according to its owned data policy
- **AND** `workspace.deletion_failed.v1` does not imply cleanup completed

### Requirement: Workspace Events
The system SHALL publish versioned Workspace events through an outbox-backed
envelope.

Required events:

- `workspace.created.v1`
- `workspace.provisioning.requested.v1`
- `workspace.ready.v1`
- `workspace.provisioning_failed.v1`
- `workspace.deletion_requested.v1`
- `workspace.deleted.v1`
- `workspace.deletion_failed.v1`

Required Workspace User Management acknowledgement events consumed by Workspace
Management:

- `workspace-membership.owner-established.v1`
- `workspace-membership.owner-establishment-failed.v1`

Workspace event envelope SHALL include `eventId`, `eventType`, `eventVersion`,
`aggregateType="workspace"`, `aggregateId`, `lifecycleVersion`,
`eventSequence`, `occurredAt`, `correlationId`, optional `causationId`, and
`payload`.

Workspace event envelope SHALL match:

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

Workspace Membership bootstrap acknowledgement events SHALL use a different
aggregate envelope:

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

The owner membership acknowledgement payloads SHALL match:

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

#### Scenario: Workspace created event supports membership bootstrap
- **WHEN** a workspace is created
- **THEN** `workspace.created.v1` includes primitive IDs and public data needed
  for Workspace User Management to create owner/admin membership
- **AND** it includes `bootstrapAttemptId` and `bootstrapAttemptVersion`
- **AND** Workspace Management does not write `WorkspaceMember`

#### Scenario: Membership acknowledgement does not use Workspace sequence
- **WHEN** Workspace User Management publishes owner bootstrap acknowledgement
- **THEN** the event declares `aggregateType="workspace-membership-bootstrap"`
- **AND** uses `aggregateId=bootstrapAttemptId`
- **AND** uses `producerEventSequence`
- **AND** SHALL NOT use the Workspace aggregate `eventSequence`

#### Scenario: Event payload excludes secrets
- **WHEN** any Workspace event is persisted or published
- **THEN** it excludes provider credentials, tokens, raw runtime config, stack
  traces, and private infrastructure fields

#### Scenario: Multiple events share one lifecycle version
- **WHEN** one transaction creates more than one event, such as
  `workspace.created.v1` and `workspace.provisioning.requested.v1`
- **THEN** each event has a distinct strictly increasing `eventSequence`
- **AND** consumers SHALL NOT drop one event merely because it has the same
  `lifecycleVersion` as another event

#### Scenario: Duplicate or out-of-order event consumed
- **WHEN** a consumer receives a duplicate Workspace event or an event sequence
  gap/out-of-order delivery
- **THEN** the consumer processes events idempotently by `eventId`
- **AND** uses `eventSequence` only to detect gaps for projections that require
  strict ordering

### Requirement: Consumer Inbox Idempotency
The system SHALL require persistent event deduplication for at-least-once
consumers.

#### Scenario: Consumer processes event transactionally with inbox marker
- **WHEN** Workspace User Management consumes `workspace.created.v1`,
  Workspace consumes bootstrap acknowledgement events, or Workspace updates
  `WorkspaceVisibilityProjection`
- **THEN** the consumer records a `ProcessedDomainEvent` marker with
  `consumerName`, `eventId`, event metadata, processing status, and timestamps
- **AND** uniqueness is `consumerName + eventId`
- **AND** the dedupe marker is written in the same transaction as the consumer's
  state mutation
- **AND** natural unique keys such as `workspaceId + userId` are additional
  protection, not a substitute for event-ID dedupe

#### Scenario: Dead-letter replay remains idempotent
- **WHEN** a dead-lettered event is replayed or requeued
- **THEN** consumers use `ProcessedDomainEvent` to ignore already-processed
  duplicates safely
- **AND** replay does not bypass stale-version or bootstrap-attempt checks

### Requirement: Migration Compatibility
The system SHALL support a planned, additive migration path from the existing
Workspace skeleton before Phase 1 implementation is merged.

#### Scenario: Legacy status mapping
- **WHEN** existing rows contain legacy statuses
- **THEN** migration/backfill maps `pending` to `provisioning`
- **AND** maps `running` without verifiable runtime proof to `provisioning`
  with `runtimeVerificationState=manual_review_required`
- **AND** maps `stopping` without verifiable runtime proof to `deleting` with
  `runtimeVerificationState=manual_review_required`
- **AND** keeps `failed` as `failed` and `deleted` as terminal `deleted`

#### Scenario: Legacy owner mapping
- **WHEN** existing rows contain `userId`
- **THEN** migration/backfill maps it to `createdByUserId` while keeping
  compatibility until a separate reviewed change removes or ignores `userId`

#### Scenario: No fabricated operational history
- **WHEN** existing rows do not have operation or runtime history
- **THEN** migration/backfill SHALL NOT fabricate successful provider attempts,
  retry attempts, or outbox history
- **AND** reconciliation or audit notes handle classification of those rows

#### Scenario: Legacy runtime state cannot be proven
- **WHEN** a legacy `running` or `stopping` row lacks runtime identity,
  provider proof, or valid timestamps
- **THEN** migration preflight fails closed or classifies the row for manual
  review
- **AND** the row is not treated as active or deleted until reconciliation
  proves runtime state

#### Scenario: Legacy nullable fields are fail-closed
- **WHEN** Phase 1 migration handles native and legacy Workspace rows
- **THEN** new native records require resolved provisioning profile at
  domain/use-case level
- **AND** database `resolvedProvisioningProfile` remains nullable because
  legacy rows may have `provisioningProfileSource=legacy_unknown`
- **AND** native records use `ownerBootstrapState=pending`
- **AND** legacy imported records use `ownerBootstrapState=not_applicable`
  unless a current bootstrap attempt is verified
- **AND** imported legacy rows initialize `eventSequence=0` without fake
  historical events

### Requirement: Runtime Reconciliation
The system SHALL handle unknown provider outcomes without creating duplicate
runtimes or orphaning resources.

#### Scenario: Provision timeout has unknown outcome
- **WHEN** the runtime provider times out during provisioning
- **THEN** the system treats the outcome as unknown
- **AND** reconciliation checks provider status before retrying a create against
  the provider

#### Scenario: Runtime exists after deletion requested
- **WHEN** provisioning succeeds after Workspace status has become `deleting`
- **THEN** the system stores enough runtime reference to deprovision it
- **AND** continues the delete lifecycle instead of marking the workspace active

#### Scenario: Runtime missing during deprovision
- **WHEN** the provider proves the runtime no longer exists and no in-flight
  provision associated with the stable provider request key can still materialize
- **THEN** deprovision is treated as idempotent success

#### Scenario: Runtime missing without finality proof
- **WHEN** a provider reports missing runtime but cannot prove
  `runtime_absent_final`
- **THEN** deletion remains `deleting`
- **AND** deprovision is blocked or retry scheduled until finality is known

#### Scenario: Unknown runtime exhausted retries requires manual reconciliation
- **WHEN** an operation reaches max retry attempts and runtime finality remains
  unknown
- **THEN** the operation records sanitized failure data and
  `runtimeFinalityProof=runtime_unknown`
- **AND** provision operations move Workspace to `failed`
- **AND** deprovision operations move Workspace to `delete_failed`
- **AND** the system creates an observable operational incident/audit record
- **AND** public DELETE from `delete_failed` starts a new deprovision operation
  in `reconcile` phase before any provider deprovision command
- **AND** the system SHALL NOT emit `workspace.deleted.v1` until runtime
  finality is proven or cleanup succeeds

#### Scenario: Runtime port supports provider request key reconciliation
- **WHEN** runtime reconciliation is required
- **THEN** `WorkspaceRuntimeProvisioningPort` commands/status checks include
  stable `providerRequestKey` where the provider/adapter can use it
- **AND** provider lookup may use deterministic runtime labels and
  `providerRequestKey`, not only `runtimeRef`

### Requirement: Local Demo Runtime Adapter Scope
The system SHALL treat the local/demo OpenClaw runtime adapter as a separate
gated Phase 4.5 plan, not as production-ready behavior in this change.

#### Scenario: Demo adapter remains gated
- **WHEN** Phase 1 through Phase 4 implementation starts
- **THEN** unit and integration tests use the fake runtime adapter only
- **AND** no controller, domain service, repository, or worker directly calls
  Docker/OpenClaw outside `WorkspaceRuntimeProvisioningPort`
- **AND** a local/demo adapter may be added only after fake adapter
  orchestration tests, provider idempotency/reconciliation proof, cleanup
  checklist, local smoke instructions, and secret/runtime URL security review
  are approved
