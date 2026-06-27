## Phase 0.5: Contract and OpenSpec Approval Gate

Definition of Done:

- [ ] 0.1 Review and approve `docs/architecture/workspace-management-readiness-review.md`.
- [ ] 0.2 Resolve all conflict-matrix items between OpenSpec, ADR, audit, and readiness review.
- [ ] 0.3 Approve canonical lifecycle statuses, error taxonomy, event envelope, and detail aggregation strategy.
- [ ] 0.4 Approve `WorkspaceAccessQueryPort`, `WorkspaceEntitlementPort`, and runtime provisioning port contracts.
- [ ] 0.5 Add or update shared contract proposal/test plan for Workspace DTOs, statuses, cursor pagination envelope, events, and errors.
- [ ] 0.6 Run OpenSpec validation when the CLI is available.
- [ ] 0.7 Confirm the readiness review file exists and has status `proposed-for-review`.
- [ ] 0.8 Approve the full lifecycle transition matrix and race-condition matrix.
- [ ] 0.9 Approve bounded bootstrap owner access, bootstrap list visibility, expiry, and no privilege resurrection policy.
- [ ] 0.10 Approve mandatory `Idempotency-Key` header scope, retention, replay, and conflict behavior.
- [ ] 0.11 Approve Workspace operation worker plus generic outbox event publisher topology.
- [ ] 0.12 Approve migration compatibility plan for legacy Workspace skeleton/status rows.
- [ ] 0.13 Approve exact Workspace event payload schemas, `lifecycleVersion`, `eventSequence`, ordering, and idempotent consumer rules.
- [ ] 0.14 Approve event sequence versus lifecycle version split.
- [ ] 0.15 Approve outbox stale lease recovery, retry, and dead-letter policy.
- [ ] 0.16 Approve delete/provision dependency and runtime finality barrier.
- [ ] 0.17 Approve bootstrap acknowledgement event contract.
- [ ] 0.18 Approve `WorkspaceVisibilityProjection` pagination port and Workspace-owned cursor model.
- [ ] 0.19 Approve legacy migration fail-closed policy.
- [ ] 0.20 Approve operation family partial unique index strategy.
- [ ] 0.21 Approve canonical public API error taxonomy.
- [ ] 0.22 Approve DELETE retry behavior for `delete_failed`.
- [ ] 0.23 Approve Phase 4.5 local/demo OpenClaw adapter roadmap as plan-only.
- [ ] 0.24 Approve separate aggregate envelopes for Workspace events and Workspace Membership bootstrap acknowledgement events.
- [ ] 0.25 Approve bootstrap attempt ID/version state machine and stale-event rejection rules.
- [ ] 0.26 Approve `WorkspaceCommandReceipt` model, scope, retention, and unique constraints.
- [ ] 0.27 Approve nullable legacy profile design and `not_applicable` bootstrap state.
- [ ] 0.28 Approve `WorkspaceVisibilityProjection` query strategy and projection ownership.
- [ ] 0.29 Approve `ProcessedDomainEvent` inbox policy for at-least-once consumers.
- [ ] 0.30 Approve `workspace.deletion_requested.v1` non-destructive consumer semantics.
- [ ] 0.31 Approve unknown runtime manual reconciliation runbook.

Cannot proceed unless:

- Source of truth between OpenSpec and ADR is consistent.
- Public retry endpoints are either explicitly deferred or fully specified.
- Workspace quota/name-retention/rate-limit product decisions are marked as approved or unresolved.
- Conflict matrix has no unresolved P0 contradiction.
- Bootstrap access/list policy is explicit in spec, design, ADR, and readiness review.
- Create/Delete idempotency semantics are explicit in spec, design, ADR, and readiness review.
- Operation/outbox/lease/retry/zombie-worker policy is explicit before any schema or worker code starts.
- Event sequencing, event aggregate ownership, delete finality, bootstrap acknowledgement, command receipt idempotency, visibility projection pagination, fail-closed migration, canonical errors, delete retry, inbox policy, deletion event semantics, manual reconciliation, runtime port provider request key, API envelope naming, and Phase 4.5 roadmap are consistent across proposal, design, spec, ADR, readiness review, and tasks.

## Phase 1: Database Operation Model and Migration

Definition of Done:

