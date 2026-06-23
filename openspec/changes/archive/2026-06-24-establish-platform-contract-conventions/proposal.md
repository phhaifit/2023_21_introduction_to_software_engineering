## Why

Feature teams are already adding shared contracts, including Task Orchestration request and response types, but the repo does not yet enforce a clear convention for what belongs in `@vcp/shared` versus module-owned code. This change standardizes the platform contract rules before more modules add DTOs, routes, and frontend integrations that could drift from each other.

## What Changes

- Establish explicit shared contract conventions for identity kinds, API response envelopes, pagination metadata, validation errors, authorization errors, public DTO exposure, and request DTO boundaries.
- Extend shared contract verification so conventions are checked directly instead of relying on review memory.
- Clarify that existing Task Orchestration shared contracts are a valid precedent and should be preserved.
- Defer full feature DTO definitions for Authentication, Workspace, Workspace User, Tools, Workflow, Knowledge, and Subscription implementation details to their owning OpenSpec changes.
- Do not introduce endpoint implementations, persistence changes, runtime behavior, or a complete DTO catalog for every module in this foundation change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `shared-contracts`: add requirements for public contract conventions, API envelope extensions, DTO exposure rules, request DTO ownership, and automated boundary checks.

## Impact

- Affected files are expected under `packages/shared/src/contracts/`, especially API and schema inventory files.
- Contract verification is expected in `tests/contract/shared-contracts.test.mjs`, with possible focused tests for dependency direction and DTO exposure rules.
- Existing Task Orchestration shared contracts should remain compatible.
- No database migration, backend route implementation, frontend workflow implementation, or worker implementation is in scope.
