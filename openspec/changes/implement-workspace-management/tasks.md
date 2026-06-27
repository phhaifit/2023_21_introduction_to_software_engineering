## Phase 1: Database Schema and Migration

- [x] 1.1 Add Workspace Prisma fields: metadata, resolved profile snapshot, runtime reference, lifecycle timestamps, failure fields, bootstrap attempt fields, migration provenance fields
- [x] 1.2 Add `WorkspaceProvisioningOperation` with idempotency, operation family, execution phase, dependency, finality proof, retry, lease, and version fields
- [x] 1.3 Add `OutboxMessage` with lease, retry, dead-letter, and version fields
- [x] 1.4 Add `WorkspaceCommandReceipt` model with scope and unique constraints
- [x] 1.5 Add `WorkspaceVisibilityProjection` schema
- [x] 1.6 Add `ProcessedDomainEvent` inbox schema
- [x] 1.7 Generate and apply Prisma migration
- [x] 1.8 Add schema contract tests for ownership, indexes, and non-secret fields

## Phase 2: Domain and State-Machine

- [x] 2.1 Implement name and profile validation
- [x] 2.2 Implement canonical lifecycle status type and transition guards
- [x] 2.3 Unit test all valid/invalid transitions
- [x] 2.4 Unit test idempotency replay and conflict behavior
- [x] 2.5 Unit test delete-while-provisioning and late-provision-after-delete-requested behavior

## Phase 3: Repository and Persistence

- [x] 3.1 Implement Workspace repository interface
- [x] 3.2 Implement Prisma repository and mapper
- [x] 3.3 Implement operation repository with atomic claim, lease, retry, and completion
- [x] 3.4 Implement outbox repository and command receipt repository
- [ ] 3.5 Add PostgreSQL-backed persistence tests for operation uniqueness, lease recovery, atomic eventSequence, projection pagination, and inbox dedupe

## Phase 4: Worker and Orchestration

- [x] 4.1 Implement `WorkspaceRuntimeProvisioningPort` and fake test adapter
- [x] 4.2 Implement create use case persisting Workspace, operation, and outbox atomically
- [x] 4.3 Implement delete use case marking `deleting` and recording deprovision operation
- [x] 4.4 Implement worker orchestration for provision/deprovision success, retry, unknown outcome, cancellation, and reconciliation
- [x] 4.5 Implement outbox publisher with at-least-once delivery and idempotent consumer guidance
- [ ] 4.6 Add PostgreSQL-backed worker tests: crash recovery, duplicate operation prevention, unknown outcome reconciliation, finality barrier

## Phase 4.5: Local/Demo OpenClaw Adapter

- [x] 4.5.1 Implement local/demo adapter behind `WorkspaceRuntimeProvisioningPort`
- [x] 4.5.2 Add fake-runner tests covering provision, deprovision, reconciliation, and unknown outcomes
- [x] 4.5.3 Add manual smoke-test documentation

## Phase 5: API Integration

- [x] 5.1 Implement HTTP validators for Workspace routes
- [x] 5.2 Implement `GET /api/workspaces` with cursor pagination
- [x] 5.3 Implement `POST /api/workspaces` returning `202 Accepted`
- [x] 5.4 Implement `GET /api/workspaces/:workspaceId`
- [x] 5.5 Implement `DELETE /api/workspaces/:workspaceId` returning `202 Accepted`
- [x] 5.6 Add API tests for auth, authorization, entitlement denial, validation, concealment, lifecycle conflict, idempotency replay/conflict, list pagination, and delete-while-provisioning
- [ ] 5.7 Add API tests for DELETE on `delete_failed` retry and bootstrap expired/failed behavior

## Phase 6: Frontend Integration

- [x] 6.1 Implement Workspace API client using shared public DTOs
- [x] 6.2 Build workspace list states: loading, empty, error, all canonical statuses
- [x] 6.3 Build create form using `name` and `requestedProfile` only
- [x] 6.4 Build detail view for Workspace core metadata and public module links
- [x] 6.5 Build delete confirmation and reflect `deleting`/failure states
- [x] 6.6 Add component tests for list, create, detail, delete, and status rendering

## Phase 7: Architecture Verification and Merge Gate

- [x] 7.1 Add architecture tests preventing Workspace private imports from other modules
- [x] 7.2 Add contract tests for Workspace DTOs, statuses, event envelopes, error codes, and forbidden secret fields
- [x] 7.3 `npm test` — passed
- [x] 7.4 `npm run build` — passed
- [x] 7.5 `npm run test:contracts` — passed
- [x] 7.6 `npm run prisma -- validate` — passed
- [ ] 7.7 `openspec validate "implement-workspace-management" --strict` — blocked (openspec not in PATH)
- [ ] 7.8 `openspec validate --all --strict` — blocked (openspec not in PATH)
- [x] 7.9 `git diff --check` — passed
- [x] 7.10 Update Workspace module README

## Verification and Handoff

- [x] Run `npm run test:workspace-management:domain` — 35 tests passed
- [x] Run `npm run test:workspace-management:orchestration` — 43 tests passed
- [x] Run `npm run test:workspace-management:local-demo` — 28 tests passed
- [x] Run `npm run test:workspace-management:api` — 45 tests passed
- [x] Run frontend component tests — 25 tests passed
- [ ] Real PostgreSQL connectivity and migration deployment (Phase 1/3/4 verification debt)
- [ ] Production OpenClaw adapter security review