- [x] 1.1 Design and implement Workspace-owned Prisma fields for metadata, resolved profile snapshot, non-secret runtime reference, lifecycle timestamps, and sanitized failure fields.
- [x] 1.2 Design and implement `WorkspaceProvisioningOperation` with idempotency, request fingerprint, operation family, execution phase, dependency, runtime finality proof, unknown outcome, retry, lease, cancellation, and version fields.
- [x] 1.3 Design and implement `OutboxMessage` or approved equivalent for Workspace events with `eventSequence`, lease expiry, version, retry scheduling, max attempts, terminal failure, and dead-letter fields.
- [x] 1.4 Add generated Prisma migration using the canonical schema and migration directory.
- [x] 1.5 Add schema/migration contract tests for ownership, indexes, uniqueness, and non-secret fields.
- [x] 1.6 Add migration compatibility test plan for fresh database and existing legacy Workspace data.
- [x] 1.7 Add legacy status mapping fixture covering `pending`, `running`, `stopping`, `failed`, and `deleted`.
- [x] 1.8 Review partial unique index/manual SQL strategy for active provisioning/deprovisioning family uniqueness.
- [x] 1.9 Add database field/transaction strategy for atomic per-Workspace `eventSequence` allocation.
- [x] 1.10 Add migration provenance and verification fields: `migrationOrigin`, `runtimeVerificationState`, and `provisioningProfileSource`.
- [x] 1.11 Add preflight legacy data validation plan for unsafe legacy rows and future uniqueness violations.
- [x] 1.12 Document that legacy rows do not receive fabricated operation history, runtime refs, or resolved profile snapshots.
- [x] 1.13 Add logical schema/migration design for `WorkspaceCommandReceipt`.
- [x] 1.14 Add Workspace bootstrap attempt fields: `ownerBootstrapAttemptId`, `ownerBootstrapAttemptVersion`, `ownerBootstrapRequestedAt`, failure fields, and `not_applicable` state.
- [x] 1.15 Add `WorkspaceVisibilityProjection` schema/projection boundary.
- [x] 1.16 Add `ProcessedDomainEvent` schema strategy or approved platform dependency.
- [x] 1.17 Add legacy nullable field migration plan for `resolvedProvisioningProfile` and profile source.
- [x] 1.18 Add exact partial unique indexes for operation family and command receipt where needed.

Cannot proceed unless:

- Migration applies to a fresh database.
- Migration/backfill test verifies existing data compatibility and legacy status mapping.
- Workspace tables do not create membership, subscription, agent, workflow, tool, task, credential, document, or vector tables.
- Backend code uses `@vcp/database`, not relative Prisma internals or `@prisma/client`.
- Migration does not fabricate operation history for legacy rows.

Phase 1 verification gate:

- [ ] Fresh database migration deployment.
- [ ] Second deploy has no pending migration.
- [ ] Legacy fixture upgrade.
- [ ] Legacy fail-closed mapping.
- [ ] Manual partial unique index behavior.
- [ ] Command receipt uniqueness behavior.
- [ ] Outbox uniqueness behavior.
- [ ] Projection/inbox uniqueness behavior.
- [x] Preflight read-only validation.

## Phase 2: Domain and State-Machine Unit Tests

Definition of Done:

- [x] 2.1 Implement Workspace name validation and requested profile validation.
- [x] 2.2 Implement canonical lifecycle status type and transition guard.
- [x] 2.3 Unit test all valid and invalid transitions in the readiness transition matrix.
- [x] 2.4 Unit test idempotency replay and idempotency conflict behavior.
- [x] 2.5 Unit test delete-while-provisioning and runtime-provisioned-after-delete-requested behavior.

Cannot proceed unless:

- No controller, Prisma adapter, worker, or UI code bypasses domain transition guards.
- No raw provider error or secret can enter public failure fields.

## Phase 3: Repository and Persistence Tests

Definition of Done:

