# Knowledge Base / RAG Module

Owner: Member 9

Active OpenSpec change: `implement-knowledge-base-rag`.

Foundation reference: see `docs/module-ownership.md`,
`docs/architecture.md`, `docs/team-module-implementation-guide.md`, and
`docs/knowledge-base-rag-context.md`.

## Current Status

This backend module currently contains documentation/context only. It does not
yet contain runtime backend logic, API routers, repository interfaces, Prisma
repositories, in-memory repositories, worker adapters, or shared DTO
implementations.

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

## Future Domain Concepts

Future backend code should define these concepts before route implementation:

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

## Future DB Ownership

This issue does not update Prisma schema or migrations.

Likely future KB/RAG-owned entities:

- `KnowledgeDocument`
- `KnowledgeDocumentChunk`
- `KnowledgeIngestionJob`
- `KnowledgeDataSource`
- `KnowledgeSyncScopeNode`
- `KnowledgeSyncJob`
- `KnowledgeSyncJobEvent`

The current Prisma skeleton already includes `Document`, `KnowledgeIndex`,
`KnowledgeAccessGrant`, and `Job`. A future DB design issue must decide whether
to extend those models or introduce additional additive models.

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

## Future API Contract Roadmap

Do not implement these routes in architecture-only issues.

The current API matrix reserves workspace-scoped routes under
`/api/workspaces/:workspaceId/knowledge/...`. A future API design may consider
this candidate route shape, but it must be reconciled with the API matrix and
workspace tenant rules before implementation:

```text
GET    /api/knowledge-base/documents
POST   /api/knowledge-base/uploads/validate
POST   /api/knowledge-base/uploads/prepare
GET    /api/knowledge-base/ingestion-jobs
GET    /api/knowledge-base/data-sources
POST   /api/knowledge-base/data-sources/:sourceId/connect
GET    /api/knowledge-base/sync-scope
PUT    /api/knowledge-base/sync-scope
POST   /api/knowledge-base/sync-jobs
GET    /api/knowledge-base/sync-jobs
```

Before implementation, define request/response DTOs and decide how workspace
context is provided. Request bodies must not accept trusted fields such as
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

Future runtime implementation should use:

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Likely future files:

- `api/knowledge-base-rag-router.ts`
- `api/api-response.ts`
- `application/document-use-cases.ts`
- `application/upload-validation-use-cases.ts`
- `application/ingestion-job-use-cases.ts`
- `application/sync-use-cases.ts`
- `application/ports.ts`
- `application/*-repository.ts`
- `domain/knowledge-document.ts`
- `domain/upload-validation.ts`
- `domain/knowledge-ingestion-job.ts`
- `domain/knowledge-data-source.ts`
- `domain/knowledge-sync-job.ts`
- `domain/knowledge-events.ts`
- `infrastructure/in-memory-*.ts`
- `infrastructure/prisma-*.ts`
- `infrastructure/*-adapter.ts`

API code should translate HTTP and request context into application commands.
Application code should depend on ports. Domain code should hold lifecycle and
validation rules. Infrastructure should implement persistence, vector,
embedding, object-storage, and queue adapters.

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
