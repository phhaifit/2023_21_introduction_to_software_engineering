# Knowledge Base / RAG Context

## Overview

Knowledge Base / RAG Management owns workspace knowledge sources before they
are used by RAG-enabled agents or task execution flows. It prepares, tracks,
indexes, and governs internal documents and external source data. It is not the
final chatbot, answer-generation, Agent Management, or Task Orchestration
module.

Parent issue: `[Phase 4] Quan ly Tri thuc & Du lieu noi bo (Knowledge Base / RAG Management) #35`

Current architecture issue: `[Architecture] Knowledge Base / RAG - Foundation Audit and Context Alignment`

OpenSpec change: `implement-knowledge-base-rag`

## Current Knowledge Base / RAG State

The frontend currently has a PA5 prototype under
`apps/frontend/src/features/knowledge-base-rag`:

- Base layout and local navigation for Documents, Upload Documents, Data
  Sources, Synchronization Scope, and Processing Status.
- Shared KB/RAG UI components in `knowledge-base-rag-components.tsx`.
- Mock data and shared local view types in `knowledge-base-rag-mock-data.ts`
  and `knowledge-base-rag-view.ts`.
- Documents screen in `knowledge-base-rag-documents.tsx`.
- Upload Documents screen in `knowledge-base-rag-upload.tsx`.
- Typed frontend API client in `knowledge-base-rag-api-client.ts`.
- Feature-prefixed CSS split by shell, shared components, documents, and upload
  screens.

The frontend is integrated into the app shell through `App.tsx`,
`types/navigation.ts`, and `Sidebar.tsx`. This architecture issue does not
change that integration. Documents, Upload, Data Sources, and Synchronization
Scope screens now use the typed frontend KB/RAG API client as their runtime
source of truth. The remaining Processing Status view is still
placeholder-only and should be integrated in a later scoped slice.

The backend now has an internal module foundation under
`apps/backend/src/modules/knowledge-base-rag`:

- Domain models for documents, chunks, ingestion jobs, data sources, sync scope,
  sync jobs, and sync job events.
- Application repository ports for documents, ingestion jobs, data sources,
  sync scope, and sync jobs.
- Application use cases for document reads, metadata-only upload validation,
  safe upload preparation, ingestion-job reads, data-source placeholders,
  sync-scope updates, and queued manual sync-job creation.
- Safe DTO mappers from internal domain objects to shared public DTOs.
- Prisma repositories using KB/RAG-owned Prisma models through `@vcp/database`.
- Deterministic in-memory repositories for future use-case tests.
- A thin workspace-scoped HTTP API router under `api/` that maps shared route
  contracts to application use cases and shared `ApiResponse` envelopes.

Runtime implementation still needs:

- Upload parsing, object storage, embedding, vector indexing, and external
  source adapters.
- Worker ingestion/sync runtime handoff.
- Frontend API integration for Processing Status.
- Worker tests, frontend integration tests, and functional PA5 tests.

The worker path `apps/workers/src/jobs/document-ingestion` currently contains
README/context only. The queue type already reserves `document.ingest`, but no
handler or adapter implementation exists.

## Modular Monolith Alignment

The repository is a TypeScript/NPM workspaces Modular Monolith using vertical
slice boundaries. KB/RAG owns:

- Backend module: `apps/backend/src/modules/knowledge-base-rag`
- Frontend feature: `apps/frontend/src/features/knowledge-base-rag`
- Worker job boundary: `apps/workers/src/jobs/document-ingestion`
- Context docs: `docs/knowledge-base-rag-context.md` and
  `docs/knowledge-base-rag-codex-guide.md`

KB/RAG may import shared contracts from `@vcp/shared`, backend shared
infrastructure from `apps/backend/src/shared/*`, and database exports from
`@vcp/database` in backend/worker code only. It must not import private
repositories, services, UI components, or state stores from Agent Management,
Workflow Management, Task Orchestration, or other modules.

Other modules must not import KB/RAG internals. They should use public APIs,
shared DTOs, domain events, or explicit adapter ports.

## Reference Pattern From Agent Management

Agent Management is the main architecture discipline reference because it
demonstrates:

- Module boundary ownership.
- Backend layering under `api`, `application`, `domain`, and `infrastructure`.
- Repository abstraction with in-memory and Prisma implementations.
- Public API response helpers using shared API envelopes.
- Frontend API client pattern with typed fetch, shared error codes, and
  malformed-response handling.
- Contract and persistence tests around public behavior and Prisma adapters.

KB/RAG must not copy Agent Management entities or logic directly. Agent
Management owns agents, skill configuration, and agent lifecycle. KB/RAG owns
documents, uploads, validation, ingestion jobs, chunks, embedding/indexing
status, external data sources, sync scope, sync jobs, and knowledge retrieval
boundaries.

## Other Reference Patterns

Authentication shows strong colocated backend tests for routers, use cases,
in-memory repositories, Prisma mappers/repositories, and hashing adapters.

Workflow Management shows a useful handoff pattern: workflow execution is
delegated through an injected port instead of running another module's private
logic. KB/RAG should use the same discipline for worker ingestion, data-source
sync, embedding, and vector indexing adapters.