- [x] 3.1 Implement Workspace repository interface inside the Workspace module.
- [x] 3.2 Implement Prisma repository/mapper through `@vcp/database`.
- [x] 3.3 Implement operation repository with atomic claim, lease token, optimistic version, retry scheduling, and completion/failure updates.
- [x] 3.4 Implement outbox repository or approved equivalent.
- [ ] 3.5 Add repository/persistence tests for create, list by IDs, detail, lifecycle updates, operation claim, lease recovery, and outbox atomicity.
- [ ] 3.6 Add tests for optimistic concurrency conflicts and stale lease recovery.
- [ ] 3.7 Add tests proving zombie workers cannot complete operations after losing the lease.
- [ ] 3.8 Add tests preventing duplicate worker claims and duplicate active provision/deprovision operations.
- [ ] 3.9 Add tests for operation cancellation/supersession and stable provider request keys.
- [ ] 3.10 Add tests for atomic `eventSequence` allocation in the same transaction as state/outbox writes.
- [ ] 3.11 Add tests for outbox stale lease recovery and current lease-token enforcement.
- [ ] 3.12 Add tests for outbox terminal failure and `dead_lettered` observability fields.
- [ ] 3.13 Add tests for persisted deprovision dependency barrier on active/unknown provision operations.
- [ ] 3.14 Add tests for provisioning/deprovisioning family uniqueness with manual partial unique index behavior.
- [ ] 3.15 Add tests for fail-closed legacy row classification and `manual_review_required`.
- [ ] 3.16 Add repository tests for `WorkspaceVisibilityProjection` list pagination using last-returned eligible cursor tuples.
- [ ] 3.17 Add command receipt atomic create/delete/replay tests.
- [ ] 3.18 Add cross-actor same-key isolation test.
- [ ] 3.19 Add membership event aggregate ownership test.
- [ ] 3.20 Add bootstrap attempt version stale-event rejection test.
- [ ] 3.21 Add projection grant/revoke and stale-version tests.
- [ ] 3.22 Add projection cursor no-leak/no-duplicate tests.
- [ ] 3.23 Add inbox dedupe and dead-letter replay tests.
- [ ] 3.24 Add legacy native/unknown profile nullability tests.

Cannot proceed unless:

- Repository code does not import private modules from Authentication, Workspace User Management, Subscription, Agent, Workflow, Tools, Task, or Knowledge Base.
- Tests prove metadata is not marked deleted before runtime cleanup succeeds or is proven unnecessary.
- Tests prove active provision/deprovision operation uniqueness is enforced.

Phase 3 provisional verification:

- Repository interfaces and Prisma persistence adapters were added under the
  Workspace Management module only.
- Implemented repository primitives cover Workspace lifecycle/event-sequence
  persistence, Workspace operations, Outbox messages, command receipts,
  visibility projections, processed-domain-event inbox records, and a Prisma
  unit-of-work boundary.
- Focused mapper/query-contract tests pass without PostgreSQL:
  `npm run test:workspace-management:persistence` passed with 1 test file and
  21 tests.
- Phase 3 remains partial. Items 3.5-3.24 are intentionally unchecked because
  their database behavior, partial indexes, leases, transaction atomicity,
  uniqueness, stale-lease recovery, and legacy migration behavior still require
  a disposable non-production PostgreSQL verification run.
- `WorkspaceCommandReceipt` accepts an `expectedVersion` call contract in the
  repository interface, but the current Phase 1 Prisma model has no receipt
  `version` column. DB-level receipt optimistic concurrency is therefore not
  claimed as verified in this phase.

## Phase 4: Worker, Outbox, and Provisioning Orchestration

Definition of Done:

- [ ] 4.1 Implement `WorkspaceRuntimeProvisioningPort` and fake test adapter.
- [ ] 4.2 Implement create use case that persists Workspace, operation, and outbox atomically before provisioning starts.
- [ ] 4.3 Implement delete use case that marks deleting and records deprovision operation before external cleanup starts.
- [ ] 4.4 Implement worker orchestration for provision/deprovision success, retryable failure, terminal failure, timeout unknown, cancellation, and reconciliation.
- [ ] 4.5 Implement outbox publication workflow with at-least-once delivery assumptions and idempotent consumer guidance.
- [ ] 4.6 Add tests for provisioning success/failure, delete success/failure, worker crash recovery points, and no duplicate runtime creation.
- [ ] 4.7 Add tests for unknown provider outcome requiring reconciliation before retry.
- [ ] 4.8 Add tests for provider runtime created but DB update crash recovery.
- [ ] 4.9 Add tests requiring `runtime_absent_final` before provider runtime missing can complete deprovision as idempotent success.
- [ ] 4.10 Add tests for outbox persistence in the same transaction as state change and outbox publication retry.
- [ ] 4.11 Add tests for duplicate event delivery and ordering with the same `lifecycleVersion` but different `eventSequence`.
- [ ] 4.12 Add tests for delete while provisioning and provision completion after deletion request.
- [ ] 4.13 Add tests proving the operation worker and outbox publisher do not execute the same provider command.
- [ ] 4.14 Add `delete_cannot_finalize_while_provision_unknown`.
- [ ] 4.15 Add `delete_waits_for_provision_dependency`.
- [ ] 4.16 Add `late_provision_after_delete_is_deprovisioned`.
- [ ] 4.17 Add `provider_missing_without_finality_is_not_delete_success`.
- [ ] 4.18 Add outbox publisher crash-after-publish-before-DB-update test.
- [ ] 4.19 Add bootstrap acknowledgement duplicate/out-of-order handling tests.
- [ ] 4.20 Add membership creation plus acknowledgement outbox transaction test.
- [ ] 4.21 Add bootstrap dead-letter and replay test.
- [ ] 4.22 Add deletion-requested cannot trigger destructive cleanup contract test.
- [ ] 4.23 Add unknown runtime after max retries produces manual-reconciliation-required state.
- [ ] 4.24 Add DELETE retry from `delete_failed` starts reconciliation before provider deprovision.
- [ ] 4.25 Add test proving provider request key is available in runtime reconciliation port contract.

Cannot proceed unless:

- Tests do not call real Docker/OpenClaw.
- Runtime adapter receives idempotency/correlation keys and stable `providerRequestKey`.
- Unknown provider outcome is reconciled before retrying provider create.
- Outbox publication is event-only and cannot dispatch provision/deprovision commands.

Phase 4 provisional implementation:

- Added fake-only application ports for runtime provisioning, Workspace access,
  entitlement resolution, event publication, deterministic IDs, clock, and
  provider request keys.
- Added application use cases for Workspace create acceptance, Workspace delete
  acceptance, one-operation processing, and one-outbox-message publishing.
- Added pure services for command fingerprinting, Workspace-owned event factory
  validation, non-destructive deletion-request payloads, and bootstrap access
  planning.
- Added deterministic fake runtime adapter, event publisher, clock, ID factory,
  and provider request-key factory for unit tests only.
- Added `npm run test:workspace-management:orchestration`; it passed with 1
  test file and 43 fake-only unit/mock tests.
- Phase 4 remains partial and provisional. The following are still unverified:
  real Prisma transaction atomicity, active operation partial uniqueness,
  receipt/outbox/projection/inbox uniqueness, lease concurrency, stale lease
  recovery, database rollback behavior, runtime provider behavior, event broker
  delivery, and full legacy migration compatibility.
- Phase 4.5, Phase 5, Phase 6, and Phase 7 remain blocked.

## Phase 4.5: Local/Demo OpenClaw Runtime Adapter

Definition of Done:

- [x] 4.5.1 Keep this phase plan-only until explicitly approved after fake adapter orchestration tests pass.
- [x] 4.5.2 Implement only through `WorkspaceRuntimeProvisioningPort`; no controller/domain direct Docker/OpenClaw calls.
- [x] 4.5.3 Gate adapter enablement behind explicit environment/config flags.
- [ ] 4.5.4 Resolve Docker/OpenClaw credentials only through environment/secret storage.
- [x] 4.5.5 Store only opaque non-secret `runtimeRef` in Workspace.
- [x] 4.5.6 Apply deterministic labels: `platform.workspaceId`, `platform.operationId`, and `platform.providerRequestKey`.
- [x] 4.5.7 Support provider reconciliation by stable provider request key and labels.
- [ ] 4.5.8 Support idempotent delete, timeout, cancellation, and unknown-outcome behavior.
- [ ] 4.5.9 Keep local/demo adapter out of unit/integration tests.
- [x] 4.5.10 Add separate local manual smoke test instructions.
- [x] 4.5.11 Add cleanup checklist for containers, networks, and volumes.
- [ ] 4.5.12 Require security review of runtime URL exposure and secret handling.
- [x] 4.5.13 Document that the adapter does not claim production readiness.

Cannot proceed unless:

- Fake adapter orchestration tests pass.
- Provider idempotency/reconciliation behavior is proven locally.
- Container cleanup works after delete and failure.
- Runtime secrets never appear in database, event payload, logs, or API response.

