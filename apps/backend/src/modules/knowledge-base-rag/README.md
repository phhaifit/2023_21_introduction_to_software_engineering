# Knowledge Base / RAG Module

Owner: Member 9

Active OpenSpec change: `implement-knowledge-base-rag`.

Foundation reference: see `docs/module-ownership.md`,
`docs/architecture.md`, `docs/team-module-implementation-guide.md`, and
`docs/knowledge-base-rag-context.md`.

## Current Status

This backend module now contains the internal backend foundation for domain
models, application repository ports, application use cases, safe DTO mappers,
Prisma repository adapters, deterministic in-memory repositories, and a thin
workspace-scoped HTTP API router.

It still does not contain real file parsing, file storage adapters,
vector/embedding adapters, worker handlers, or frontend API-client
implementation.

The frontend prototype already contains a base layout, shared KB/RAG UI
components, local mock data/types, a Documents screen, and an Upload Documents
screen. Backend implementation must not assume those local mock types are the
final API contract.

## Boundary

This module owns:

- Document metadata and lifecycle state.
- Upload validation and prepare intent.
- Ingestion requests and ingestion job status.
- Document chunks and embedding/indexing status.
- External data source connection metadata.
- Synchronization scope configuration.
- Manual and future automated sync job state.
- Knowledge access and retrieval boundaries.

This module references but does not own:

- User identity from Authentication.
- Workspace and workspace membership from Workspace Management and Workspace
  User Management.
- Agent identity and public summaries from Agent Management.
- Task execution, task logs, and result aggregation from Task Orchestration.
- Workflow definitions and execution requests from Workflow Management.

Do not import private code from those modules. Use public APIs, shared DTOs,
domain events, or explicit adapter ports.

## Agent Management Reference

Agent Management is a useful reference for:

- `api/application/domain/infrastructure` layering.
- Repository interfaces with in-memory and Prisma implementations.
- Shared `ApiResponse` envelope helpers.
- Public summary DTOs that exclude private implementation details.
- Frontend API client style.
- Contract and persistence tests.

Do not copy Agent Management entities or lifecycle logic. KB/RAG has different
domain concepts: documents, uploads, validation, ingestion jobs, chunks,
embedding/indexing status, external data sources, sync scope, sync jobs,
processing events, and worker handoff.

## Domain Concepts

The backend boundary defines these module-owned concepts:

- `KnowledgeDocument`
- `KnowledgeDocumentChunk`
- `UploadCandidateFile`
- `UploadValidationResult`
- `KnowledgeIngestionJob`
- `KnowledgeDataSource`
- `KnowledgeSyncScopeNode`
- `KnowledgeSyncJob`
- `KnowledgeSyncJobEvent` or processing event
- Embedding/indexing status
- Worker ingestion handoff

The domain models intentionally keep object storage references and vector
references as opaque server-side strings (`storageKey`, `vectorRef`). Public DTO
mappers do not expose those fields.

## DB Ownership

The DB boundary is defined in `packages/database/prisma/schema.prisma`. Backend
repositories use `@vcp/database` and only access KB/RAG-owned Prisma models.

Rules:

- KB/RAG owns its document, chunk, ingestion, source, sync, index, and
  knowledge-access tables.
- Other modules must not create or mutate KB/RAG tables directly.
- KB/RAG must not create or mutate tables owned by other modules.
- Backend and worker code must use `@vcp/database` exports instead of relative
  Prisma imports.
- Workspace-scoped records must include `workspaceId`.
- Actor identity, timestamps, statuses, and API response shape should follow
  shared platform conventions.

## HTTP API Contract

The public contract uses workspace-scoped routes under
`/api/workspaces/:workspaceId/knowledge/...`:

```text
GET    /api/workspaces/:workspaceId/knowledge/documents
POST   /api/workspaces/:workspaceId/knowledge/uploads/validate
POST   /api/workspaces/:workspaceId/knowledge/uploads/prepare
GET    /api/workspaces/:workspaceId/knowledge/ingestion-jobs
GET    /api/workspaces/:workspaceId/knowledge/data-sources
POST   /api/workspaces/:workspaceId/knowledge/data-sources/:sourceId/connect
GET    /api/workspaces/:workspaceId/knowledge/sync-scope
PUT    /api/workspaces/:workspaceId/knowledge/sync-scope
POST   /api/workspaces/:workspaceId/knowledge/sync-jobs
GET    /api/workspaces/:workspaceId/knowledge/sync-jobs
```

The API router in `api/knowledge-base-rag-router.ts` maps these routes to
application use cases. It parses request bodies, reads `workspaceId` from the
route path, takes actor identity from `request.context`, returns shared DTOs
through `ApiResponse` envelopes, and does not call Prisma, storage, embedding,
vector, worker, or provider adapters directly.

Request bodies must not accept trusted fields such as
`workspaceId`, actor/user ID, generated IDs, lifecycle status, timestamps, raw
credentials, private object-storage paths, or vector DB internals.

## Future Shared DTO Roadmap

Likely future DTOs:

- `KnowledgeDocumentDto`
- `KnowledgeDocumentChunkDto`
- `UploadCandidateFileDto`
- `UploadValidationRequest`
- `UploadValidationResponse`
- `PrepareUploadRequest`
- `PrepareUploadResponse`
- `IngestionJobDto`
- `ExternalDataSourceDto` or `KnowledgeDataSourceDto`
- `SyncScopeNodeDto`
- `SyncJobDto`
- `KnowledgeBaseApiError`

Shared DTOs must be caller-safe. Do not expose credentials, tokens, secrets,
passwords, raw provider config, private vector database fields, raw embedding
payloads, or server-owned mutation fields.

## Future Domain Event Roadmap

The shared contracts currently include `knowledge.document_uploaded` and
`knowledge.index_ready`. Future reviewed events may include:

- `knowledge.document.uploadValidated`
- `knowledge.document.ingestionQueued`
- `knowledge.document.ingestionStarted`
- `knowledge.document.ingestionCompleted`
- `knowledge.document.ingestionFailed`
- `knowledge.dataSource.connected`
- `knowledge.dataSource.connectionFailed`
- `knowledge.sync.scopeUpdated`
- `knowledge.sync.requested`
- `knowledge.sync.started`
- `knowledge.sync.completed`
- `knowledge.sync.failed`

Payloads should include `eventId`, event name/type, `workspaceId`, actor ID
when user-triggered, document/source/job IDs when relevant, status,
`occurredAt`, and safe failure fields. Do not leak pgvector internals,
embedding-provider private payloads, queue internals, raw chunk operations, or
credentials.

## Intended Backend Structure

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Current backend foundation:

- `api/knowledge-base-rag-router.ts`
- `api/knowledge-base-rag-request-parsers.ts`
- `api/api-response.ts`
- `application/*-repository.ts`
- `application/dto-mappers.ts`
- `application/knowledge-document-use-cases.ts`
- `application/knowledge-upload-use-cases.ts`
- `application/knowledge-ingestion-use-cases.ts`
- `application/knowledge-data-source-use-cases.ts`
- `application/knowledge-sync-use-cases.ts`
- `application/knowledge-base-rag-events.ts`
- `application/knowledge-base-rag-errors.ts`
- `domain/knowledge-document.ts`
- `domain/knowledge-ingestion-job.ts`
- `domain/knowledge-data-source.ts`
- `domain/knowledge-sync.ts`
- `infrastructure/prisma-*.ts`
- `infrastructure/in-memory-knowledge-base-rag-repositories.ts`

Likely future files:

- `application/ports.ts`
- `domain/upload-validation.ts`
- `domain/knowledge-events.ts`
- `infrastructure/*-adapter.ts`

API code should translate HTTP and request context into application commands.
Application code should depend on ports. Domain code should hold lifecycle and
validation rules. Infrastructure should implement persistence, vector,
embedding, object-storage, and queue adapters.

Current repository ports cover documents and chunks, ingestion jobs, external
data sources, sync scope nodes, sync jobs, and sync job events. Prisma adapters
are workspace-scoped and do not query private models owned by Agent Management,
Workflow Management, Task Orchestration, Authentication, or other modules.
In-memory adapters are deterministic and workspace-scoped for future
application/use-case tests.

Current application use cases cover metadata-only upload validation, safe
upload preparation into pending document/ingestion-job records, document and
chunk reads, ingestion-job reads, data-source placeholder connection, sync-scope
updates, and queued manual sync-job creation. They do not parse files, upload
to storage, enqueue real workers, call embedding providers, or write vectors.

## Worker Handoff

Long-running ingestion and synchronization must run through workers, not inside
HTTP request handlers.

Expected flow:

1. Validate upload candidates.
2. Prepare valid uploads into document metadata.
3. Queue a document ingestion job.
4. Worker parses, chunks, embeds, and indexes through adapters.
5. Update ingestion and indexing status.
6. Emit public domain events.
7. UI reads document, ingestion, and sync status through API routes.

## Testing Roadmap

Future implementation should add focused tests for:

- Shared contracts and DTO exposure rules.
- DB schema and migration boundaries.
- Domain validation and lifecycle rules.
- Application/use-case behavior.
- In-memory repositories.
- Prisma mappers and repositories.
- API router auth, RBAC, workspace scoping, validation, and envelopes.
- Frontend API client behavior once added.
- Component behavior for Documents and Upload screens once connected.
- Import-boundary checks.
- Worker queue handoff and handler behavior.
- Functional PA5 scenarios for upload validation, preparation, ingestion,
  indexing status, data-source connection placeholders, sync scope, manual sync,
  and failure reporting.

## Implementation Rules

- Keep module code inside `apps/backend/src/modules/knowledge-base-rag` unless
  a reviewed shared-boundary change explicitly requires otherwise.
- Use shared infrastructure through `apps/backend/src/shared/*`.
- Use shared contracts through `@vcp/shared`.
- Use database exports through `@vcp/database` in backend/worker code only.
- Do not import private code from Agent Management, Workflow Management, Task
  Orchestration, or other modules.
- Do not add shared contracts without tests and an OpenSpec-backed reason.
- Do not add runtime code in documentation-only architecture issues.