Task & Orchestration shows a clean application-port model for identity, clock,
external catalogs, repositories, and event publishing. KB/RAG should follow the
same approach for deterministic tests and cross-module references.

## Knowledge Base / RAG Domain Concepts

Future implementation should define these concepts before writing runtime code:

- `KnowledgeDocument`: workspace-scoped document metadata for uploaded or
  synchronized knowledge.
- `KnowledgeDocumentChunk`: text chunk metadata prepared for embedding,
  indexing, retrieval, and source attribution.
- `UploadCandidateFile`: client- or API-visible file candidate before durable
  document creation.
- `UploadValidationResult`: validation outcome for file type, size, duplicate
  detection, workspace policy, and safe error reporting.
- `KnowledgeIngestionJob`: asynchronous parsing, chunking, embedding, and
  indexing work record.
- `KnowledgeDataSource`: external source such as Google Drive, Notion, or
  Confluence, excluding raw credentials from public DTOs.
- `KnowledgeSyncScopeNode`: selected external folder, file, page, or space
  included in synchronization.
- `KnowledgeSyncJob`: manual or scheduled sync work record.
- `KnowledgeSyncJobEvent` or processing event: append-only progress or failure
  record for ingestion/sync visibility.
- Embedding/indexing status: lifecycle state such as `pending`, `ingesting`,
  `ready`, and `failed`, aligned with shared statuses when made public.
- Worker ingestion handoff: the boundary from HTTP/API intent to background
  document processing.

## DB Ownership Boundary

The DB source of truth is Prisma under `packages/database/prisma`. The
KB/RAG persistence boundary is implemented with additive Prisma schema and
migration changes.

Final decision:

- Extend the existing KB/RAG-owned `Document` model/table instead of creating a
  duplicate `KnowledgeDocument` table.
- Extend the existing KB/RAG-owned `KnowledgeIndex` model/table with safe
  indexing lifecycle fields.
- Keep the existing KB/RAG-owned `KnowledgeAccessGrant` model/table for future
  agent knowledge access work.
- Leave the generic `Job` model/table untouched; KB/RAG-specific work records
  use explicit KB/RAG-owned job tables.
- Add explicit KB/RAG-owned tables for chunks, ingestion jobs, data sources,
  sync scope, sync jobs, and sync job events.
- Add internal Prisma relations and SQL foreign keys only between KB/RAG-owned
  tables, using `onDelete: Restrict` / `ON DELETE RESTRICT` and
  `onUpdate: NoAction` / `ON UPDATE NO ACTION`.

KB/RAG-owned Prisma models/tables:

- `Document` / `documents`
- `KnowledgeIndex` / `knowledge_indexes`
- `KnowledgeAccessGrant` / `knowledge_access_grants`
- `KnowledgeDocumentChunk` / `knowledge_document_chunks`
- `KnowledgeIngestionJob` / `knowledge_ingestion_jobs`
- `KnowledgeDataSource` / `knowledge_data_sources`
- `KnowledgeSyncScopeNode` / `knowledge_sync_scope_nodes`
- `KnowledgeSyncJob` / `knowledge_sync_jobs`
- `KnowledgeSyncJobEvent` / `knowledge_sync_job_events`

Rules:

- KB/RAG owns its document, chunk, ingestion, source, sync, index, and knowledge
  access tables.
- Other modules must not create or mutate KB/RAG tables directly.
- Other modules should use public APIs, shared DTOs, domain events, or explicit
  adapter ports.
- KB/RAG must not create or mutate tables owned by Authentication, Workspace,
  Agent Management, Workflow Management, Task Orchestration, Tools, or
  Subscription modules.
- Use shared conventions for `workspaceId`, actor identity, timestamps,
  statuses, API envelopes, and safe error shapes.
- Cross-module references such as `agentId`, `taskId`, or `workspaceId` should
  remain scalar public IDs unless an OpenSpec-backed DB design explicitly
  requires a relation.
- Do not add database foreign keys from KB/RAG tables to users, workspaces,
  agents, workflows, tasks, subscriptions, authentication, or session tables in
  this persistence boundary.
- Store object/file references as server-side keys such as `storageKey`, not
  public or private URLs.
- Do not store raw credentials, OAuth refresh tokens, provider secrets,
  passwords, raw embedding vectors, raw vector DB configuration, object-storage
  URLs, or queue internals in these tables.

## Public API Contract Boundary

The public route boundary is implemented by a thin backend API router. The
router does not run long-lived ingestion/sync work and does not call storage,
embedding providers, vector databases, external providers, or worker runtimes.

The final KB/RAG contract uses the workspace-scoped route shape required by
the API matrix and tenant-boundary rules:

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

`workspaceId` is a route tenant locator. Request bodies must not accept
trusted workspace, actor/user, generated ID, lifecycle status, timestamp,
private storage, vector database, embedding-provider, queue, credential, or
secret fields.

## Shared DTO / Contract Boundary

The public shared contract boundary is defined in
`packages/shared/src/contracts/knowledge-base-rag.ts` and exported from
`@vcp/shared`. It currently defines:

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