Phase 4.5 local-demo implementation evidence:

- Added local/demo infrastructure under
  `apps/backend/src/modules/workspace-management/infrastructure/local-demo/`.
- Added `DockerCommandRunner` with argv-array execution and no shell command
  construction in adapter code.
- Added disabled/fake/local-demo adapter selection through
  `WorkspaceRuntimeProvisioningPort`.
- Added explicit config gate:
  `WORKSPACE_RUNTIME_MODE=disabled|fake|local-demo` and
  `WORKSPACE_LOCAL_DEMO_ENABLED=true|false`.
- Added deterministic managed labels:
  `platform.managedBy`, `platform.workspaceId`, `platform.operationId`,
  `platform.providerRequestKey`, and `platform.adapterVersion`.
- Added fake-runner tests for local-demo provisioning, exact-owned reuse,
  ownership mismatch rejection, status reconciliation, absent-final proof,
  deprovision ownership guard, post-remove reconciliation, timeout unknown
  outcomes, no auto-pull, no prune, no privileged mode, no host networking, no
  port publication, no runtime URL exposure by default, and no secret material
  in returned failure data.
- Added manual local smoke-test and cleanup documentation in
  `docs/architecture/workspace-local-demo-adapter.md`.
- `npm run test:workspace-management:local-demo` passed with 1 test file and
  28 tests.
- No real Docker/OpenClaw smoke test has been run. Security review remains
  open. Phase 1 PostgreSQL verification debt remains open. Phase 5 and later
  phases remain blocked.

## Phase 5: API Integration

Definition of Done:

- [x] 5.1 Implement runtime request validators for Workspace routes.
- [x] 5.2 Implement `GET /api/workspaces`.
- [x] 5.3 Implement `POST /api/workspaces` returning `202 Accepted`.
- [x] 5.4 Implement `GET /api/workspaces/:workspaceId`.
- [x] 5.5 Implement `DELETE /api/workspaces/:workspaceId` returning `202 Accepted`.
- [x] 5.6 Add integration tests for authentication, authorization, entitlement denial, validation, not found/concealment, lifecycle conflict, idempotency replay/conflict, list pagination, and delete while provisioning.
- [x] 5.7 Add API tests for mandatory `Idempotency-Key` on POST and every DELETE, same-key same-payload replay, and same-key different-payload conflict.
- [x] 5.8 Add API tests that repeated DELETE in `deleting` returns the same operation with `202`.
- [ ] 5.9 Add API tests for DELETE on `delete_failed` creating exactly one retry operation after reconciliation and deprovisioning-family uniqueness checks.
- [ ] 5.10 Add API tests for bootstrap detail/list/delete behavior and bootstrap event delayed, failed, duplicate, out-of-order, and expired behavior.
- [x] 5.11 Add API tests for projection-backed pagination with no skip/duplicate behavior.
- [x] 5.12 Add API response/error tests proving secret, legacy internal, runtime internal, lease, provider key, and provisioning technical metadata are not exposed.
- [x] 5.13 Add tests proving same actor/same command/same key replays the exact stored response.
- [x] 5.14 Add tests proving different actors using the same key do not collide.
- [x] 5.15 Add tests for `delete_failed` retry receipt behavior.
- [x] 5.16 Add tests proving list never reveals cross-user Workspace existence.
- [ ] 5.17 Add tests for list consistency after membership projection lag.
- [x] 5.18 Add tests proving detail/delete always use authoritative access decision, not projection only.

Cannot proceed unless:

- All responses use the shared API envelope.
- Workspace routes do not expose provider secrets, raw runtime config, lease tokens, stack traces, or internal DB errors.
- Public retry endpoints remain absent unless a reviewed permission and contract are added.
- Concealment policy is verified for inaccessible and deleted workspaces.

Phase 5 provisional API evidence:

- Added shared public Workspace DTOs and cursor pagination envelope in
  `packages/shared/src/contracts/`.
- Added Workspace list/detail application query use cases.
- Added Workspace HTTP validators, controller, response mapper, cursor helper,
  route module, and explicit HTTP dependency shape under
  `apps/backend/src/modules/workspace-management/interface/http/`.
- Added fake/in-memory API test composition under
  `apps/backend/src/modules/workspace-management/testing/`.
