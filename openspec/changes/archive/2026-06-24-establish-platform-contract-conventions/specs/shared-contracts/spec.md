## ADDED Requirements

### Requirement: Shared Contract Scope Convention
The shared contract package SHALL expose only stable cross-module transport contracts, shared identifiers, shared statuses, shared roles, shared plans, API envelopes, public summaries, and event/job names that are consumed by more than one module.

#### Scenario: Shared contract remains cross-module
- **WHEN** a developer adds a contract under `packages/shared/src/contracts`
- **THEN** the contract represents a public cross-module boundary or a reusable platform primitive rather than a private module implementation detail

#### Scenario: Feature DTO details stay module-owned
- **WHEN** a module needs feature-specific create, update, or internal command fields
- **THEN** those fields are introduced by the owning module's OpenSpec change instead of being added speculatively by the foundation change

#### Scenario: Existing Task Orchestration contracts remain valid
- **WHEN** this convention change is implemented
- **THEN** existing Task Orchestration shared request and response contracts remain exported and compatible

### Requirement: Entity ID and Status Convention
Shared contracts SHALL use canonical `EntityId` kinds for cross-module identifiers and SHALL distinguish shared lifecycle statuses from module-local statuses.

#### Scenario: Public cross-module identifier uses EntityId
- **WHEN** a public shared DTO exposes an identifier that appears in `ENTITY_ID_KINDS`
- **THEN** the TypeScript contract uses the corresponding `EntityId<"...">` type unless a module-specific compatibility note defers the conversion

#### Scenario: Shared status is reused
- **WHEN** a lifecycle status is consumed by multiple modules or frontend/backend boundaries
- **THEN** the status values are defined in `statuses.ts` and listed in `schema.json`

#### Scenario: Module-local status stays local
- **WHEN** a status is only meaningful inside one module implementation
- **THEN** it remains in that module's contract or domain model until another module consumes it

### Requirement: API Envelope Convention
Shared contracts SHALL define the common API success envelope, failure envelope, metadata, pagination metadata, validation issue shape, and authorization failure expectations.

#### Scenario: Successful API response uses shared envelope
- **WHEN** a module exposes a public HTTP response body
- **THEN** successful responses use `ApiSuccess<T>` or `ApiResponse<T>` with `ok`, `data`, and `meta`

#### Scenario: Failed API response uses shared envelope
- **WHEN** a module returns a known validation, authorization, not-found, or system failure
- **THEN** the response uses `ApiFailure` with a shared `ApiError` shape and a reviewed error code

#### Scenario: Paginated response uses shared pagination metadata
- **WHEN** an endpoint returns a list that can be paginated
- **THEN** the shared API contract provides reusable pagination metadata rather than each module inventing a local pagination shape

#### Scenario: Validation issues use stable fields
- **WHEN** a validation error returns field-level details
- **THEN** each issue exposes stable public fields for the field path, message, and optional issue code

#### Scenario: Authorization failure is distinguishable
- **WHEN** a request is unauthenticated or forbidden
- **THEN** the API error code and HTTP status can distinguish authentication failure from authorization failure

### Requirement: Public DTO Exposure Rules
Shared public DTOs SHALL expose only caller-safe fields and SHALL exclude secrets, credentials, private infrastructure details, and server-owned mutation fields.

#### Scenario: Public DTO excludes secrets
- **WHEN** a DTO is exported from the shared contract package
- **THEN** it does not expose credential, token, password, hash, secret, private key, or raw integration configuration fields

#### Scenario: Public summary contains tenant boundary when needed
- **WHEN** a public summary represents workspace-scoped data that another module or frontend may compare or route
- **THEN** it includes `workspaceId` unless the caller already receives it from an enclosing route or envelope

#### Scenario: Frontend consumes public contracts only
- **WHEN** frontend feature code needs cross-module data shapes
- **THEN** it imports public contracts from `@vcp/shared` and does not import backend, database, worker, or private module implementation files

### Requirement: Request DTO Boundary Rules
Public request DTOs SHALL contain caller-provided intent and SHALL exclude authenticated context, generated identifiers, lifecycle status, timestamps, and persisted infrastructure fields unless the owning OpenSpec change explicitly documents an exception.

#### Scenario: Request body excludes authenticated context
- **WHEN** an API request is workspace-scoped or user-scoped
- **THEN** the public request body does not accept trusted context fields such as `workspaceId` or `submittedByUserId`

#### Scenario: Request body excludes server-generated fields
- **WHEN** a create request is defined in shared contracts
- **THEN** it does not accept generated IDs, lifecycle status, timestamps, or internal routing results from the client

#### Scenario: Cross-module reference uses approved public reference
- **WHEN** a request must refer to an entity owned by another module
- **THEN** it uses a public `EntityId` reference or an approved public summary rather than importing the owning module's private domain type

### Requirement: Contract Convention Verification
The shared contract foundation SHALL include automated checks that verify contract inventory, dependency safety, and DTO exposure conventions.

#### Scenario: Contract inventory includes conventions
- **WHEN** shared contract tests read `schema.json`
- **THEN** the schema includes the platform API, identity, status, event, role, permission, and convention inventory needed by reviewers

#### Scenario: Shared contracts stay dependency-free
- **WHEN** contract tests inspect `packages/shared/src/contracts`
- **THEN** shared contracts do not import backend, frontend, workers, database, Prisma, Express, React, or private app modules

#### Scenario: DTO exposure checks run
- **WHEN** contract tests run
- **THEN** they fail if shared public DTOs expose obvious secret or infrastructure field names without a documented exception