Shared DTOs must expose only stable cross-boundary fields. They must not expose
raw credentials, tokens, provider secrets, private vector DB configuration,
embedding-provider internals, object-storage private paths, or server-owned
mutation fields.

The frontend API client now uses these shared DTOs. Frontend local mock/view
types are mapped toward these DTOs for the Documents and Upload API-integrated
screens. Prototype-only view models may remain module-local when they are
purely presentation-specific.

## Proposed Domain Events Roadmap

The shared contracts retain the legacy `knowledge.document_uploaded` and
`knowledge.index_ready` events for compatibility and add these granular public
events:

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

Payload principles:

- Include `eventId`.
- Include `eventType` or the shared event name.
- Include `workspaceId`.
- Include `actorId` when user-triggered.
- Include `documentId`, `sourceId`, or `jobId` when relevant.
- Include public `status`.
- Include `occurredAt`.
- Include `errorCode` and safe `errorMessage` for failures.
- Do not leak internal implementation details such as pgvector internals,
  embedding-provider private payloads, raw chunk storage operations, queue
  internals, or credentials unless explicitly made public later.

## Backend Layering Roadmap

Backend implementation uses this structure:

```text
apps/backend/src/modules/knowledge-base-rag/
|-- api/
|-- application/
|-- domain/
`-- infrastructure/
```

Current repository/application boundary files:

- `api/knowledge-base-rag-router.ts`
- `api/knowledge-base-rag-request-parsers.ts`
- `api/api-response.ts`
- `application/knowledge-document-repository.ts`
- `application/knowledge-ingestion-job-repository.ts`
- `application/knowledge-data-source-repository.ts`
- `application/knowledge-sync-repositories.ts`
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
- `infrastructure/prisma-knowledge-document-repository.ts`
- `infrastructure/prisma-knowledge-ingestion-job-repository.ts`
- `infrastructure/prisma-knowledge-data-source-repository.ts`
- `infrastructure/prisma-knowledge-sync-repository.ts`
- `infrastructure/prisma-knowledge-base-rag-mapper.ts`
- `infrastructure/in-memory-knowledge-base-rag-repositories.ts`

Likely future runtime files:

- `domain/upload-validation.ts`
- `domain/knowledge-events.ts`
- `infrastructure/vector-index-adapter.ts`
- `infrastructure/object-storage-adapter.ts`
- `infrastructure/embedding-adapter.ts`

Application code should depend on repository and adapter ports. Infrastructure
should implement those ports. API code should translate HTTP/request context
into application commands and return shared API envelopes.

The backend HTTP router slice intentionally does not add worker handlers,
frontend API clients, file/object storage adapters, embedding/vector adapters,
external source adapters, or Prisma schema changes.

The application use-case slice intentionally keeps upload validation
metadata-only and creates only safe pending document, ingestion-job, and
sync-job records through repository ports. It does not parse files, upload to
object storage, enqueue runtime workers, call embedding providers, or write to a
vector database.

## Worker Handoff Roadmap

Long-running ingestion and synchronization must not run inside an HTTP request.

Expected flow:

1. Upload candidates are validated.
2. Valid uploads are prepared into durable document metadata.
3. An ingestion job is queued through the worker/job boundary.
4. The worker processes document ingestion.
5. The worker parses, chunks, embeds, and indexes through adapter ports.
6. Ingestion and indexing status are updated.
7. Domain events are emitted for public state transitions.
8. The UI reads document, job, and status state through the API.

Manual or scheduled sync should follow the same pattern: record sync intent,
queue work, process in workers, update status, and expose progress through API
reads.

## Testing Roadmap

Future KB/RAG work should add focused tests with each implemented behavior:

- Shared contract tests for DTOs, events, error codes, and dependency safety.
- DB schema and migration tests for KB/RAG-owned tables and indexes.
- Domain tests for documents, upload validation, ingestion lifecycle, sync
  scope, and access rules.
- Application/use-case tests for validation, preparation, queue handoff,
  ingestion status updates, sync requests, and retrieval/access checks.
- Repository tests for in-memory behavior.
- Prisma mapper/repository tests for persistence behavior.
- API router tests for auth, RBAC, workspace scoping, validation, and response
  envelope behavior.
- Frontend API client tests for routes, envelope parsing, API errors, network
  errors, and malformed responses.
- Component tests for existing Documents and Upload API integration behavior.
- Import-boundary tests to prevent private cross-module imports.
- Worker handoff tests for queue payloads, handler registration, adapter usage,
  success, and failure.
- Functional PA5 cases for upload validation, prepare, queued ingestion,
  processing status, failed ingestion, data-source placeholder connection, sync
  scope update, manual sync, and status display.

## Current Constraints

- Do not continue UI-only implementation for new KB/RAG flows until DB/API,
  shared contract, and event foundation is defined.
- Do not add runtime backend routes in architecture-only issues.
- Do not add Prisma schema or migrations in documentation alignment issues.
- Do not add repositories, frontend API clients, worker handlers, or new UI
  screens in this issue.
- Do not add dependencies.
- Keep PRs small and scoped.