- Added `npm run test:workspace-management:api`; it passed with 1 test file and
  45 fake/in-memory tests.
- Covered safe response field policy for list, create, detail, and delete:
  no runtime refs, runtime URLs, provider request keys, lease tokens, command
  receipt IDs, request fingerprints, outbox IDs, raw profile snapshots,
  membership projection versions, bootstrap internals, or stack traces.
- Covered request validation for body fields, route IDs, `Idempotency-Key`,
  cursor, limit, unsupported query parameters, and DELETE body rejection.
- Covered authentication, concealment, known-forbidden 403, bootstrap
  creator-only access, idempotency replay/conflict, cross-actor same-key
  isolation, no runtime provider calls, and no delete finalization in the API.
- Phase 5 remains partial and provisional. Real PostgreSQL adapters,
  transaction atomicity, DB uniqueness, real authorization/entitlement
  adapters, projection lag behavior, event consumers, outbox delivery, real
  runtime cleanup, production composition, and production frontend
  verification remain unverified.
- Phase 6 frontend is now provisionally implemented under the Phase 6 waiver.
  Phase 7 remains not started.

## Phase 6: Frontend Integration

Definition of Done:

- [x] 6.1 Implement Workspace API client using shared public DTOs.
- [x] 6.2 Build workspace list states: loading, empty, error, provisioning/active/failed/deleting/delete_failed/deleted status rendering, timestamps.
- [x] 6.3 Build create form using name and requested profile only.
- [x] 6.4 Build detail view for Workspace core metadata/status and links to public Agent/Workflow/Tool sections.
- [x] 6.5 Build delete confirmation and reflect `deleting`/failure states truthfully.
- [x] 6.6 Add component tests for list, create submit, detail, delete interaction, and status rendering.

Cannot proceed unless:

- Backend API contracts and tests have passed.
- Frontend production path does not use fake Workspace domain data.
- Agent/Workflow/Tool summaries are loaded only from owning modules' public endpoints when available.

Phase 6 provisional frontend evidence:

- Added Workspace frontend runtime code under
  `apps/frontend/src/features/workspace-management/` plus Workspaces shell
  route/navigation wiring.
- Runtime frontend path uses public Workspace DTOs and the Workspace API client;
  tests inject mock API clients or mocked `fetch` only. No fake Workspace
  domain records are used by the production runtime path.
- Create form sends only `name` and `requestedProfile`, with `Idempotency-Key`
  on create. Delete sends `Idempotency-Key` and no request body.
- List/detail/delete UI covers loading, empty, safe error, all canonical
  Workspace statuses, safe timestamps, public module links, deleting, and
  delete_failed states without exposing runtime refs, provider keys, receipts,
  credentials, stack traces, or lease material.
- Focused component/API-client tests live in
  `tests/component/workspace-management-frontend.test.tsx`.
- The broad failure-message assertion was replaced with a scoped exact
  assertion under the safe failure summary. The frontend architecture scan now
  inspects import/export specifiers and runtime call patterns instead of
  failing on safe visible text containing `OpenClaw`.
- `npx vitest run --config vitest.config.ts tests/component/workspace-management-frontend.test.tsx`
  passed with 1 test file and 25 tests.
- `npm run test:workspace-management:frontend` is unavailable because no such
  package script exists and the Phase 6 continuation explicitly forbade package
  manifest changes.
- Workspace backend/domain validation sequence passed for domain, persistence,
  orchestration, local-demo, API, schema contract, and contracts. The
  sandboxed `test:contracts` attempt failed on localhost `EPERM`; rerun with
  localhost access passed.
- `npm test` passed when rerun with localhost access. `npm run build` passed.
- Phase 6 remains provisional frontend-only. Real PostgreSQL, real
  authorization/entitlement adapters, projection lag, production API
  composition, Docker/OpenClaw/runtime provider behavior, and end-to-end
  browser deployment remain unverified.
- Phase 7 has not been started.

## Phase 7: Architecture Verification and Merge Gate

Definition of Done:

- [x] 7.1 Add architecture tests or contract tests preventing Workspace private imports from other feature modules.
- [x] 7.2 Add shared contract tests for Workspace DTO exposure, statuses, event envelope, error codes, and forbidden secret fields.
- [x] 7.3 Run `npm test`.
- [x] 7.4 Run `npm run build`.
- [x] 7.5 Run `npm run test:contracts`.
- [x] 7.6 Run `npm run prisma -- validate`.
- [ ] 7.7 Run `openspec validate "implement-workspace-management" --strict`.
- [ ] 7.8 Run `openspec validate --all --strict`.
- [x] 7.9 Run `git diff --check`.
- [x] 7.10 Update Workspace module README with lifecycle, public contracts, and runtime operation model.
- [x] 7.11 Add architecture tests proving shared contracts do not import feature module code.
- [x] 7.12 Add architecture tests proving Workspace Prisma repository imports only `@vcp/database`.
- [x] 7.13 Add architecture tests proving Workspace has no direct foreign table repository access.
- [x] 7.14 Add architecture tests proving frontend Workspace code cannot import backend, database, or workers.
- [x] 7.15 Add contract tests proving Workspace response DTOs cannot expose secret/runtime internal fields.
- [x] 7.16 Add contract tests proving versioned Workspace event schemas contain required envelope fields.
- [x] 7.17 Add contract test verifying membership acknowledgement events do not declare `aggregateType: "workspace"`.
- [x] 7.18 Add contract test verifying Workspace events are producer-owned by Workspace and use Workspace `eventSequence`.
- [x] 7.19 Add contract test verifying idempotency receipt scope.
- [x] 7.20 Add contract test verifying no secret/internal metadata in receipt response snapshots.
- [x] 7.21 Add architecture test verifying `WorkspaceVisibilityProjection` does not become Membership source of truth.
- [x] 7.22 Add architecture test verifying deletion-requested consumers do not perform destructive cleanup contracts.

Cannot proceed unless:

- Failed commands are documented with exact errors and owners.
- `.local-docs/` and personal directories remain untouched.
- PR summary lists shared contract, Prisma, API, event, worker, and frontend impacts.
- Architecture/import enforcement checks pass or any blocker is assigned to a concrete owner.

Phase 7 merge-gate evidence:

- Added import-aware Workspace architecture checks to
  `tests/contract/workspace-management-db-schema.test.mjs`; these run through
  `node tests/contract/workspace-management-db-schema.test.mjs` and
  `npm run test:contracts`.
- Added checks for Workspace feature isolation, shared contract isolation,
  Prisma import boundary, frontend import/runtime-call boundary, visibility
  projection ownership, non-destructive deletion-request semantics, canonical
  public Workspace statuses, API error codes, safe public DTO fields, Workspace
  event envelope fields, membership acknowledgement aggregate separation,
  eventSequence ownership, receipt idempotency scope, and receipt safe-response
  guard.
- Added root `npm run test:workspace-management:frontend` script matching the
  existing Workspace Vitest script style.
- Updated `apps/backend/src/modules/workspace-management/README.md` with
  ownership, API routes, lifecycle, idempotency, operations, outbox, visibility,
  local-demo constraints, `NOT PRODUCTION READY`, and retained debt.
- `git diff --check`: passed.
- `npm run test:contracts`: sandboxed run failed on localhost
  `EPERM 127.0.0.1:3333`; rerun with localhost access passed.
- `npm run test:workspace-management:domain`: passed with 35 tests.
- `npm run test:workspace-management:persistence`: passed with 21 tests.
- `npm run test:workspace-management:orchestration`: passed with 43 tests.
- `npm run test:workspace-management:local-demo`: passed with 28 tests.
- `npm run test:workspace-management:api`: passed with 45 tests.
- `npm run test:workspace-management:frontend`: passed with 25 tests.
- `node tests/contract/workspace-management-db-schema.test.mjs`: passed.
- `npm run prisma -- validate` with a non-secret placeholder `DATABASE_URL`:
  passed. This does not prove database connectivity or migration deployment.
- `npm run prisma -- generate` with a non-secret placeholder `DATABASE_URL`:
  passed. Generated-client trailing whitespace was mechanically stripped after
  generation so `git diff --check` passes.
- `npm test`: sandboxed run failed on localhost `EPERM 127.0.0.1:3333`;
  rerun with localhost access passed.
- `npm run build`: passed.
- `openspec validate "implement-workspace-management" --strict`: failed because
  `openspec` is not available in PATH.
- `openspec validate --all --strict`: failed because `openspec` is not
  available in PATH.
